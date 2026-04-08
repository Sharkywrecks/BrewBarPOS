import { Component, signal, computed } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

export interface CashDropResult {
  amount: number;
  reason: string | null;
}

@Component({
  selector: 'app-cash-drop-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Cash Drop</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Amount</mat-label>
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
        <mat-label>Reason (optional)</mat-label>
        <input matInput [ngModel]="reason()" (ngModelChange)="reason.set($event)" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="amount() <= 0" (click)="onDrop()">
        Record Drop
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
export class CashDropDialogComponent {
  protected readonly amount = signal<number>(0);
  protected readonly reason = signal<string>('');

  constructor(private readonly dialogRef: MatDialogRef<CashDropDialogComponent>) {}

  protected onDrop(): void {
    const result: CashDropResult = {
      amount: this.amount(),
      reason: this.reason().trim() || null,
    };
    this.dialogRef.close(result);
  }
}
