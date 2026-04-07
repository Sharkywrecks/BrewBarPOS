import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatBottomSheet, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryDto, ProductDto } from 'api-client';
import { MenuService } from '../services/menu.service';
import { CartStore } from '../store/cart.store';
import { CartLineItem } from '../store/cart.models';
import { CategoryBarComponent } from './category-bar.component';
import { ProductGridComponent } from './product-grid.component';
import { OrderSidebarComponent } from './order-sidebar.component';
import { ModifierSheetComponent, ModifierSheetData } from './modifier-sheet.component';
import { OrderNotesDialog, OrderNotesDialogData } from './order-notes.dialog';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    CategoryBarComponent,
    ProductGridComponent,
    OrderSidebarComponent,
    MatBottomSheetModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="register-layout">
      <div class="menu-pane">
        @if (menu.loading() && menu.categories().length === 0) {
          <div class="loading">
            <mat-spinner diameter="48"></mat-spinner>
          </div>
        } @else {
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
  private readonly router = inject(Router);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly dialog = inject(MatDialog);

  protected readonly selectedCategoryIndex = signal(0);

  protected currentProducts = signal<ProductDto[]>([]);

  async ngOnInit(): Promise<void> {
    await this.menu.loadCategories();
    this.updateProducts();
  }

  async onCategorySelected(cat: CategoryDto): Promise<void> {
    const cats = this.menu.categories();
    this.selectedCategoryIndex.set(cats.findIndex((c) => c.id === cat.id));
    await this.menu.selectCategory(cat.id!);
    this.updateProducts();
  }

  onProductSelected(product: ProductDto): void {
    const hasVariants = product.variants && product.variants.length > 0;
    const hasRequiredModifiers = product.modifiers?.some((m) => m.isRequired);

    if (!hasVariants && !hasRequiredModifiers) {
      // Add directly to cart
      const item: CartLineItem = {
        localId: crypto.randomUUID(),
        productId: product.id!,
        productName: product.name!,
        variantName: null,
        unitPrice: product.basePrice!,
        quantity: 1,
        modifierItems: [],
      };
      this.cart.addItem(item);
      return;
    }

    // Open modifier sheet
    const ref = this.bottomSheet.open(ModifierSheetComponent, {
      data: { product } as ModifierSheetData,
      panelClass: 'modifier-sheet-panel',
    });

    ref.afterDismissed().subscribe((result: CartLineItem | undefined) => {
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

  private updateProducts(): void {
    const cat = this.menu.selectedCategory();
    this.currentProducts.set(cat?.products ?? []);
  }
}
