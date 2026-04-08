import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { ModifierDto } from 'api-client';

export interface ModifierDialogData {
  modifier?: ModifierDto;
}

export interface ModifierOptionInput {
  id?: number;
  name: string;
  price: number;
  sortOrder: number;
}

export interface ModifierDialogResult {
  name: string;
  isRequired: boolean;
  allowMultiple: boolean;
  sortOrder: number;
  options: ModifierOptionInput[];
}

@Component({
  selector: 'app-modifier-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.modifier ? 'Edit Modifier' : 'New Modifier' }}</h2>
    <mat-dialog-content class="dialog-content">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="name" required />
      </mat-form-field>
      <div class="row">
        <mat-form-field appearance="outline" class="flex-field">
          <mat-label>Sort Order</mat-label>
          <input matInput type="number" [(ngModel)]="sortOrder" />
        </mat-form-field>
      </div>
      <div class="toggles">
        <mat-slide-toggle [(ngModel)]="isRequired">Required</mat-slide-toggle>
        <mat-slide-toggle [(ngModel)]="allowMultiple">Allow Multiple</mat-slide-toggle>
      </div>

      <h3>Options</h3>
      @for (opt of options(); track $index) {
        <div class="option-row">
          <mat-form-field appearance="outline" class="flex-field">
            <mat-label>Option Name</mat-label>
            <input
              matInput
              [ngModel]="opt.name"
              (ngModelChange)="updateOption($index, 'name', $event)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" class="price-field">
            <mat-label>Price</mat-label>
            <input
              matInput
              type="number"
              min="0"
              step="0.01"
              [ngModel]="opt.price"
              (ngModelChange)="updateOption($index, 'price', $event)"
            />
          </mat-form-field>
          <button mat-icon-button color="warn" (click)="removeOption($index)">
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      }
      <button mat-stroked-button (click)="addOption()"><mat-icon>add</mat-icon> Add Option</button>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!canSave()" (click)="onSave()">
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-content {
        min-width: 480px;
      }
      .full-width {
        width: 100%;
      }
      .row {
        display: flex;
        gap: 12px;
      }
      .flex-field {
        flex: 1;
      }
      .price-field {
        width: 120px;
      }
      .toggles {
        display: flex;
        gap: 24px;
        margin-bottom: 16px;
      }
      .option-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      h3 {
        margin-top: 16px;
      }
    `,
  ],
})
export class ModifierDialogComponent {
  protected readonly data = inject<ModifierDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ModifierDialogComponent>);

  protected readonly name = signal(this.data.modifier?.name ?? '');
  protected readonly isRequired = signal(this.data.modifier?.isRequired ?? false);
  protected readonly allowMultiple = signal(this.data.modifier?.allowMultiple ?? false);
  protected readonly sortOrder = signal(this.data.modifier?.sortOrder ?? 0);
  protected readonly options = signal<ModifierOptionInput[]>(
    this.data.modifier?.options?.map((o, i) => ({
      id: o.id,
      name: o.name ?? '',
      price: o.price ?? 0,
      sortOrder: i,
    })) ?? [{ name: '', price: 0, sortOrder: 0 }],
  );

  protected addOption(): void {
    this.options.update((opts) => [...opts, { name: '', price: 0, sortOrder: opts.length }]);
  }

  protected removeOption(index: number): void {
    this.options.update((opts) => opts.filter((_, i) => i !== index));
  }

  protected updateOption(index: number, field: 'name' | 'price', value: string | number): void {
    this.options.update((opts) => opts.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  protected canSave(): boolean {
    return this.name().trim().length > 0 && this.options().some((o) => o.name.trim().length > 0);
  }

  protected onSave(): void {
    const result: ModifierDialogResult = {
      name: this.name().trim(),
      isRequired: this.isRequired(),
      allowMultiple: this.allowMultiple(),
      sortOrder: this.sortOrder(),
      options: this.options().filter((o) => o.name.trim().length > 0),
    };
    this.dialogRef.close(result);
  }
}
