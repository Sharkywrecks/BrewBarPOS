import { Component, inject, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { RegisterDto } from 'api-client';

@Component({
  selector: 'app-register-staff-dialog',
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
    <h2 mat-dialog-title>Add Staff Member</h2>
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
        <mat-label>Password</mat-label>
        <input matInput type="password" [(ngModel)]="password" required />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>PIN (4-6 digits)</mat-label>
        <input matInput [(ngModel)]="pin" maxlength="6" />
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
        [disabled]="!displayName().trim() || !email().trim() || !password().trim()"
        (click)="onSave()"
      >
        Add
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
export class RegisterStaffDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RegisterStaffDialogComponent>);

  protected readonly displayName = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly pin = signal('');
  protected readonly role = signal('Cashier');

  protected onSave(): void {
    const result: RegisterDto = {
      displayName: this.displayName().trim(),
      email: this.email().trim(),
      password: this.password(),
      pin: this.pin().trim() || null,
      role: this.role(),
    };
    this.dialogRef.close(result);
  }
}
