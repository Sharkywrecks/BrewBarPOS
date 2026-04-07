import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CashDrawerService } from './cash-drawer.service';
import { PrinterService } from './printer.service';

describe('CashDrawerService', () => {
  let service: CashDrawerService;
  let mockPrinter: {
    isConnected: boolean;
    kickCashDrawer: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrinter = {
      isConnected: false,
      kickCashDrawer: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [CashDrawerService, { provide: PrinterService, useValue: mockPrinter }],
    });

    service = TestBed.inject(CashDrawerService);
  });

  it('should throw when no printer is connected', async () => {
    mockPrinter.isConnected = false;
    await expect(service.kick()).rejects.toThrow('Cannot open cash drawer: no printer connected');
  });

  it('should kick cash drawer via printer when connected', async () => {
    mockPrinter.isConnected = true;
    await service.kick();
    expect(mockPrinter.kickCashDrawer).toHaveBeenCalledWith(0);
  });

  it('should pass pin parameter to printer', async () => {
    mockPrinter.isConnected = true;
    await service.kick(1);
    expect(mockPrinter.kickCashDrawer).toHaveBeenCalledWith(1);
  });
});
