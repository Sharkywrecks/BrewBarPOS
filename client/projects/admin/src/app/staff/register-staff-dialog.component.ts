import { Component, computed, inject, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
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
    MatIconModule,
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
        <input
          matInput
          [type]="showPassword() ? 'text' : 'password'"
          [(ngModel)]="password"
          required
        />
        <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
          <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        @if (password() && passwordErrors().length) {
          <mat-error>{{ passwordErrors()[0] }}</mat-error>
        }
        <mat-hint>Min 8 chars, lowercase, digit, and special character</mat-hint>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>PIN (4-6 digits)</mat-label>
        <input matInput [(ngModel)]="pin" maxlength="6" pattern="[0-9]*" />
        @if (pin() && !pinValid()) {
          <mat-error>PIN must be 4-6 digits</mat-error>
        }
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
      <button mat-flat-button color="primary" [disabled]="!formValid()" (click)="onSave()">
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
  protected readonly showPassword = signal(false);
  protected readonly pin = signal('');
  protected readonly role = signal('Cashier');

  protected readonly passwordErrors = computed(() => {
    const pw = this.password();
    if (!pw) return [];
    const errors: string[] = [];
    if (pw.length < 8) errors.push('Must be at least 8 characters');
    if (!/[a-z]/.test(pw)) errors.push('Must contain a lowercase letter');
    if (!/\d/.test(pw)) errors.push('Must contain a digit');
    if (!/[^a-zA-Z0-9]/.test(pw)) errors.push('Must contain a special character');
    return errors;
  });

  protected readonly pinValid = computed(() => {
    const p = this.pin();
    return !p || /^\d{4,6}$/.test(p);
  });

  protected readonly formValid = computed(
    () =>
      this.displayName().trim().length > 0 &&
      this.email().trim().length > 0 &&
      this.password().length > 0 &&
      this.passwordErrors().length === 0 &&
      this.pinValid(),
  );

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
