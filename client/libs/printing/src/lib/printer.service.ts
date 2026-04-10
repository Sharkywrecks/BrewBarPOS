import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { cashDrawerKick } from './escpos-commands';

/**
 * Injection token for the navigator object.
 * Override in tests to provide a mock WebUSB implementation.
 */
export const NAVIGATOR = new InjectionToken<Navigator>('NAVIGATOR', {
  providedIn: 'root',
  factory: () => navigator,
});

/**
 * Injection token for the NSwag-generated API client.
 * Expected to provide `print_Print()` and `print_GetStatus()` methods.
 */
export const PRINT_API_CLIENT = new InjectionToken<PrintApiClient>('PRINT_API_CLIENT');

/** Minimal interface matching the NSwag-generated print methods */
export interface PrintApiClient {
  print_Print(body?: { data: string | null }): import('rxjs').Observable<unknown>;
  print_GetStatus(): import('rxjs').Observable<unknown>;
}

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

export type PrinterMode = 'usb' | 'relay';

@Injectable({ providedIn: 'root' })
export class PrinterService {
  private nav = inject(NAVIGATOR);
  private apiClient = inject(PRINT_API_CLIENT, { optional: true });

  private device: UsbDevice | null = null;
  private endpoint: number | null = null;
  private _mode: PrinterMode | null = null;
  private _relayConnected = false;

  get isConnected(): boolean {
    if (this._mode === 'relay') return this._relayConnected;
    return this.device?.opened ?? false;
  }

  get mode(): PrinterMode | null {
    return this._mode;
  }

  /**
   * Connect to the printer.
   * If PRINT_API_CLIENT is provided, connects via the backend relay.
   * Otherwise, uses WebUSB to connect directly.
   */
  async connect(): Promise<void> {
    if (this.apiClient) {
      await this.connectRelay();
    } else {
      await this.connectUsb();
    }
  }

  /** Send raw bytes to the printer */
  async print(data: Uint8Array): Promise<void> {
    if (this._mode === 'relay') {
      await this.printRelay(data);
      return;
    }

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
    if (this._mode === 'relay') {
      this._relayConnected = false;
      this._mode = null;
      return;
    }

    if (this.device?.opened) {
      await this.device.close();
    }
    this.device = null;
    this.endpoint = null;
    this._mode = null;
  }

  // ── WebUSB mode ──────────────────────────────────────────────

  private async connectUsb(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usb = (this.nav as any).usb as UsbApi | undefined;
    if (!usb) {
      throw new Error('WebUSB is not supported in this browser');
    }

    this.device = await usb.requestDevice({
      filters: [{ classCode: 7 }],
    });
    await this.device.open();

    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }

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
    this._mode = 'usb';
  }

  // ── Relay mode ───────────────────────────────────────────────

  private async connectRelay(): Promise<void> {
    const result = (await firstValueFrom(this.apiClient!.print_GetStatus())) as {
      available?: boolean;
    };

    if (!result?.available) {
      throw new Error('Printer is not reachable via relay');
    }

    this._relayConnected = true;
    this._mode = 'relay';
  }

  private async printRelay(data: Uint8Array): Promise<void> {
    if (!this._relayConnected) {
      throw new Error('Printer not connected');
    }

    const base64 = uint8ToBase64(data);
    await firstValueFrom(this.apiClient!.print_Print({ data: base64 }));
  }
}

/** Convert Uint8Array to base64 string (works in all browsers) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
