import { Component, inject, signal, OnInit } from '@angular/core';
import { AppCurrencyPipe } from 'ui';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  CLIENT_TOKEN,
  IClient,
  CategoryDto,
  ProductDto,
  ModifierDto,
  PaginationOfProductDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  CreateModifierDto,
  UpdateModifierDto,
  extractApiError,
} from 'api-client';
import { firstValueFrom } from 'rxjs';
import { CategoryDialogComponent, CategoryDialogResult } from './category-dialog.component';
import { ProductDialogComponent, ProductDialogResult } from './product-dialog.component';
import {
  ModifierDialogComponent,
  ModifierDialogResult,
  ModifierOptionInput,
} from './modifier-dialog.component';
import { ProductModifiersDialogComponent } from './product-modifiers-dialog.component';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    AppCurrencyPipe,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <div class="header">
      <h1>Catalog</h1>
    </div>

    <mat-tab-group>
      <!-- Categories Tab -->
      <mat-tab label="Categories">
        <div class="tab-header">
          <button mat-flat-button color="primary" (click)="onNewCategory()">
            <mat-icon>add</mat-icon> New Category
          </button>
        </div>
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

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let cat">
                <button mat-icon-button (click)="onEditCategory(cat)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="onDeleteCategory(cat)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="categoryColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: categoryColumns"></tr>
          </table>
        }
      </mat-tab>

      <!-- Products Tab -->
      <mat-tab label="Products">
        <div class="tab-header">
          <button mat-flat-button color="primary" (click)="onNewProduct()">
            <mat-icon>add</mat-icon> New Product
          </button>
        </div>
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
              <td mat-cell *matCellDef="let p">{{ p.basePrice | appCurrency }}</td>
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

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let p">
                <button mat-icon-button (click)="onEditProduct(p)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button (click)="onManageModifiers(p)">
                  <mat-icon>tune</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="onDeleteProduct(p)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="productColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: productColumns"></tr>
          </table>
        }
      </mat-tab>

      <!-- Modifiers Tab -->
      <mat-tab label="Modifiers">
        <div class="tab-header">
          <button mat-flat-button color="primary" (click)="onNewModifier()">
            <mat-icon>add</mat-icon> New Modifier
          </button>
        </div>
        @if (loadingModifiers()) {
          <mat-spinner diameter="32" class="spinner"></mat-spinner>
        } @else {
          <table mat-table [dataSource]="modifiers()" class="catalog-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let m">{{ m.name }}</td>
            </ng-container>

            <ng-container matColumnDef="required">
              <th mat-header-cell *matHeaderCellDef>Required</th>
              <td mat-cell *matCellDef="let m">{{ m.isRequired ? 'Yes' : 'No' }}</td>
            </ng-container>

            <ng-container matColumnDef="allowMultiple">
              <th mat-header-cell *matHeaderCellDef>Allow Multiple</th>
              <td mat-cell *matCellDef="let m">{{ m.allowMultiple ? 'Yes' : 'No' }}</td>
            </ng-container>

            <ng-container matColumnDef="options">
              <th mat-header-cell *matHeaderCellDef>Options</th>
              <td mat-cell *matCellDef="let m">{{ m.options?.length ?? 0 }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let m">
                <button mat-icon-button (click)="onEditModifier(m)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="onDeleteModifier(m)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="modifierColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: modifierColumns"></tr>
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
      .tab-header {
        display: flex;
        justify-content: flex-end;
        padding: 12px 0;
      }
      .catalog-table {
        width: 100%;
      }
      .spinner {
        margin: 32px auto;
      }
    `,
  ],
})
export class CatalogPage implements OnInit {
  private readonly client = inject(CLIENT_TOKEN) as IClient;
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly categories = signal<CategoryDto[]>([]);
  readonly products = signal<ProductDto[]>([]);
  readonly modifiers = signal<ModifierDto[]>([]);
  readonly loadingCategories = signal(false);
  readonly loadingProducts = signal(false);
  readonly loadingModifiers = signal(false);

  readonly categoryColumns = ['name', 'productCount', 'sortOrder', 'status', 'actions'];
  readonly productColumns = ['name', 'category', 'basePrice', 'variants', 'status', 'actions'];
  readonly modifierColumns = ['name', 'required', 'allowMultiple', 'options', 'actions'];

  async ngOnInit() {
    await Promise.all([this.loadCategories(), this.loadProducts(), this.loadModifiers()]);
  }

  // --- Categories ---

  onNewCategory(): void {
    const ref = this.dialog.open(CategoryDialogComponent, {
      data: {},
      width: '400px',
    });
    ref.afterClosed().subscribe(async (result: CategoryDialogResult | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.categories_CreateCategory(result as CreateCategoryDto));
        this.snackBar.open('Category created.', 'OK', { duration: 3000 });
        await this.loadCategories();
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to create category.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }

  onEditCategory(cat: CategoryDto): void {
    const ref = this.dialog.open(CategoryDialogComponent, {
      data: { category: cat },
      width: '400px',
    });
    ref.afterClosed().subscribe(async (result: CategoryDialogResult | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(
          this.client.categories_UpdateCategory(cat.id!, result as UpdateCategoryDto),
        );
        this.snackBar.open('Category updated.', 'OK', { duration: 3000 });
        await this.loadCategories();
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to update category.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }

  async onDeleteCategory(cat: CategoryDto): Promise<void> {
    if (
      !confirm(
        `Delete category "${cat.name}"? This will also delete all products in this category.`,
      )
    )
      return;
    try {
      await firstValueFrom(this.client.categories_DeleteCategory(cat.id!));
      this.snackBar.open('Category deleted.', 'OK', { duration: 3000 });
      await Promise.all([this.loadCategories(), this.loadProducts()]);
    } catch (err: unknown) {
      this.snackBar.open(extractApiError(err, 'Failed to delete category.'), 'Dismiss', {
        duration: 5000,
      });
    }
  }

  // --- Products ---

  onNewProduct(): void {
    const ref = this.dialog.open(ProductDialogComponent, {
      data: {},
      width: '560px',
    });
    ref.afterClosed().subscribe(async (result: ProductDialogResult | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.products_CreateProduct(result as CreateProductDto));
        this.snackBar.open('Product created.', 'OK', { duration: 3000 });
        await this.loadProducts();
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to create product.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }

  onEditProduct(p: ProductDto): void {
    const ref = this.dialog.open(ProductDialogComponent, {
      data: { product: p },
      width: '560px',
    });
    ref.afterClosed().subscribe(async (result: ProductDialogResult | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(this.client.products_UpdateProduct(p.id!, result as UpdateProductDto));
        this.snackBar.open('Product updated.', 'OK', { duration: 3000 });
        await this.loadProducts();
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to update product.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }

  async onDeleteProduct(p: ProductDto): Promise<void> {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try {
      await firstValueFrom(this.client.products_DeleteProduct(p.id!));
      this.snackBar.open('Product deleted.', 'OK', { duration: 3000 });
      await this.loadProducts();
    } catch (err: unknown) {
      this.snackBar.open(extractApiError(err, 'Failed to delete product.'), 'Dismiss', {
        duration: 5000,
      });
    }
  }

  onManageModifiers(p: ProductDto): void {
    this.dialog.open(ProductModifiersDialogComponent, {
      data: { product: p },
      width: '400px',
    });
  }

  // --- Modifiers ---

  onNewModifier(): void {
    const ref = this.dialog.open(ModifierDialogComponent, {
      data: {},
      width: '560px',
    });
    ref.afterClosed().subscribe(async (result: ModifierDialogResult | undefined) => {
      if (!result) return;
      try {
        const created = await firstValueFrom(
          this.client.modifiers_CreateModifier({
            name: result.name,
            isRequired: result.isRequired,
            allowMultiple: result.allowMultiple,
            sortOrder: result.sortOrder,
          } as CreateModifierDto),
        );
        // Create options
        for (const opt of result.options) {
          await firstValueFrom(
            this.client.modifiers_CreateOption(created.id!, {
              name: opt.name,
              price: opt.price,
              sortOrder: opt.sortOrder,
            }),
          );
        }
        this.snackBar.open('Modifier created.', 'OK', { duration: 3000 });
        await this.loadModifiers();
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to create modifier.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }

  onEditModifier(m: ModifierDto): void {
    const ref = this.dialog.open(ModifierDialogComponent, {
      data: { modifier: m },
      width: '560px',
    });
    ref.afterClosed().subscribe(async (result: ModifierDialogResult | undefined) => {
      if (!result) return;
      try {
        await firstValueFrom(
          this.client.modifiers_UpdateModifier(m.id!, {
            name: result.name,
            isRequired: result.isRequired,
            allowMultiple: result.allowMultiple,
            sortOrder: result.sortOrder,
          } as UpdateModifierDto),
        );
        // Sync options: delete removed, update existing, create new
        const existingIds = new Set(result.options.filter((o) => o.id).map((o) => o.id!));
        for (const oldOpt of m.options ?? []) {
          if (!existingIds.has(oldOpt.id!)) {
            await firstValueFrom(this.client.modifiers_DeleteOption(m.id!, oldOpt.id!));
          }
        }
        for (const opt of result.options) {
          if (opt.id) {
            await firstValueFrom(
              this.client.modifiers_UpdateOption(m.id!, opt.id, {
                name: opt.name,
                price: opt.price,
                sortOrder: opt.sortOrder,
              }),
            );
          } else {
            await firstValueFrom(
              this.client.modifiers_CreateOption(m.id!, {
                name: opt.name,
                price: opt.price,
                sortOrder: opt.sortOrder,
              }),
            );
          }
        }
        this.snackBar.open('Modifier updated.', 'OK', { duration: 3000 });
        await this.loadModifiers();
      } catch (err: unknown) {
        this.snackBar.open(extractApiError(err, 'Failed to update modifier.'), 'Dismiss', {
          duration: 5000,
        });
      }
    });
  }

  async onDeleteModifier(m: ModifierDto): Promise<void> {
    if (!confirm(`Delete modifier "${m.name}" and all its options?`)) return;
    try {
      await firstValueFrom(this.client.modifiers_DeleteModifier(m.id!));
      this.snackBar.open('Modifier deleted.', 'OK', { duration: 3000 });
      await this.loadModifiers();
    } catch (err: unknown) {
      this.snackBar.open(extractApiError(err, 'Failed to delete modifier.'), 'Dismiss', {
        duration: 5000,
      });
    }
  }

  // --- Data Loading ---

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

  private async loadModifiers() {
    this.loadingModifiers.set(true);
    try {
      const mods = await firstValueFrom(this.client.modifiers_GetModifiers());
      this.modifiers.set(mods);
    } finally {
      this.loadingModifiers.set(false);
    }
  }
}
