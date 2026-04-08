import { Injectable, signal, computed, inject, effect } from '@angular/core';
import {
  CreateOrderDto,
  CreateOrderLineItemDto,
  CreateOrderModifierItemDto,
  DiscountType,
} from 'api-client';
import { CartPersistenceService } from 'sync';
import { CartState, CartLineItem } from './cart.models';
import { SettingsService } from '../services/settings.service';
import { ShiftService } from '../services/shift.service';

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly settingsService = inject(SettingsService);
  private readonly shiftService = inject(ShiftService);
  private readonly persistence = inject(CartPersistenceService);

  private readonly state = signal<CartState>({
    lineItems: [],
    notes: null,
    taxRate: this.settingsService.taxRate,
    orderDiscountAmount: 0,
    orderDiscountType: null,
    orderDiscountPercent: null,
    orderDiscountReason: null,
  });

  constructor() {
    // Auto-save cart to IndexedDB on every change
    effect(() => {
      const s = this.state();
      if (s.lineItems.length > 0) {
        this.persistence.save(JSON.stringify(s));
      } else {
        this.persistence.clear();
      }
    });

    // Restore saved cart on startup
    this.persistence.load().then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as CartState;
          if (parsed.lineItems?.length > 0) {
            this.state.set(parsed);
          }
        } catch {
          /* ignore corrupt data */
        }
      }
    });
  }

  readonly lineItems = computed(() => this.state().lineItems);
  readonly notes = computed(() => this.state().notes);
  readonly itemCount = computed(() =>
    this.state().lineItems.reduce((sum, li) => sum + li.quantity, 0),
  );
  readonly isEmpty = computed(() => this.state().lineItems.length === 0);

  readonly orderDiscount = computed(() => ({
    amount: this.state().orderDiscountAmount,
    type: this.state().orderDiscountType,
    percent: this.state().orderDiscountPercent,
    reason: this.state().orderDiscountReason,
  }));

  /** Sum of VAT-inclusive line totals after line-level discounts */
  readonly inclusiveTotal = computed(() =>
    this.state().lineItems.reduce((sum, li) => {
      const modifierTotal = li.modifierItems.reduce((ms, m) => ms + m.price, 0);
      const lineGross = (li.unitPrice + modifierTotal) * li.quantity;
      return sum + (lineGross - (li.discountAmount ?? 0));
    }, 0),
  );

  /** Inclusive total after order-level discount */
  readonly orderNetInclusive = computed(
    () => this.inclusiveTotal() - this.state().orderDiscountAmount,
  );

  /** Sum of ex-VAT line totals after discounts */
  readonly subtotal = computed(() => {
    const s = this.state();
    let lineExVatTotal = 0;
    let lineInclusiveTotal = 0;
    let lineTaxTotal = 0;

    for (const li of s.lineItems) {
      const modifierTotal = li.modifierItems.reduce((ms, m) => ms + m.price, 0);
      const lineGross = (li.unitPrice + modifierTotal) * li.quantity;
      const lineNet = lineGross - (li.discountAmount ?? 0);
      const exVat = li.taxRate > 0 ? Math.round((lineNet / (1 + li.taxRate)) * 100) / 100 : lineNet;
      lineExVatTotal += exVat;
      lineInclusiveTotal += lineNet;
      lineTaxTotal += lineNet - exVat;
    }

    // Distribute order discount proportionally for tax extraction
    if (s.orderDiscountAmount > 0 && lineInclusiveTotal > 0) {
      const taxRatio = lineTaxTotal / lineInclusiveTotal;
      const orderDiscountTax = Math.round(s.orderDiscountAmount * taxRatio * 100) / 100;
      const orderDiscountExVat = s.orderDiscountAmount - orderDiscountTax;
      return lineExVatTotal - orderDiscountExVat;
    }

    return lineExVatTotal;
  });

  /** Total VAT extracted from inclusive prices after all discounts */
  readonly taxAmount = computed(
    () => Math.round((this.orderNetInclusive() - this.subtotal()) * 100) / 100,
  );

  /** Total = what customer pays (inclusive total after all discounts) */
  readonly total = computed(() => this.orderNetInclusive());

  addItem(item: CartLineItem): void {
    this.state.update((s) => ({
      ...s,
      lineItems: [...s.lineItems, item],
    }));
  }

  updateItemQuantity(localId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(localId);
      return;
    }
    this.state.update((s) => ({
      ...s,
      lineItems: s.lineItems.map((li) => (li.localId === localId ? { ...li, quantity } : li)),
    }));
  }

  removeItem(localId: string): void {
    this.state.update((s) => ({
      ...s,
      lineItems: s.lineItems.filter((li) => li.localId !== localId),
    }));
  }

  updateNotes(notes: string | null): void {
    this.state.update((s) => ({ ...s, notes }));
  }

  applyLineDiscount(localId: string, type: DiscountType, value: number, reason: string): void {
    this.state.update((s) => ({
      ...s,
      lineItems: s.lineItems.map((li) => {
        if (li.localId !== localId) return li;
        const modifierTotal = li.modifierItems.reduce((ms, m) => ms + m.price, 0);
        const lineGross = (li.unitPrice + modifierTotal) * li.quantity;
        const discountAmount =
          type === DiscountType.Percentage
            ? Math.round(lineGross * (value / 100) * 100) / 100
            : value;
        return {
          ...li,
          discountAmount,
          discountType: type,
          discountPercent: type === DiscountType.Percentage ? value : null,
          discountReason: reason,
        };
      }),
    }));
  }

  removeLineDiscount(localId: string): void {
    this.state.update((s) => ({
      ...s,
      lineItems: s.lineItems.map((li) =>
        li.localId === localId
          ? {
              ...li,
              discountAmount: 0,
              discountType: null,
              discountPercent: null,
              discountReason: null,
            }
          : li,
      ),
    }));
  }

  applyOrderDiscount(type: DiscountType, value: number, reason: string): void {
    const inclusiveTotal = this.inclusiveTotal();
    const discountAmount =
      type === DiscountType.Percentage
        ? Math.round(inclusiveTotal * (value / 100) * 100) / 100
        : value;
    this.state.update((s) => ({
      ...s,
      orderDiscountAmount: discountAmount,
      orderDiscountType: type,
      orderDiscountPercent: type === DiscountType.Percentage ? value : null,
      orderDiscountReason: reason,
    }));
  }

  removeOrderDiscount(): void {
    this.state.update((s) => ({
      ...s,
      orderDiscountAmount: 0,
      orderDiscountType: null,
      orderDiscountPercent: null,
      orderDiscountReason: null,
    }));
  }

  clear(): void {
    this.state.set({
      lineItems: [],
      notes: null,
      taxRate: this.state().taxRate,
      orderDiscountAmount: 0,
      orderDiscountType: null,
      orderDiscountPercent: null,
      orderDiscountReason: null,
    });
    this.persistence.clear();
  }

  toCreateOrderDto(): CreateOrderDto {
    const s = this.state();
    return {
      localId: crypto.randomUUID(),
      taxRate: s.taxRate,
      orderDiscountAmount: s.orderDiscountAmount,
      orderDiscountType: s.orderDiscountType ?? undefined,
      orderDiscountPercent: s.orderDiscountPercent ?? undefined,
      orderDiscountReason: s.orderDiscountReason ?? undefined,
      notes: s.notes ?? undefined,
      terminalId: undefined,
      registerShiftId: this.shiftService.currentShift()?.id ?? undefined,
      lineItems: s.lineItems.map(
        (li) =>
          ({
            productId: li.productId,
            productName: li.productName,
            variantName: li.variantName ?? undefined,
            unitPrice: li.unitPrice,
            quantity: li.quantity,
            taxRate: li.taxRate,
            discountAmount: li.discountAmount,
            discountType: li.discountType ?? undefined,
            discountPercent: li.discountPercent ?? undefined,
            discountReason: li.discountReason ?? undefined,
            modifierItems: li.modifierItems.map(
              (m) =>
                ({
                  modifierName: m.modifierName,
                  optionName: m.optionName,
                  price: m.price,
                }) as CreateOrderModifierItemDto,
            ),
          }) as CreateOrderLineItemDto,
      ),
    };
  }
}
