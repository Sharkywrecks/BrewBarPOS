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
  { classCode: 7 }, // Printer class
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

    const iface = this.device.configuration!.interfaces[0];
    await this.device.claimInterface(iface.interfaceNumber);

    const alt = iface.alternates[0];
    const outEndpoint = alt.endpoints.find((e) => e.direction === 'out');
    if (!outEndpoint) {
      throw new Error('No OUT endpoint found on printer');
    }
    this.endpoint = outEndpoint.endpointNumber;
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
