import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { CategoryDto } from 'api-client';

export interface CategoryDialogData {
  category?: CategoryDto;
}

export interface CategoryDialogResult {
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

@Component({
  selector: 'app-category-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.category ? 'Edit Category' : 'New Category' }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="name" required />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description</mat-label>
        <input matInput [(ngModel)]="description" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Sort Order</mat-label>
        <input matInput type="number" [(ngModel)]="sortOrder" />
      </mat-form-field>
      <mat-slide-toggle [(ngModel)]="isActive">Active</mat-slide-toggle>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!name().trim()" (click)="onSave()">
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
export class CategoryDialogComponent {
  protected readonly data = inject<CategoryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CategoryDialogComponent>);

  protected readonly name = signal(this.data.category?.name ?? '');
  protected readonly description = signal(this.data.category?.description ?? '');
  protected readonly sortOrder = signal(this.data.category?.sortOrder ?? 0);
  protected readonly isActive = signal(this.data.category?.isActive ?? true);

  protected onSave(): void {
    const result: CategoryDialogResult = {
      name: this.name().trim(),
      description: this.description().trim() || null,
      sortOrder: this.sortOrder(),
      isActive: this.isActive(),
    };
    this.dialogRef.close(result);
  }
}
