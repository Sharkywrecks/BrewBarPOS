import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CategoryDto, ProductDto, IClient, CLIENT_TOKEN } from 'api-client';
import { firstValueFrom } from 'rxjs';
import { MenuService } from '../services/menu.service';
import { SettingsService } from '../services/settings.service';
import { CartStore } from '../store/cart.store';
import { CartLineItem } from '../store/cart.models';
import { CategoryBarComponent } from './category-bar.component';
import { ProductGridComponent } from './product-grid.component';
import { OrderSidebarComponent } from './order-sidebar.component';
import { ModifierSheetComponent, ModifierSheetData } from './modifier-sheet.component';
import { OrderNotesDialog, OrderNotesDialogData } from './order-notes.dialog';
import { BarcodeInputComponent } from './barcode-input.component';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    CategoryBarComponent,
    ProductGridComponent,
    OrderSidebarComponent,
    BarcodeInputComponent,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="register-layout">
      <div class="menu-pane">
        @if (menu.loading() && menu.categories().length === 0) {
          <div class="loading">
            <mat-spinner diameter="48"></mat-spinner>
          </div>
        } @else {
          <app-barcode-input (barcodeScanned)="onBarcodeScanned($event)" />
          <app-category-bar
            [categories]="menu.categories()"
            [selectedIndex]="selectedCategoryIndex()"
            (categorySelected)="onCategorySelected($event)"
          />
          <app-product-grid
            [products]="currentProducts()"
            (productSelected)="onProductSelected($event)"
          />
        }
      </div>
      <div class="sidebar-pane">
        <app-order-sidebar (pay)="onPay()" (notesRequested)="onNotesRequested()" />
      </div>
    </div>
  `,
  styles: [
    `
      .register-layout {
        display: flex;
        height: 100%;
      }
      .menu-pane {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .sidebar-pane {
        width: 360px;
        flex-shrink: 0;
      }
      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
      }
    `,
  ],
})
export class RegisterPage implements OnInit {
  protected readonly menu = inject(MenuService);
  private readonly cart = inject(CartStore);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly client = inject<IClient>(CLIENT_TOKEN);

  protected readonly selectedCategoryIndex = signal(0);
  protected readonly loadError = signal(false);

  protected currentProducts = signal<ProductDto[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      await this.menu.loadCategories();
      this.updateProducts();
    } catch {
      this.loadError.set(true);
      this.snackBar
        .open('Failed to load menu. Check your connection and try again.', 'Retry', {
          duration: 0,
        })
        .onAction()
        .subscribe(() => this.ngOnInit());
    }
  }

  async onCategorySelected(cat: CategoryDto): Promise<void> {
    const cats = this.menu.categories();
    this.selectedCategoryIndex.set(cats.findIndex((c) => c.id === cat.id));
    try {
      await this.menu.selectCategory(cat.id!);
      this.updateProducts();
    } catch {
      this.snackBar.open('Failed to load category.', 'Dismiss', { duration: 3000 });
    }
  }

  onProductSelected(product: ProductDto): void {
    const hasVariants = product.variants && product.variants.length > 0;
    const hasModifiers = (product.modifiers?.length ?? 0) > 0;

    if (!hasVariants && !hasModifiers) {
      // Add directly to cart
      const item: CartLineItem = {
        localId: crypto.randomUUID(),
        productId: product.id!,
        productName: product.name!,
        variantName: null,
        unitPrice: product.basePrice!,
        quantity: 1,
        taxRate: product.taxRate ?? this.settingsService.taxRate,
        discountAmount: 0,
        discountType: null,
        discountPercent: null,
        discountReason: null,
        modifierItems: [],
      };
      this.cart.addItem(item);
      return;
    }

    // Open modifier dialog (centered)
    const ref = this.dialog.open<ModifierSheetComponent, ModifierSheetData, CartLineItem>(
      ModifierSheetComponent,
      {
        data: { product },
        panelClass: 'modifier-sheet-panel',
        autoFocus: false,
      },
    );

    ref.afterClosed().subscribe((result: CartLineItem | undefined) => {
      if (result) {
        this.cart.addItem(result);
      }
    });
  }

  onPay(): void {
    this.router.navigate(['/checkout']);
  }

  onNotesRequested(): void {
    const ref = this.dialog.open(OrderNotesDialog, {
      data: { notes: this.cart.notes() } as OrderNotesDialogData,
      width: '400px',
    });

    ref.afterClosed().subscribe((result: string | null | undefined) => {
      if (result !== undefined) {
        this.cart.updateNotes(result);
      }
    });
  }

  async onBarcodeScanned(barcode: string): Promise<void> {
    try {
      const product = await firstValueFrom(this.client.products_LookupProduct(barcode, undefined));
      if (product) {
        this.onProductSelected(product);
      }
    } catch {
      this.snackBar.open(`Product not found: ${barcode}`, 'Dismiss', { duration: 3000 });
    }
  }

  private updateProducts(): void {
    const cat = this.menu.selectedCategory();
    this.currentProducts.set(cat?.products ?? []);
  }
}
