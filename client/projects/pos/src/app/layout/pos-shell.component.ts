import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { extractApiError } from 'api-client';
import { AuthService } from 'auth';
import { PrinterService } from 'printing';
import { OutboxService, SyncEngineService, ConnectivityService } from 'sync';
import { ShiftService } from '../services/shift.service';
import { OpenShiftDialogComponent } from '../register/open-shift-dialog.component';
import {
  CloseShiftDialogComponent,
  CloseShiftResult,
} from '../register/close-shift-dialog.component';
import { CashDropDialogComponent, CashDropResult } from '../register/cash-drop-dialog.component';

@Component({
  selector: 'app-pos-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <mat-toolbar color="primary" class="pos-toolbar">
      <span class="brand">BrewBar</span>
      @if (!connectivity.isOnline()) {
        <mat-icon
          class="offline-indicator"
          matTooltip="Offline — orders will sync when connection is restored"
          >cloud_off</mat-icon
        >
      }
      <span class="spacer"></span>
      @if (shift.currentShift()) {
        <button mat-icon-button matTooltip="Cash Drop" (click)="onCashDrop()">
          <mat-icon>move_to_inbox</mat-icon>
        </button>
        <button mat-icon-button matTooltip="Close Shift" (click)="onCloseShift()">
          <mat-icon>point_of_sale</mat-icon>
        </button>
      }
      <button mat-icon-button routerLink="/history" matTooltip="Order history">
        <mat-icon>history</mat-icon>
      </button>
      @if (outbox.hasPending()) {
        <button
          mat-icon-button
          matTooltip="Syncing {{ outbox.pendingCount() }} offline order(s)..."
          (click)="syncEngine.processOutbox()"
        >
          <mat-icon class="syncing">sync</mat-icon>
        </button>
      }
      <button
        mat-icon-button
        (click)="onPrinterToggle()"
        [matTooltip]="printer.isConnected ? 'Printer connected' : 'Connect printer'"
        aria-label="Printer connection"
      >
        <mat-icon [class.connected]="printer.isConnected">
          {{ printer.isConnected ? 'print' : 'print_disabled' }}
        </mat-icon>
      </button>
      @if (auth.canAccessAdminPanel()) {
        <a
          mat-icon-button
          href="/admin/"
          matTooltip="Open admin panel"
          aria-label="Open admin panel"
        >
          <mat-icon>admin_panel_settings</mat-icon>
        </a>
      }
      <span class="cashier-name">{{ auth.currentUser()?.displayName }}</span>
      <button mat-icon-button (click)="auth.logout()" aria-label="Logout">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>
    <div class="pos-content">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .pos-toolbar {
        flex-shrink: 0;
        height: 48px;
        font-size: 16px;
        gap: 2px;
      }
      .pos-toolbar button[mat-icon-button] {
        width: 40px;
        height: 40px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pos-toolbar button[mat-icon-button] ::ng-deep .mat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .brand {
        font-weight: 800;
        letter-spacing: 1px;
        font-size: 18px;
      }
      .spacer {
        flex: 1;
      }
      .cashier-name {
        margin: 0 4px 0 8px;
        font-size: 14px;
        opacity: 0.9;
      }
      .pos-content {
        flex: 1;
        overflow: hidden;
      }
      .connected {
        color: #4caf50;
      }
      .syncing {
        color: #ff9800;
        animation: spin 1.5s linear infinite;
      }
      .offline-indicator {
        color: #f44336;
        margin-left: 8px;
      }
      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class PosShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly printer = inject(PrinterService);
  protected readonly outbox = inject(OutboxService);
  protected readonly syncEngine = inject(SyncEngineService);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly shift = inject(ShiftService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  async onPrinterToggle(): Promise<void> {
    try {
      if (this.printer.isConnected) {
        await this.printer.disconnect();
        this.snackBar.open('Printer disconnected.', 'OK', { duration: 2000 });
      } else {
        await this.printer.connect();
        this.snackBar.open('Printer connected!', 'OK', { duration: 2000 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect printer';
      this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
    }
  }

  onCloseShift(): void {
    const ref = this.dialog.open(CloseShiftDialogComponent, { width: '400px' });
    ref.afterClosed().subscribe(async (result: CloseShiftResult | undefined) => {
      if (!result) return;
      const shiftId = this.shift.currentShift()?.id;
      if (!shiftId) return;
      try {
        await this.shift.closeShift(shiftId, result.closingCashAmount, result.notes ?? undefined);
        this.snackBar.open('Shift closed.', 'OK', { duration: 3000 });
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to close shift.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }

  onCashDrop(): void {
    const ref = this.dialog.open(CashDropDialogComponent, { width: '400px' });
    ref.afterClosed().subscribe(async (result: CashDropResult | undefined) => {
      if (!result) return;
      const shiftId = this.shift.currentShift()?.id;
      if (!shiftId) return;
      try {
        await this.shift.addCashDrop(shiftId, result.amount, result.reason ?? undefined);
        this.snackBar.open('Cash drop recorded.', 'OK', { duration: 3000 });
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to record cash drop.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }
}
