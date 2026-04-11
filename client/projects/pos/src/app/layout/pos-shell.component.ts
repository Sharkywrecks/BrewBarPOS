import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
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
import { PrinterSetupDialogComponent } from './printer-setup-dialog.component';

@Component({
  selector: 'app-pos-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <nav class="pos-navbar">
      <div class="nav-left">
        <a routerLink="/register" class="brand">
          <mat-icon class="brand-icon">local_cafe</mat-icon>
          <span class="brand-text">BrewBar</span>
        </a>
        @if (!connectivity.isOnline()) {
          <span
            class="status-chip offline-chip"
            matTooltip="Offline — orders will sync when connection is restored"
          >
            <mat-icon>cloud_off</mat-icon>
            Offline
          </span>
        }
        @if (outbox.hasPending()) {
          <button
            class="status-chip sync-chip"
            matTooltip="Syncing {{ outbox.pendingCount() }} offline order(s)..."
            (click)="syncEngine.processOutbox()"
          >
            <mat-icon class="syncing">sync</mat-icon>
            {{ outbox.pendingCount() }}
          </button>
        }
      </div>

      <div class="nav-actions">
        @if (shift.currentShift()) {
          <button mat-icon-button matTooltip="Cash Drop" (click)="onCashDrop()">
            <mat-icon>move_to_inbox</mat-icon>
          </button>
          <button mat-icon-button matTooltip="Close Shift" (click)="onCloseShift()">
            <mat-icon>point_of_sale</mat-icon>
          </button>
          <span class="nav-divider"></span>
        }
        <button mat-icon-button routerLink="/history" matTooltip="Order history">
          <mat-icon>history</mat-icon>
        </button>
        <button
          mat-icon-button
          (click)="onPrinterToggle()"
          [matTooltip]="printer.connected() ? 'Printer connected' : 'Connect printer'"
          aria-label="Printer setup"
          [class.printer-on]="printer.connected()"
        >
          <mat-icon>
            {{ printer.connected() ? 'print' : 'print_disabled' }}
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
        <span class="nav-divider"></span>
        <button class="user-chip" matTooltip="Logout" (click)="auth.logout()">
          <mat-icon class="user-avatar">person</mat-icon>
          <span class="user-name">{{ auth.currentUser()?.displayName }}</span>
          <mat-icon class="logout-icon">logout</mat-icon>
        </button>
      </div>
    </nav>
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

      .pos-navbar {
        flex-shrink: 0;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        background: var(--mat-sys-surface-container);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        gap: 8px;
      }

      /* Left section: brand + status chips */
      .nav-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 6px;
        text-decoration: none;
        color: var(--mat-sys-on-surface);
      }
      .brand-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--mat-sys-primary);
      }
      .brand-text {
        font-weight: 800;
        font-size: 18px;
        letter-spacing: 0.5px;
      }

      /* Status chips (offline, sync) */
      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 10px 2px 6px;
        border-radius: 20px;
        border: none;
        cursor: default;
        line-height: 1;
        height: 26px;
      }
      .status-chip mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .offline-chip {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }
      .sync-chip {
        background: #fff3e0;
        color: #e65100;
        cursor: pointer;
      }
      .sync-chip:hover {
        background: #ffe0b2;
      }

      /* Right section: actions + user */
      .nav-actions {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .nav-actions button[mat-icon-button],
      .nav-actions a[mat-icon-button] {
        width: 40px;
        height: 40px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--mat-sys-on-surface-variant);
      }
      .nav-actions button[mat-icon-button]:hover,
      .nav-actions a[mat-icon-button]:hover {
        color: var(--mat-sys-on-surface);
      }
      .nav-actions button[mat-icon-button] ::ng-deep .mat-icon,
      .nav-actions a[mat-icon-button] ::ng-deep .mat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .printer-on ::ng-deep .mat-icon {
        color: var(--mat-sys-primary) !important;
      }

      .nav-divider {
        width: 1px;
        height: 24px;
        background: var(--mat-sys-outline-variant);
        margin: 0 4px;
        flex-shrink: 0;
      }

      /* User chip */
      .user-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px 4px 4px;
        border-radius: 24px;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface);
        color: var(--mat-sys-on-surface);
        cursor: pointer;
        height: 36px;
        transition:
          background 0.15s,
          border-color 0.15s;
      }
      .user-chip:hover {
        background: var(--mat-sys-surface-container-high);
        border-color: var(--mat-sys-outline);
      }
      .user-avatar {
        font-size: 20px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
      .user-name {
        font-size: 13px;
        font-weight: 500;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .logout-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.7;
      }
      .user-chip:hover .logout-icon {
        opacity: 1;
        color: var(--mat-sys-error);
      }

      .pos-content {
        flex: 1;
        overflow: hidden;
      }

      .syncing {
        animation: spin 1.5s linear infinite;
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

  onPrinterToggle(): void {
    this.dialog.open(PrinterSetupDialogComponent, { width: '480px' });
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
