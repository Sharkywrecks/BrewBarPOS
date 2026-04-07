import { Component, inject, signal, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { CLIENT_TOKEN, IClient, CategoryDto, ProductDto, PaginationOfProductDto } from 'api-client';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTabsModule,
  ],
  template: `
    <div class="header">
      <h1>Catalog</h1>
    </div>

    <mat-tab-group>
      <mat-tab label="Categories">
        @if (loadingCategories()) {
          <mat-spinner diameter="32" class="spinner"></mat-spinner>
        } @else {
          <table mat-table [dataSource]="categories()" class="catalog-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let cat">{{ cat.name }}</td>
            </ng-container>

            <ng-container matColumnDef="productCount">
              <th mat-header-cell *matHeaderCellDef>Products</th>
              <td mat-cell *matCellDef="let cat">{{ cat.productCount }}</td>
            </ng-container>

            <ng-container matColumnDef="sortOrder">
              <th mat-header-cell *matHeaderCellDef>Sort Order</th>
              <td mat-cell *matCellDef="let cat">{{ cat.sortOrder }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let cat">
                <mat-chip [highlighted]="cat.isActive">
                  {{ cat.isActive ? 'Active' : 'Inactive' }}
                </mat-chip>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="categoryColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: categoryColumns"></tr>
          </table>
        }
      </mat-tab>

      <mat-tab label="Products">
        @if (loadingProducts()) {
          <mat-spinner diameter="32" class="spinner"></mat-spinner>
        } @else {
          <table mat-table [dataSource]="products()" class="catalog-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let p">{{ p.name }}</td>
            </ng-container>

            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Category</th>
              <td mat-cell *matCellDef="let p">{{ p.categoryName }}</td>
            </ng-container>

            <ng-container matColumnDef="basePrice">
              <th mat-header-cell *matHeaderCellDef>Price</th>
              <td mat-cell *matCellDef="let p">{{ p.basePrice | currency }}</td>
            </ng-container>

            <ng-container matColumnDef="variants">
              <th mat-header-cell *matHeaderCellDef>Variants</th>
              <td mat-cell *matCellDef="let p">{{ p.variants?.length ?? 0 }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let p">
                <mat-chip [highlighted]="p.isAvailable">
                  {{ p.isAvailable ? 'Available' : 'Unavailable' }}
                </mat-chip>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="productColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: productColumns"></tr>
          </table>
        }
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .catalog-table {
        width: 100%;
        margin-top: 16px;
      }
      .spinner {
        margin: 32px auto;
      }
    `,
  ],
})
export class CatalogPage implements OnInit {
  private readonly client = inject(CLIENT_TOKEN) as IClient;

  readonly categories = signal<CategoryDto[]>([]);
  readonly products = signal<ProductDto[]>([]);
  readonly loadingCategories = signal(false);
  readonly loadingProducts = signal(false);

  readonly categoryColumns = ['name', 'productCount', 'sortOrder', 'status'];
  readonly productColumns = ['name', 'category', 'basePrice', 'variants', 'status'];

  async ngOnInit() {
    await Promise.all([this.loadCategories(), this.loadProducts()]);
  }

  private async loadCategories() {
    this.loadingCategories.set(true);
    try {
      const cats = await firstValueFrom(this.client.categories_GetCategories(false));
      this.categories.set(cats);
    } finally {
      this.loadingCategories.set(false);
    }
  }

  private async loadProducts() {
    this.loadingProducts.set(true);
    try {
      const result: PaginationOfProductDto = await firstValueFrom(
        this.client.products_GetProducts(undefined, false, 0, 200),
      );
      this.products.set(result.data ?? []);
    } finally {
      this.loadingProducts.set(false);
    }
  }
}
