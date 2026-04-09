import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { UpdateUserDto, UserDto } from 'api-client';

export interface EditStaffDialogData {
  user: UserDto;
}

@Component({
  selector: 'app-edit-staff-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit Staff Member</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Display Name</mat-label>
        <input matInput [(ngModel)]="displayName" required />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email</mat-label>
        <input matInput type="email" [(ngModel)]="email" required />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Role</mat-label>
        <mat-select [(ngModel)]="role">
          <mat-option value="Cashier">Cashier</mat-option>
          <mat-option value="Manager">Manager</mat-option>
          <mat-option value="Admin">Admin</mat-option>
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!displayName().trim() || !email().trim()"
        (click)="onSave()"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class EditStaffDialogComponent {
  private readonly data = inject<EditStaffDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EditStaffDialogComponent>);

  protected readonly displayName = signal(this.data.user.displayName ?? '');
  protected readonly email = signal(this.data.user.email ?? '');
  protected readonly role = signal(this.data.user.roles?.[0] ?? 'Cashier');

  protected onSave(): void {
    const result: UpdateUserDto = {
      displayName: this.displayName().trim(),
      email: this.email().trim(),
      role: this.role(),
    };
    this.dialogRef.close(result);
  }
}
