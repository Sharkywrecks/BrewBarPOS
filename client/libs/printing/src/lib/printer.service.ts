import { Injectable, InjectionToken, inject } from '@angular/core';
import { cashDrawerKick } from './escpos-commands';

/**
 * Injection token for the navigator object.
 * Override in tests to provide a mock WebUSB implementation.
 */
export const NAVIGATOR = new InjectionToken<Navigator>('NAVIGATOR', {
  providedIn: 'root',
  factory: () => navigator,
});

/** Minimal WebUSB types — avoids dependency on @anthropic-ai/sdk or dom-webusb typings */
interface UsbDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
}

interface UsbEndpoint {
  direction: 'in' | 'out';
  endpointNumber: number;
}

interface UsbInterface {
  interfaceNumber: number;
  alternates: { endpoints: UsbEndpoint[] }[];
}

interface UsbDevice {
  opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configValue: number): Promise<void>;
  claimInterface(ifaceNumber: number): Promise<void>;
  transferOut(endpoint: number, data: Uint8Array): Promise<unknown>;
}

interface UsbApi {
  requestDevice(options: { filters: UsbDeviceFilter[] }): Promise<UsbDevice>;
}

const PRINTER_FILTERS: UsbDeviceFilter[] = [
  { vendorId: 0x0483, productId: 0x5743 }, // Xepos / Xprinter (STM32-based)
  { classCode: 7 }, // Generic USB Printer class fallback
];

@Injectable({ providedIn: 'root' })
export class PrinterService {
  private nav = inject(NAVIGATOR);
  private device: UsbDevice | null = null;
  private endpoint: number | null = null;

  get isConnected(): boolean {
    return this.device?.opened ?? false;
  }

  /** Prompt user to select a USB printer and open it */
  async connect(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usb = (this.nav as any).usb as UsbApi | undefined;
    if (!usb) {
      throw new Error('WebUSB is not supported in this browser');
    }

    this.device = await usb.requestDevice({ filters: PRINTER_FILTERS });
    await this.device.open();

    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }

    // Find the interface with a bulk OUT endpoint (scan all, not just index 0)
    const interfaces = this.device.configuration!.interfaces;
    let claimedIface: UsbInterface | null = null;
    let outEp: UsbEndpoint | null = null;

    for (const iface of interfaces) {
      for (const alt of iface.alternates) {
        const ep = alt.endpoints.find((e) => e.direction === 'out');
        if (ep) {
          claimedIface = iface;
          outEp = ep;
          break;
        }
      }
      if (outEp) break;
    }

    if (!claimedIface || !outEp) {
      throw new Error('No OUT endpoint found on printer');
    }

    await this.device.claimInterface(claimedIface.interfaceNumber);
    this.endpoint = outEp.endpointNumber;
  }

  /** Send raw bytes to the printer */
  async print(data: Uint8Array): Promise<void> {
    if (!this.device?.opened || this.endpoint === null) {
      throw new Error('Printer not connected');
    }
    await this.device.transferOut(this.endpoint, data);
  }

  /** Open the cash drawer via the printer */
  async kickCashDrawer(pin: 0 | 1 = 0): Promise<void> {
    await this.print(cashDrawerKick(pin));
  }

  /** Disconnect from the printer */
  async disconnect(): Promise<void> {
    if (this.device?.opened) {
      await this.device.close();
    }
    this.device = null;
    this.endpoint = null;
  }
}
