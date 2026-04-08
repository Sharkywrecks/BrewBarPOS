import { Component, signal, computed } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

export interface CloseShiftResult {
  closingCashAmount: number;
  notes: string | null;
}

@Component({
  selector: 'app-close-shift-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Close Register</h2>
    <mat-dialog-content>
      <p>Count the cash in the drawer and enter the amount below.</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Cash in Drawer</mat-label>
        <input
          matInput
          type="number"
          min="0"
          step="0.01"
          [ngModel]="amount()"
          (ngModelChange)="amount.set($event)"
        />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Notes (optional)</mat-label>
        <input matInput [ngModel]="notes()" (ngModelChange)="notes.set($event)" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!canClose()" (click)="onClose()">
        Close Shift
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
export class CloseShiftDialogComponent {
  protected readonly amount = signal<number>(0);
  protected readonly notes = signal<string>('');
  protected readonly canClose = computed(() => this.amount() >= 0);

  constructor(private readonly dialogRef: MatDialogRef<CloseShiftDialogComponent>) {}

  protected onClose(): void {
    const result: CloseShiftResult = {
      closingCashAmount: this.amount(),
      notes: this.notes().trim() || null,
    };
    this.dialogRef.close(result);
  }
}
