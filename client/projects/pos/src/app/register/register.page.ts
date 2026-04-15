import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryDto, ProductDto, IClient, CLIENT_TOKEN, extractApiError } from 'api-client';
import { ConnectivityService } from 'sync';
import { firstValueFrom } from 'rxjs';
import { MenuService } from '../services/menu.service';
import { SettingsService } from '../services/settings.service';
import { ShiftService } from '../services/shift.service';
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
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <div class="register-layout">
      <div class="menu-pane">
        @if (menu.loading() && menu.categories().length === 0) {
          <div class="loading">
            <mat-spinner diameter="48"></mat-spinner>
          </div>
        } @else {
          <!-- Action bar -->
          <div class="action-bar">
            <app-barcode-input
              class="barcode-slot"
              (barcodeScanned)="onBarcodeScanned($event)"
              (searchChanged)="onSearchChanged($event)"
            />

            <div class="action-bar-info">
              @if (shift.currentShift(); as s) {
                <span class="info-chip shift-chip" matTooltip="Shift open">
                  <mat-icon>timer</mat-icon>
                  Shift open
                </span>
              } @else {
                <span class="info-chip no-shift-chip" matTooltip="No active shift">
                  <mat-icon>timer_off</mat-icon>
                  No shift
                </span>
              }

              <span
                class="info-chip connectivity-chip"
                [class.online]="connectivity.isOnline()"
                [class.offline]="!connectivity.isOnline()"
              >
                <mat-icon>{{ connectivity.isOnline() ? 'wifi' : 'wifi_off' }}</mat-icon>
                {{ connectivity.isOnline() ? 'Online' : 'Offline' }}
              </span>

              <span class="clock">{{ currentTime() }}</span>
            </div>
          </div>

          @if (!searchQuery()) {
            <app-category-bar
              [categories]="menu.categories()"
              [selectedIndex]="selectedCategoryIndex()"
              (categorySelected)="onCategorySelected($event)"
            />
          }
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

      /* Action bar */
      .action-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: var(--mat-sys-surface);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .barcode-slot {
        width: 280px;
        flex-shrink: 0;
      }
      .action-bar-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }

      /* Info chips */
      .info-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        padding: 4px 10px 4px 6px;
        border-radius: 20px;
        white-space: nowrap;
        height: 28px;
      }
      .info-chip mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .shift-chip {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
      }
      .no-shift-chip {
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface-variant);
      }
      .connectivity-chip.online {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .connectivity-chip.offline {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      /* Clock */
      .clock {
        font-size: 14px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--mat-sys-on-surface-variant);
        padding: 0 4px;
        min-width: 52px;
        text-align: center;
      }
    `,
  ],
})
export class RegisterPage implements OnInit, OnDestroy {
  protected readonly menu = inject(MenuService);
  private readonly cart = inject(CartStore);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly client = inject<IClient>(CLIENT_TOKEN);
  protected readonly shift = inject(ShiftService);
  protected readonly connectivity = inject(ConnectivityService);

  protected readonly selectedCategoryIndex = signal(0);
  protected readonly loadError = signal(false);
  protected readonly currentTime = signal(this.formatTime());
  protected readonly searchQuery = signal('');

  protected currentProducts = signal<ProductDto[]>([]);

  private clockInterval: ReturnType<typeof setInterval> | null = null;

  private formatTime(): string {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async ngOnInit(): Promise<void> {
    this.clockInterval = setInterval(() => this.currentTime.set(this.formatTime()), 15_000);
    try {
      await this.menu.loadCategories();
      const cats = this.menu.categories();
      if (cats.length > 0) {
        this.selectedCategoryIndex.set(0);
        await this.menu.selectCategory(cats[0].id!);
      }
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
    } catch (err: unknown) {
      this.snackBar.open(extractApiError(err, 'Failed to load category.'), 'Dismiss', {
        duration: 3000,
      });
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

  onSearchChanged(query: string): void {
    this.searchQuery.set(query);
    if (!query) {
      this.updateProducts();
      return;
    }
    const lower = query.toLowerCase();
    const allProducts = this.menu.getAllCachedProducts();
    const matches = allProducts.filter(
      (p) =>
        p.name?.toLowerCase().includes(lower) ||
        p.sku?.toLowerCase().includes(lower) ||
        p.barcode?.toLowerCase().includes(lower),
    );
    this.currentProducts.set(matches);
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

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  private updateProducts(): void {
    const cat = this.menu.selectedCategory();
    this.currentProducts.set(cat?.products ?? []);
  }
}
