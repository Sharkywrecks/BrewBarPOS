import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { CreateOrderDto, CreateOrderLineItemDto, CreateOrderModifierItemDto } from 'api-client';
import { CartPersistenceService } from 'sync';
import { CartState, CartLineItem } from './cart.models';
import { SettingsService } from '../services/settings.service';

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly settingsService = inject(SettingsService);
  private readonly persistence = inject(CartPersistenceService);

  private readonly state = signal<CartState>({
    lineItems: [],
    notes: null,
    taxRate: this.settingsService.taxRate,
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

  readonly subtotal = computed(() =>
    this.state().lineItems.reduce((sum, li) => {
      const modifierTotal = li.modifierItems.reduce((ms, m) => ms + m.price, 0);
      return sum + (li.unitPrice + modifierTotal) * li.quantity;
    }, 0),
  );

  readonly taxAmount = computed(
    () => Math.round(this.subtotal() * this.state().taxRate * 100) / 100,
  );

  readonly total = computed(() => this.subtotal() + this.taxAmount());

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

  clear(): void {
    this.state.set({ lineItems: [], notes: null, taxRate: this.state().taxRate });
    this.persistence.clear();
  }

  toCreateOrderDto(): CreateOrderDto {
    const s = this.state();
    return {
      localId: crypto.randomUUID(),
      taxRate: s.taxRate,
      notes: s.notes ?? undefined,
      terminalId: undefined,
      lineItems: s.lineItems.map(
        (li) =>
          ({
            productId: li.productId,
            productName: li.productName,
            variantName: li.variantName ?? undefined,
            unitPrice: li.unitPrice,
            quantity: li.quantity,
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
