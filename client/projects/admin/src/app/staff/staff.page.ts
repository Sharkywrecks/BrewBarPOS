import { Component, inject, signal, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CLIENT_TOKEN,
  IClient,
  UserDto,
  RegisterDto,
  UpdateUserDto,
  ResetPinDto,
} from 'api-client';
import { firstValueFrom } from 'rxjs';
import { RegisterStaffDialogComponent } from './register-staff-dialog.component';
import { EditStaffDialogComponent } from './edit-staff-dialog.component';
import { ResetPinDialogComponent } from './reset-pin-dialog.component';

@Component({
  selector: 'app-staff',
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
  ],
  template: `
    <div class="header">
      <h1>Staff</h1>
      <button mat-flat-button color="primary" (click)="onAddStaff()">
        <mat-icon>person_add</mat-icon>
        Add Staff
      </button>
    </div>

    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else {
      <table mat-table [dataSource]="users()" class="staff-table">
        <ng-container matColumnDef="displayName">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let u">{{ u.displayName }}</td>
        </ng-container>

        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Email</th>
          <td mat-cell *matCellDef="let u">{{ u.email }}</td>
        </ng-container>

        <ng-container matColumnDef="roles">
          <th mat-header-cell *matHeaderCellDef>Roles</th>
          <td mat-cell *matCellDef="let u">
            @for (role of u.roles; track role) {
              <mat-chip>{{ role }}</mat-chip>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let u">
            <button mat-icon-button (click)="onEditStaff(u)" matTooltip="Edit">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button (click)="onResetPin(u)" matTooltip="Reset PIN">
              <mat-icon>pin</mat-icon>
            </button>
            <button mat-icon-button color="warn" (click)="onDeleteStaff(u)" matTooltip="Delete">
              <mat-icon>delete</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>

      @if (users().length === 0) {
        <p class="empty">No staff members found.</p>
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
      .staff-table {
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
    `,
  ],
})
export class StaffPage implements OnInit {
  private readonly client = inject(CLIENT_TOKEN) as IClient;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly users = signal<UserDto[]>([]);
  readonly loading = signal(false);
  readonly columns = ['displayName', 'email', 'roles', 'actions'];

  async ngOnInit() {
    await this.loadUsers();
  }

  private async loadUsers() {
    this.loading.set(true);
    try {
      const users = await firstValueFrom(this.client.auth_GetUsers());
      this.users.set(users);
    } finally {
      this.loading.set(false);
    }
  }

  onAddStaff(): void {
    const ref = this.dialog.open(RegisterStaffDialogComponent, { width: '400px' });
    ref.afterClosed().subscribe(async (result: RegisterDto | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.auth_Register(result));
        this.snackBar.open('Staff member added.', 'OK', { duration: 3000 });
        await this.loadUsers();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to add staff member.';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      }
    });
  }

  onEditStaff(user: UserDto): void {
    const ref = this.dialog.open(EditStaffDialogComponent, {
      data: { user },
      width: '400px',
    });
    ref.afterClosed().subscribe(async (result: UpdateUserDto | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.auth_UpdateUser(user.id!, result));
        this.snackBar.open('Staff member updated.', 'OK', { duration: 3000 });
        await this.loadUsers();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update staff member.';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      }
    });
  }

  onResetPin(user: UserDto): void {
    const ref = this.dialog.open(ResetPinDialogComponent, {
      data: { user },
      width: '360px',
    });
    ref.afterClosed().subscribe(async (result: ResetPinDto | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.auth_ResetPin(user.id!, result));
        this.snackBar.open('PIN reset.', 'OK', { duration: 3000 });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reset PIN.';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      }
    });
  }

  async onDeleteStaff(user: UserDto): Promise<void> {
    if (!confirm(`Delete staff member "${user.displayName}"? This cannot be undone.`)) return;
    try {
      await firstValueFrom(this.client.auth_DeleteUser(user.id!));
      this.snackBar.open('Staff member deleted.', 'OK', { duration: 3000 });
      await this.loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete staff member.';
      this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
    }
  }
}
