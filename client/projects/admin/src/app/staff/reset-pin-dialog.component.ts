import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ResetPinDto, UserDto } from 'api-client';

export interface ResetPinDialogData {
  user: UserDto;
}

@Component({
  selector: 'app-reset-pin-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Reset PIN — {{ data.user.displayName }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>New PIN (4-6 digits)</mat-label>
        <input
          matInput
          [(ngModel)]="pin"
          inputmode="numeric"
          maxlength="6"
          autocomplete="off"
          required
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!isValid()" (click)="onSave()">
        Reset
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
export class ResetPinDialogComponent {
  protected readonly data = inject<ResetPinDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ResetPinDialogComponent>);

  protected readonly pin = signal('');

  protected isValid(): boolean {
    const v = this.pin().trim();
    return /^\d{4,6}$/.test(v);
  }

  protected onSave(): void {
    const result: ResetPinDto = { pin: this.pin().trim() };
    this.dialogRef.close(result);
  }
}
