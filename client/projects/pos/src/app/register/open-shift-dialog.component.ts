import { Component, signal, computed } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-open-shift-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Open Register</h2>
    <mat-dialog-content>
      <p>Enter the opening cash amount in the drawer.</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Opening Cash Amount</mat-label>
        <input
          matInput
          type="number"
          min="0"
          step="0.01"
          [ngModel]="amount()"
          (ngModelChange)="amount.set($event)"
        />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" [disabled]="!canOpen()" (click)="onOpen()">
        Open Shift
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
export class OpenShiftDialogComponent {
  protected readonly amount = signal<number>(0);
  protected readonly canOpen = computed(() => this.amount() >= 0);

  constructor(private readonly dialogRef: MatDialogRef<OpenShiftDialogComponent>) {}

  protected onOpen(): void {
    this.dialogRef.close(this.amount());
  }
}
