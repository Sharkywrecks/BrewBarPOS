import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrinterService, NAVIGATOR } from './printer.service';

function createMockDevice() {
  return {
    opened: false,
    configuration: {
      interfaces: [
        {
          interfaceNumber: 0,
          alternates: [
            {
              endpoints: [{ direction: 'out', endpointNumber: 1 }],
            },
          ],
        },
      ],
    },
    open: vi.fn().mockImplementation(function (this: any) {
      this.opened = true;
      return Promise.resolve();
    }),
    close: vi.fn().mockImplementation(function (this: any) {
      this.opened = false;
      return Promise.resolve();
    }),
    selectConfiguration: vi.fn().mockResolvedValue(undefined),
    claimInterface: vi.fn().mockResolvedValue(undefined),
    transferOut: vi.fn().mockResolvedValue({ status: 'ok' }),
  };
}

function createMockNavigator(device: any = createMockDevice()) {
  return {
    usb: {
      requestDevice: vi.fn().mockResolvedValue(device),
    },
  } as any;
}

describe('PrinterService', () => {
  let service: PrinterService;
  let mockDevice: ReturnType<typeof createMockDevice>;
  let mockNav: any;

  beforeEach(() => {
    mockDevice = createMockDevice();
    mockNav = createMockNavigator(mockDevice);

    TestBed.configureTestingModule({
      providers: [PrinterService, { provide: NAVIGATOR, useValue: mockNav }],
    });

    service = TestBed.inject(PrinterService);
  });

  describe('isConnected', () => {
    it('should be false initially', () => {
      expect(service.isConnected).toBe(false);
    });

    it('should be true after connect', async () => {
      await service.connect();
      expect(service.isConnected).toBe(true);
    });

    it('should be false after disconnect', async () => {
      await service.connect();
      await service.disconnect();
      expect(service.isConnected).toBe(false);
    });
  });

  describe('connect', () => {
    it('should request a USB device with printer class filter', async () => {
      await service.connect();
      expect(mockNav.usb.requestDevice).toHaveBeenCalledWith({
        filters: [{ classCode: 7 }],
      });
    });

    it('should open the device', async () => {
      await service.connect();
      expect(mockDevice.open).toHaveBeenCalled();
    });

    it('should claim the first interface', async () => {
      await service.connect();
      expect(mockDevice.claimInterface).toHaveBeenCalledWith(0);
    });

    it('should throw when WebUSB is not available', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [PrinterService, { provide: NAVIGATOR, useValue: {} }],
      });
      const svc = TestBed.inject(PrinterService);
      await expect(svc.connect()).rejects.toThrow('WebUSB is not supported');
    });
  });

  describe('print', () => {
    it('should send data to the OUT endpoint', async () => {
      await service.connect();
      const data = new Uint8Array([0x1b, 0x40]);
      await service.print(data);
      expect(mockDevice.transferOut).toHaveBeenCalledWith(1, data);
    });

    it('should throw if not connected', async () => {
      await expect(service.print(new Uint8Array([]))).rejects.toThrow('Printer not connected');
    });
  });

  describe('kickCashDrawer', () => {
    it('should send cash drawer kick command', async () => {
      await service.connect();
      await service.kickCashDrawer();
      const sentData = mockDevice.transferOut.mock.calls[0][1] as Uint8Array;
      expect(Array.from(sentData)).toEqual([0x1b, 0x70, 0x00, 0x19, 0x78]);
    });
  });

  describe('disconnect', () => {
    it('should close the device', async () => {
      await service.connect();
      await service.disconnect();
      expect(mockDevice.close).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(service.disconnect()).resolves.not.toThrow();
    });
  });
});
