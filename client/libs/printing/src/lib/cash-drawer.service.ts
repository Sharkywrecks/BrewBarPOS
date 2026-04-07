import { Injectable, inject } from '@angular/core';
import { PrinterService } from './printer.service';

@Injectable({ providedIn: 'root' })
export class CashDrawerService {
  private printer = inject(PrinterService);

  /** Open the cash drawer. Requires a printer to be connected. */
  async kick(pin: 0 | 1 = 0): Promise<void> {
    if (!this.printer.isConnected) {
      throw new Error('Cannot open cash drawer: no printer connected');
    }
    await this.printer.kickCashDrawer(pin);
  }
}
