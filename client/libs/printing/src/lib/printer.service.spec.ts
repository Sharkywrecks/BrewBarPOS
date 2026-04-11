import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { PrinterService, NAVIGATOR, PRINT_API_CLIENT, PrintApiClient } from './printer.service';

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

function createMockApiClient(): { [K in keyof PrintApiClient]: ReturnType<typeof vi.fn> } {
  return {
    print_Print: vi.fn(),
    print_GetStatus: vi.fn(),
    print_GetPrinters: vi.fn(),
    print_SelectPrinter: vi.fn(),
  };
}

// ── WebUSB mode tests ──────────────────────────────────────────

describe('PrinterService (USB mode)', () => {
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

    it('should set mode to usb', async () => {
      await service.connect();
      expect(service.mode).toBe('usb');
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

    it('should clear mode after disconnect', async () => {
      await service.connect();
      await service.disconnect();
      expect(service.mode).toBeNull();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(service.disconnect()).resolves.not.toThrow();
    });
  });
});

// ── Relay mode tests ───────────────────────────────────────────

describe('PrinterService (relay mode)', () => {
  let service: PrinterService;
  let mockApiClient: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    mockApiClient = createMockApiClient();

    TestBed.configureTestingModule({
      providers: [
        PrinterService,
        { provide: NAVIGATOR, useValue: {} },
        { provide: PRINT_API_CLIENT, useValue: mockApiClient },
      ],
    });

    service = TestBed.inject(PrinterService);
  });

  describe('connect', () => {
    it('should check printer status via API client', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: true }));
      await service.connect();
      expect(mockApiClient.print_GetStatus).toHaveBeenCalled();
    });

    it('should set mode to relay after connect', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: true }));
      await service.connect();
      expect(service.mode).toBe('relay');
      expect(service.isConnected).toBe(true);
    });

    it('should throw when printer is not available', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: false }));
      await expect(service.connect()).rejects.toThrow('Printer is not reachable via relay');
    });

    it('should throw when API call fails', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(throwError(() => new Error('Network error')));
      await expect(service.connect()).rejects.toThrow();
    });
  });

  describe('print', () => {
    it('should POST base64-encoded data via API client', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: true }));
      mockApiClient.print_Print.mockReturnValue(of({ success: true }));

      await service.connect();
      const data = new Uint8Array([0x1b, 0x40, 0x48, 0x69]); // ESC @ Hi
      await service.print(data);

      expect(mockApiClient.print_Print).toHaveBeenCalledWith({
        data: btoa(String.fromCharCode(0x1b, 0x40, 0x48, 0x69)),
      });
    });

    it('should throw if not connected in relay mode', async () => {
      await expect(service.print(new Uint8Array([0x1b]))).rejects.toThrow('Printer not connected');
    });

    it('should propagate API errors', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: true }));
      mockApiClient.print_Print.mockReturnValue(throwError(() => new Error('502 Printer error')));

      await service.connect();
      await expect(service.print(new Uint8Array([0x1b, 0x40]))).rejects.toThrow();
    });
  });

  describe('kickCashDrawer', () => {
    it('should send cash drawer kick via relay', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: true }));
      mockApiClient.print_Print.mockReturnValue(of({ success: true }));

      await service.connect();
      await service.kickCashDrawer();

      expect(mockApiClient.print_Print).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.any(String) }),
      );
    });
  });

  describe('disconnect', () => {
    it('should clear relay connection state', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: true }));
      await service.connect();

      await service.disconnect();

      expect(service.isConnected).toBe(false);
      expect(service.mode).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should be false initially', () => {
      expect(service.isConnected).toBe(false);
    });

    it('should be true after relay connect', async () => {
      mockApiClient.print_GetStatus.mockReturnValue(of({ available: true }));
      await service.connect();
      expect(service.isConnected).toBe(true);
    });
  });
});
