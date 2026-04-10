import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TerminalDto } from 'api-client';

export interface TerminalDialogData {
  mode: 'create' | 'edit';
  terminal?: TerminalDto;
}

@Component({
  selector: 'app-terminal-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'create' ? 'Add Terminal' : 'Edit Terminal' }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Terminal Name</mat-label>
        <input matInput [(ngModel)]="name" required />
      </mat-form-field>

      @if (data.mode === 'edit') {
        <mat-slide-toggle [(ngModel)]="isActive" class="toggle">Active</mat-slide-toggle>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!name.trim()" (click)="onSave()">
        {{ data.mode === 'create' ? 'Add' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .toggle {
        margin-top: 8px;
      }
    `,
  ],
})
export class TerminalDialogComponent {
  readonly data = inject<TerminalDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TerminalDialogComponent>);

  name = this.data.terminal?.name ?? '';
  isActive = this.data.terminal?.isActive ?? true;

  onSave(): void {
    if (!this.name.trim()) return;

    if (this.data.mode === 'create') {
      this.dialogRef.close({ name: this.name.trim() });
    } else {
      this.dialogRef.close({
        name: this.name.trim(),
        isActive: this.isActive,
        configJson: this.data.terminal?.configJson ?? null,
      });
    }
  }
}
