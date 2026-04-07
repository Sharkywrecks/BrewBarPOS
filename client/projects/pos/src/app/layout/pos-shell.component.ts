import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from 'auth';
import { PrinterService } from 'printing';
import { OutboxService, SyncEngineService } from 'sync';

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
  ],
  template: `
    <mat-toolbar color="primary" class="pos-toolbar">
      <span class="brand">BrewBar</span>
      <span class="spacer"></span>
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
      }
      .brand {
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .spacer {
        flex: 1;
      }
      .cashier-name {
        margin-right: 8px;
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
  private readonly snackBar = inject(MatSnackBar);

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
}
