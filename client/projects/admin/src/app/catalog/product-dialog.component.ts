import { Component, inject, signal, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CLIENT_TOKEN, IClient, ProductDto, CategoryDto } from 'api-client';

export interface ProductDialogData {
  product?: ProductDto;
}

export interface ProductDialogResult {
  name: string;
  description: string | null;
  basePrice: number;
  categoryId: number;
  sortOrder: number;
  isAvailable: boolean;
  taxRate: number | null;
  barcode: string | null;
  sku: string | null;
  imageUrl: string | null;
}

@Component({
  selector: 'app-product-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.product ? 'Edit Product' : 'New Product' }}</h2>
    <mat-dialog-content class="dialog-content">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="name" required />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description</mat-label>
        <input matInput [(ngModel)]="description" />
      </mat-form-field>
      <div class="row">
        <mat-form-field appearance="outline" class="flex-field">
          <mat-label>Price (VAT incl.)</mat-label>
          <input matInput type="number" min="0" step="0.01" [(ngModel)]="basePrice" required />
        </mat-form-field>
        <mat-form-field appearance="outline" class="flex-field">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="categoryId" required>
            @for (cat of categories(); track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
      <div class="row">
        <mat-form-field appearance="outline" class="flex-field">
          <mat-label>Sort Order</mat-label>
          <input matInput type="number" [(ngModel)]="sortOrder" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="flex-field">
          <mat-label>Tax Rate Override</mat-label>
          <input
            matInput
            type="number"
            min="0"
            max="1"
            step="0.01"
            [(ngModel)]="taxRate"
            placeholder="Leave blank for default"
          />
        </mat-form-field>
      </div>
      <div class="row">
        <mat-form-field appearance="outline" class="flex-field">
          <mat-label>Barcode</mat-label>
          <input matInput [(ngModel)]="barcode" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="flex-field">
          <mat-label>SKU</mat-label>
          <input matInput [(ngModel)]="sku" />
        </mat-form-field>
      </div>
      <mat-slide-toggle [(ngModel)]="isAvailable">Available</mat-slide-toggle>
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
    `,
  ],
})
export class ProductDialogComponent implements OnInit {
  protected readonly data = inject<ProductDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProductDialogComponent>);
  private readonly client = inject(CLIENT_TOKEN) as IClient;

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly name = signal(this.data.product?.name ?? '');
  protected readonly description = signal(this.data.product?.description ?? '');
  protected readonly basePrice = signal(this.data.product?.basePrice ?? 0);
  protected readonly categoryId = signal(this.data.product?.categoryId ?? 0);
  protected readonly sortOrder = signal(this.data.product?.sortOrder ?? 0);
  protected readonly isAvailable = signal(this.data.product?.isAvailable ?? true);
  protected readonly taxRate = signal<number | null>(this.data.product?.taxRate ?? null);
  protected readonly barcode = signal(this.data.product?.barcode ?? '');
  protected readonly sku = signal(this.data.product?.sku ?? '');

  async ngOnInit() {
    const cats = await firstValueFrom(this.client.categories_GetCategories(false));
    this.categories.set(cats);
  }

  protected canSave(): boolean {
    return this.name().trim().length > 0 && this.categoryId() > 0 && this.basePrice() > 0;
  }

  protected onSave(): void {
    const result: ProductDialogResult = {
      name: this.name().trim(),
      description: this.description().trim() || null,
      basePrice: this.basePrice(),
      categoryId: this.categoryId(),
      sortOrder: this.sortOrder(),
      isAvailable: this.isAvailable(),
      taxRate: this.taxRate() || null,
      barcode: this.barcode().trim() || null,
      sku: this.sku().trim() || null,
      imageUrl: this.data.product?.imageUrl ?? null,
    };
    this.dialogRef.close(result);
  }
}
