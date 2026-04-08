import { Component, inject, signal, computed } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductDto, ProductVariantDto, ProductModifierDto, ModifierOptionDto } from 'api-client';
import { CartLineItem, CartModifierItem } from '../store/cart.models';
import { SettingsService } from '../services/settings.service';

export interface ModifierSheetData {
  product: ProductDto;
}

interface ModifierSelection {
  modifierId: number;
  modifierName: string;
  options: ModifierOptionDto[];
}

@Component({
  selector: 'app-modifier-sheet',
  standalone: true,
  imports: [
    MatButtonModule,
    MatRadioModule,
    MatCheckboxModule,
    MatDividerModule,
    CurrencyPipe,
    FormsModule,
  ],
  template: `
    <div class="sheet-content">
      <h2 class="product-name">{{ data.product.name }}</h2>

      @if (hasVariants()) {
        <div class="section">
          <h3 class="section-title">Size</h3>
          <mat-radio-group [(ngModel)]="selectedVariantId" class="variant-group">
            @for (v of data.product.variants!; track v.id) {
              <mat-radio-button [value]="v.id" class="variant-option">
                {{ v.name }} — {{ v.priceOverride | currency }}
              </mat-radio-button>
            }
          </mat-radio-group>
        </div>
        <mat-divider />
      }

      @for (mod of data.product.modifiers; track mod.modifierId) {
        <div class="section">
          <h3 class="section-title">
            {{ mod.modifierName }}
            @if (mod.isRequired) {
              <span class="required-badge">Required</span>
            }
          </h3>

          @if (!mod.allowMultiple) {
            <mat-radio-group
              [ngModel]="singleSelections()[mod.modifierId!]"
              (ngModelChange)="onSingleSelect(mod.modifierId!, $event)"
              class="modifier-group"
            >
              @for (opt of mod.options!; track opt.id) {
                <mat-radio-button [value]="opt.id" class="modifier-option">
                  {{ opt.name }}
                  @if (opt.price) {
                    <span class="option-price">+{{ opt.price | currency }}</span>
                  }
                </mat-radio-button>
              }
            </mat-radio-group>
          } @else {
            <div class="modifier-group">
              @for (opt of mod.options!; track opt.id) {
                <mat-checkbox
                  [checked]="isMultiSelected(mod.modifierId!, opt.id!)"
                  (change)="onMultiToggle(mod.modifierId!, opt, $event.checked)"
                  class="modifier-option"
                >
                  {{ opt.name }}
                  @if (opt.price) {
                    <span class="option-price">+{{ opt.price | currency }}</span>
                  }
                </mat-checkbox>
              }
            </div>
          }
        </div>
        <mat-divider />
      }

      <div class="sheet-actions">
        <button mat-stroked-button (click)="onCancel()">Cancel</button>
        <button
          mat-flat-button
          color="primary"
          class="add-btn"
          [disabled]="!canAdd()"
          (click)="onAdd()"
        >
          Add to Order — {{ itemPrice() | currency }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .sheet-content {
        padding: 16px;
        max-height: 80vh;
        overflow-y: auto;
      }
      .product-name {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 16px;
      }
      .section {
        padding: 12px 0;
      }
      .section-title {
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 8px;
      }
      .required-badge {
        font-size: 11px;
        font-weight: 500;
        color: var(--mat-sys-error);
        margin-left: 6px;
      }
      .variant-group,
      .modifier-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .variant-option,
      .modifier-option {
        font-size: 15px;
      }
      .option-price {
        opacity: 0.6;
        margin-left: 4px;
      }
      .sheet-actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
        padding-top: 12px;
      }
      .add-btn {
        flex: 1;
        height: 48px;
        font-size: 16px;
        font-weight: 600;
      }
    `,
  ],
})
export class ModifierSheetComponent {
  protected readonly data = inject<ModifierSheetData>(MAT_BOTTOM_SHEET_DATA);
  private readonly sheetRef = inject(MatBottomSheetRef);
  private readonly settingsService = inject(SettingsService);

