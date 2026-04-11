import { Component, inject, signal, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PrinterService, PrinterInfoDto, buildReceipt, ReceiptData } from 'printing';

@Component({
  selector: 'app-printer-setup-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="title-icon">print</mat-icon>
      Printer Setup
    </h2>

    <mat-dialog-content>
      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Searching for printers...</span>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error() }}</span>
          <button mat-stroked-button (click)="refresh()">Retry</button>
        </div>
      } @else {
        <!-- Current Status -->
        <div class="status-section">
          <div class="status-row">
            <mat-icon [class.connected]="printer.connected()">
              {{ printer.connected() ? 'check_circle' : 'cancel' }}
            </mat-icon>
            <div class="status-text">
              <strong>{{ printer.connected() ? 'Connected' : 'Disconnected' }}</strong>
              @if (printer.connected() && printerInfo()?.mode) {
                <span class="status-detail">
                  via {{ printerInfo()!.mode === 'Network' ? 'Network' : 'Windows Spooler' }}
                  @if (printerInfo()!.mode === 'Network') {
                    ({{ printerInfo()!.networkHost }}:{{ printerInfo()!.networkPort }})
                  } @else if (printerInfo()!.printerName) {
                    — {{ printerInfo()!.printerName }}
                  }
                </span>
              }
            </div>
          </div>
        </div>

        <mat-divider />

        <!-- Installed Printers -->
        <h3 class="section-title">
          <mat-icon>search</mat-icon>
          Windows Printers
          <button mat-icon-button class="refresh-btn" matTooltip="Refresh" (click)="refresh()">
            <mat-icon [class.spinning]="refreshing()">refresh</mat-icon>
          </button>
        </h3>

        @if (printerInfo()?.installedPrinters?.length) {
          <mat-selection-list [multiple]="false" class="printer-list">
            @for (name of printerInfo()!.installedPrinters!; track name) {
              <mat-list-option
                [value]="name"
                [selected]="printer.connected() && printerInfo()!.printerName === name"
                (click)="selectPrinter(name)"
                [class.active-printer]="printer.connected() && printerInfo()!.printerName === name"
              >
                <mat-icon matListItemIcon>print</mat-icon>
                <span matListItemTitle>{{ name }}</span>
                @if (printer.connected() && printerInfo()!.printerName === name) {
                  <span matListItemLine class="active-label">Active</span>
                }
              </mat-list-option>
            }
          </mat-selection-list>
        } @else {
          <div class="empty-state">
            <mat-icon>print_disabled</mat-icon>
            <span>No Windows printers found</span>
          </div>
        }

        <mat-divider />

        <!-- WebUSB Option -->
        <h3 class="section-title">
          <mat-icon>usb</mat-icon>
          Direct USB (WebUSB)
        </h3>
        <p class="section-hint">Connect directly to a USB thermal printer via the browser.</p>
        <button mat-stroked-button class="full-width" (click)="connectWebUsb()">
          <mat-icon>usb</mat-icon>
          {{
            printer.connected() && printer.mode === 'usb'
              ? 'Reconnect USB Printer'
              : 'Connect USB Printer'
          }}
        </button>

        <!-- Auto-detect (reset selection) -->
        @if (printerInfo()?.printerName) {
          <div class="auto-detect-section">
            <mat-divider />
            <button
              mat-stroked-button
              class="full-width auto-detect-btn"
              (click)="resetToAutoDetect()"
            >
              <mat-icon>auto_fix_high</mat-icon>
              Reset to Auto-Detect
            </button>
          </div>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (printer.connected()) {
        <button mat-stroked-button color="warn" (click)="disconnect()">
          <mat-icon>link_off</mat-icon>
          Disconnect
        </button>
        <button mat-stroked-button (click)="testPrint()" [disabled]="testing()">
          @if (testing()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <mat-icon>receipt_long</mat-icon>
          }
          Test Print
        </button>
      }
      <button mat-flat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .title-icon {
        vertical-align: middle;
        margin-right: 8px;
      }

      .loading-state,
      .error-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 24px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
      .error-state mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--mat-sys-error);
      }
      .empty-state mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        opacity: 0.5;
      }

      .status-section {
        padding: 12px 0;
      }
      .status-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .status-row mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: var(--mat-sys-error);
      }
      .status-row mat-icon.connected {
        color: var(--mat-sys-primary);
      }
      .status-text {
        display: flex;
        flex-direction: column;
      }
      .status-detail {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 600;
        margin: 16px 0 8px;
      }
      .section-title mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-on-surface-variant);
      }
      .refresh-btn {
        margin-left: auto;
        width: 32px;
        height: 32px;
        padding: 0;
      }
      .refresh-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .printer-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
      }
      .active-printer {
        background: var(--mat-sys-primary-container);
      }
      .active-label {
        color: var(--mat-sys-primary);
        font-weight: 600;
        font-size: 12px;
      }

      .section-hint {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 8px;
      }

      .full-width {
        width: 100%;
      }

      .auto-detect-section {
        margin-top: 16px;
      }
      .auto-detect-btn {
        margin-top: 12px;
      }

      .spinning {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }

      mat-dialog-actions button mat-icon {
        margin-right: 4px;
        vertical-align: middle;
      }
      mat-dialog-actions mat-spinner {
        display: inline-block;
        margin-right: 4px;
      }
    `,
  ],
})
export class PrinterSetupDialogComponent implements OnInit {
  protected readonly printer = inject(PrinterService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogRef = inject(MatDialogRef<PrinterSetupDialogComponent>);

  protected readonly printerInfo = signal<PrinterInfoDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly testing = signal(false);

  ngOnInit(): void {
    this.loadPrinterInfo();
  }

  protected async refresh(): Promise<void> {
    this.refreshing.set(true);
    this.error.set(null);
    await this.loadPrinterInfo();
    this.refreshing.set(false);
  }

  protected async selectPrinter(name: string): Promise<void> {
    try {
      await this.printer.selectPrinter(name);
      this.snackBar.open(`Selected: ${name}`, 'OK', { duration: 2000 });
      await this.loadPrinterInfo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to select printer';
      this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
    }
  }

  protected async resetToAutoDetect(): Promise<void> {
    try {
      await this.printer.selectPrinter(null);
      this.snackBar.open('Reset to auto-detect.', 'OK', { duration: 2000 });
      await this.loadPrinterInfo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reset printer selection';
      this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
    }
  }

  protected async connectWebUsb(): Promise<void> {
    try {
      // Disconnect relay if active, then connect via WebUSB
      if (this.printer.connected()) {
        await this.printer.disconnect();
      }
      await this.printer.connect();
      this.snackBar.open('USB printer connected!', 'OK', { duration: 2000 });
      this.dialogRef.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect USB printer';
      this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
    }
  }

  protected async disconnect(): Promise<void> {
    await this.printer.disconnect();
    this.snackBar.open('Printer disconnected.', 'OK', { duration: 2000 });
    await this.loadPrinterInfo();
  }

  protected async testPrint(): Promise<void> {
    this.testing.set(true);
    try {
      const receipt: ReceiptData = {
        storeName: 'BrewBar POS',
        orderNumber: 'TEST-001',
        lineItems: [
          {
            name: 'Test Item',
            quantity: 1,
            unitPrice: 0,
            lineTotal: 0,
            modifiers: [],
          },
        ],
        subtotal: 0,
        taxRate: 0,
        taxAmount: 0,
        total: 0,
        paymentMethod: 'Test',
        amountTendered: 0,
        changeGiven: 0,
        dateTime: new Date(),
      };
      const bytes = buildReceipt(receipt);
      await this.printer.print(bytes);
      this.snackBar.open('Test page sent!', 'OK', { duration: 2000 });
    } catch {
      this.snackBar.open('Test print failed.', 'Dismiss', { duration: 3000 });
    } finally {
      this.testing.set(false);
    }
  }

  private async loadPrinterInfo(): Promise<void> {
    try {
      const info = await this.printer.getPrinterInfo();
      if (info) {
        this.printerInfo.set(info);
      }
      this.error.set(null);
    } catch {
      this.error.set('Could not reach the server to discover printers.');
    } finally {
      this.loading.set(false);
    }
  }
}
