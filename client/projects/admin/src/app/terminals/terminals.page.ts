import { Component, inject, signal, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import {
  CLIENT_TOKEN,
  IClient,
  TerminalDto,
  CreateTerminalDto,
  UpdateTerminalDto,
  extractApiError,
} from 'api-client';
import { firstValueFrom } from 'rxjs';
import { TerminalDialogComponent } from './terminal-dialog.component';

@Component({
  selector: 'app-terminals',
  standalone: true,
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatChipsModule,
    MatTooltipModule,
    DatePipe,
  ],
  template: `
    <div class="header">
      <h1>Terminals</h1>
      <button mat-flat-button color="primary" (click)="onAdd()">
        <mat-icon>add</mat-icon>
        Add Terminal
      </button>
    </div>

    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else {
      <table mat-table [dataSource]="terminals()" class="terminals-table">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let t">{{ t.name }}</td>
        </ng-container>

        <ng-container matColumnDef="registrationCode">
          <th mat-header-cell *matHeaderCellDef>Registration Code</th>
          <td mat-cell *matCellDef="let t" class="mono">{{ t.registrationCode }}</td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let t">
            <mat-chip [highlighted]="t.isActive">
              {{ t.isActive ? 'Active' : 'Inactive' }}
            </mat-chip>
          </td>
        </ng-container>

        <ng-container matColumnDef="lastSeen">
          <th mat-header-cell *matHeaderCellDef>Last Seen</th>
          <td mat-cell *matCellDef="let t">
            {{ t.lastSeenUtc ? (t.lastSeenUtc | date: 'short') : 'Never' }}
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let t">
            <button mat-icon-button (click)="onEdit(t)" matTooltip="Edit">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="warn" (click)="onDelete(t)" matTooltip="Delete">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>

      @if (terminals().length === 0) {
        <p class="empty">No terminals registered. Add one to get started.</p>
      }
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .terminals-table {
        width: 100%;
      }
      .spinner {
        margin: 32px auto;
      }
      .empty {
        text-align: center;
        opacity: 0.5;
        margin-top: 32px;
      }
      .mono {
        font-family: monospace;
        letter-spacing: 1px;
      }
    `,
  ],
})
export class TerminalsPage implements OnInit {
  private readonly client = inject(CLIENT_TOKEN) as IClient;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly terminals = signal<TerminalDto[]>([]);
  readonly loading = signal(false);
  readonly columns = ['name', 'registrationCode', 'status', 'lastSeen', 'actions'];

  async ngOnInit() {
    await this.loadTerminals();
  }

  private async loadTerminals() {
    this.loading.set(true);
    try {
      const terminals = await firstValueFrom(this.client.terminals_GetTerminals());
      this.terminals.set(terminals);
    } finally {
      this.loading.set(false);
    }
  }

  onAdd(): void {
    const ref = this.dialog.open(TerminalDialogComponent, {
      width: '400px',
      data: { mode: 'create' as const },
    });
    ref.afterClosed().subscribe(async (result: CreateTerminalDto | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.terminals_CreateTerminal(result));
        this.snackBar.open('Terminal added.', 'OK', { duration: 3000 });
        await this.loadTerminals();
      } catch (err: unknown) {
        this.showError(err, 'Failed to add terminal.');
      }
    });
  }

  onEdit(terminal: TerminalDto): void {
    const ref = this.dialog.open(TerminalDialogComponent, {
      width: '400px',
      data: { mode: 'edit' as const, terminal },
    });
    ref.afterClosed().subscribe(async (result: UpdateTerminalDto | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.terminals_UpdateTerminal(terminal.id!, result));
        this.snackBar.open('Terminal updated.', 'OK', { duration: 3000 });
        await this.loadTerminals();
      } catch (err: unknown) {
        this.showError(err, 'Failed to update terminal.');
      }
    });
  }

  async onDelete(terminal: TerminalDto): Promise<void> {
    if (!confirm(`Delete terminal "${terminal.name}"? This cannot be undone.`)) return;
    try {
      await firstValueFrom(this.client.terminals_DeleteTerminal(terminal.id!));
      this.snackBar.open('Terminal deleted.', 'OK', { duration: 3000 });
      await this.loadTerminals();
    } catch (err: unknown) {
      this.showError(err, 'Failed to delete terminal.');
    }
  }

  private showError(err: unknown, fallback: string): void {
    this.snackBar.open(extractApiError(err, fallback), 'Dismiss', { duration: 5000 });
  }
}