  protected selectedVariantId = signal<number | null>(null);
  protected singleSelections = signal<Record<number, number>>({});
  protected multiSelections = signal<Record<number, Set<number>>>({});

  protected hasVariants = computed(
    () => !!this.data.product.variants && this.data.product.variants.length > 0,
  );

  protected canAdd = computed(() => {
    if (this.hasVariants() && !this.selectedVariantId()) return false;

    const mods = this.data.product.modifiers ?? [];
    for (const mod of mods) {
      if (mod.isRequired) {
        const hasSingle = this.singleSelections()[mod.modifierId!];
        const hasMulti = (this.multiSelections()[mod.modifierId!]?.size ?? 0) > 0;
        if (!hasSingle && !hasMulti) return false;
      }
    }
    return true;
  });

  protected itemPrice = computed(() => {
    let price = this.getUnitPrice();
    price += this.getModifierTotal();
    return price;
  });

  protected isMultiSelected(modifierId: number, optionId: number): boolean {
    return this.multiSelections()[modifierId]?.has(optionId) ?? false;
  }

  protected onSingleSelect(modifierId: number, optionId: number): void {
    this.singleSelections.update((s) => ({ ...s, [modifierId]: optionId }));
  }

  protected onMultiToggle(modifierId: number, option: ModifierOptionDto, checked: boolean): void {
    this.multiSelections.update((s) => {
      const set = new Set(s[modifierId] ?? []);
      if (checked) set.add(option.id!);
      else set.delete(option.id!);
      return { ...s, [modifierId]: set };
    });
  }

  protected onCancel(): void {
    this.sheetRef.dismiss();
  }

  protected onAdd(): void {
    const product = this.data.product;
    const variant = this.getSelectedVariant();
    const modifierItems = this.getSelectedModifierItems();

    const lineItem: CartLineItem = {
      localId: crypto.randomUUID(),
      productId: product.id!,
      productName: product.name!,
      variantName: variant?.name ?? null,
      unitPrice: variant?.priceOverride ?? product.basePrice!,
      quantity: 1,
      taxRate: product.taxRate ?? this.settingsService.taxRate,
      discountAmount: 0,
      discountType: null,
      discountPercent: null,
      discountReason: null,
      modifierItems,
    };

    this.sheetRef.dismiss(lineItem);
  }

  private getSelectedVariant(): ProductVariantDto | null {
    const vid = this.selectedVariantId();
    if (!vid) return null;
    return this.data.product.variants?.find((v) => v.id === vid) ?? null;
  }

  private getUnitPrice(): number {
    const variant = this.getSelectedVariant();
    return variant?.priceOverride ?? this.data.product.basePrice!;
  }

  private getModifierTotal(): number {
    let total = 0;
    for (const item of this.getSelectedModifierItems()) {
      total += item.price;
    }
    return total;
  }

  private getSelectedModifierItems(): CartModifierItem[] {
    const items: CartModifierItem[] = [];
    const mods = this.data.product.modifiers ?? [];

    for (const mod of mods) {
      // Single-select modifiers
      const singleId = this.singleSelections()[mod.modifierId!];
      if (singleId) {
        const opt = mod.options?.find((o) => o.id === singleId);
        if (opt) {
          items.push({
            modifierName: mod.modifierName!,
            optionName: opt.name!,
            price: opt.price ?? 0,
          });
        }
      }

      // Multi-select modifiers
      const multiIds = this.multiSelections()[mod.modifierId!];
      if (multiIds) {
        for (const optId of multiIds) {
          const opt = mod.options?.find((o) => o.id === optId);
          if (opt) {
            items.push({
              modifierName: mod.modifierName!,
              optionName: opt.name!,
              price: opt.price ?? 0,
            });
          }
        }
      }
    }

    return items;
  }
}
