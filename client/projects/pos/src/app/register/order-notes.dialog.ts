import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

export interface OrderNotesDialogData {
  notes: string | null;
}

@Component({
  selector: 'app-order-notes-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>Order Notes</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="notes-field">
        <mat-label>Notes</mat-label>
        <textarea
          matInput
          [(ngModel)]="notes"
          rows="4"
          placeholder="Add special instructions..."
        ></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="onSave()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .notes-field {
        width: 100%;
        min-width: 320px;
      }
    `,
  ],
})
export class OrderNotesDialog {
  private readonly dialogRef = inject(MatDialogRef<OrderNotesDialog>);
  private readonly data = inject<OrderNotesDialogData>(MAT_DIALOG_DATA);

  protected notes = this.data.notes ?? '';

  onSave(): void {
    this.dialogRef.close(this.notes || null);
  }
}
