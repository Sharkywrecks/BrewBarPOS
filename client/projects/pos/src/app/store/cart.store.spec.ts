import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CartStore } from './cart.store';
import { CartLineItem } from './cart.models';
import { SettingsService } from '../services/settings.service';
import { ShiftService } from '../services/shift.service';
import { CartPersistenceService } from 'sync';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, CLIENT_TOKEN } from 'api-client';

function makeItem(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    localId: 'item-1',
    productId: 1,
    productName: 'Green Machine',
    variantName: '24 oz',
    unitPrice: 7.5,
    quantity: 1,
    taxRate: 0.0875,
    discountAmount: 0,
    discountType: null,
    discountPercent: null,
    discountReason: null,
    modifierItems: [],
    ...overrides,
  };
}

describe('CartStore', () => {
  let store: CartStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CartStore,
        {
          provide: SettingsService,
          useValue: {
            taxRate: 0.0875,
            storeName: 'Test',
            settings: { taxRate: 0.0875 },
            loaded: { value: true },
            load: vi.fn(),
          },
        },
        {
          provide: CartPersistenceService,
          useValue: { save: vi.fn(), load: vi.fn().mockResolvedValue(null), clear: vi.fn() },
        },
        {
          provide: ShiftService,
          useValue: { currentShift: () => null, isOpen: () => false, refresh: vi.fn() },
        },
        { provide: CLIENT_TOKEN, useValue: {} },
        { provide: HttpClient, useValue: {} },
        { provide: API_BASE_URL, useValue: 'http://localhost:5000' },
      ],
    });
    store = TestBed.inject(CartStore);
  });

  it('should start empty', () => {
    expect(store.isEmpty()).toBe(true);
    expect(store.lineItems()).toEqual([]);
    expect(store.itemCount()).toBe(0);
  });

  it('should add an item', () => {
    store.addItem(makeItem());

    expect(store.isEmpty()).toBe(false);
    expect(store.lineItems()).toHaveLength(1);
    expect(store.lineItems()[0].productName).toBe('Green Machine');
  });

  it('should track item count by quantity', () => {
    store.addItem(makeItem({ localId: 'a', quantity: 2 }));
    store.addItem(makeItem({ localId: 'b', quantity: 3 }));

    expect(store.itemCount()).toBe(5);
  });

  it('should remove an item by localId', () => {
    store.addItem(makeItem({ localId: 'a' }));
    store.addItem(makeItem({ localId: 'b', productId: 2, productName: 'Water' }));
    store.removeItem('a');

    expect(store.lineItems()).toHaveLength(1);
    expect(store.lineItems()[0].productName).toBe('Water');
  });

  it('should update item quantity', () => {
    store.addItem(makeItem({ localId: 'a', quantity: 1 }));
    store.updateItemQuantity('a', 5);

    expect(store.lineItems()[0].quantity).toBe(5);
  });

  it('should stack identical items by incrementing quantity', () => {
    store.addItem(makeItem({ localId: 'a' }));
    store.addItem(makeItem({ localId: 'b' }));

    expect(store.lineItems()).toHaveLength(1);
    expect(store.lineItems()[0].quantity).toBe(2);
  });

  it('should not stack items with different modifiers', () => {
    store.addItem(makeItem({ localId: 'a', modifierItems: [] }));
    store.addItem(
      makeItem({
        localId: 'b',
        modifierItems: [{ modifierName: 'Add-In', optionName: 'Protein', price: 1.5 }],
      }),
    );

    expect(store.lineItems()).toHaveLength(2);
  });

  it('should not stack items with different variants', () => {
    store.addItem(makeItem({ localId: 'a', variantName: '16 oz' }));
    store.addItem(makeItem({ localId: 'b', variantName: '24 oz' }));

    expect(store.lineItems()).toHaveLength(2);
  });

  it('should remove item when quantity set to 0', () => {
    store.addItem(makeItem({ localId: 'a' }));
    store.updateItemQuantity('a', 0);

    expect(store.isEmpty()).toBe(true);
  });

  it('should remove item when quantity is negative', () => {
    store.addItem(makeItem({ localId: 'a' }));
    store.updateItemQuantity('a', -1);

    expect(store.isEmpty()).toBe(true);
  });

  // Note: prices are VAT-inclusive (Seychelles VAT model). subtotal() returns
  // the ex-VAT amount extracted from the inclusive total, total() is what the
  // customer actually pays (inclusive), and taxAmount() is the difference.

  it('should calculate subtotal without modifiers (ex-VAT extracted from inclusive)', () => {
    store.addItem(makeItem({ unitPrice: 7.5, quantity: 2 }));

    // Inclusive: 7.50 * 2 = 15.00 → ex-VAT: 15 / 1.0875 ≈ 13.79
    expect(store.subtotal()).toBe(13.79);
  });

  it('should calculate subtotal with modifiers (ex-VAT extracted from inclusive)', () => {
    store.addItem(
      makeItem({
        unitPrice: 7.5,
        quantity: 1,
        modifierItems: [
          { modifierName: 'Add-In', optionName: 'Protein', price: 1.5 },
          { modifierName: 'Add-In', optionName: 'Immunity', price: 1.0 },
        ],
      }),
    );

    // Inclusive: (7.50 + 1.50 + 1.00) * 1 = 10.00 → ex-VAT: 10 / 1.0875 ≈ 9.20
    expect(store.subtotal()).toBe(9.2);
  });

  it('should calculate subtotal with multiple items and modifiers', () => {
    store.addItem(
      makeItem({
        localId: 'a',
        unitPrice: 7.5,
        quantity: 1,
        modifierItems: [{ modifierName: 'Add-In', optionName: 'Protein', price: 1.5 }],
      }),
    );
    store.addItem(makeItem({ localId: 'b', unitPrice: 2.0, quantity: 2, modifierItems: [] }));

    // Item A inclusive: 9.00 → ex-VAT 8.28
    // Item B inclusive: 4.00 → ex-VAT 3.68
    // Sum ex-VAT ≈ 11.96 (with floating-point noise)
    expect(store.subtotal()).toBeCloseTo(11.96, 2);
  });

  it('should calculate tax amount rounded to 2 decimals', () => {
    // taxRate default is 0.0875
    store.addItem(makeItem({ unitPrice: 10.0, quantity: 1 }));

    // Inclusive 10.00 → ex-VAT 9.20 → tax 0.80
    expect(store.taxAmount()).toBe(0.8);
  });

  it('should calculate total as the VAT-inclusive amount', () => {
    store.addItem(makeItem({ unitPrice: 10.0, quantity: 1 }));

    // total() is what the customer pays — the inclusive line gross
    expect(store.total()).toBe(10.0);
  });

  it('should update notes', () => {
    store.updateNotes('No ice');
    expect(store.notes()).toBe('No ice');
  });

  it('should clear notes', () => {
    store.updateNotes('No ice');
    store.updateNotes(null);
    expect(store.notes()).toBeNull();
  });

  it('should clear all items and notes but keep taxRate', () => {
    store.addItem(makeItem());
    store.updateNotes('Extra napkins');
    store.clear();

    expect(store.isEmpty()).toBe(true);
    expect(store.notes()).toBeNull();
    expect(store.subtotal()).toBe(0);
  });

  it('should produce a valid CreateOrderDto', () => {
    store.addItem(
      makeItem({
        productId: 42,
        productName: 'Green Machine',
        variantName: '24 oz',
        unitPrice: 7.5,
        quantity: 1,
        modifierItems: [{ modifierName: 'Add-In', optionName: 'Protein', price: 1.5 }],
      }),
    );
    store.updateNotes('Blend extra');

    const dto = store.toCreateOrderDto();

    expect(dto.taxRate).toBe(0.0875);
    expect(dto.notes).toBe('Blend extra');
    expect(dto.localId).toBeDefined();
    expect(dto.lineItems).toHaveLength(1);
    expect(dto.lineItems![0].productId).toBe(42);
    expect(dto.lineItems![0].productName).toBe('Green Machine');
    expect(dto.lineItems![0].variantName).toBe('24 oz');
    expect(dto.lineItems![0].modifierItems).toHaveLength(1);
    expect(dto.lineItems![0].modifierItems![0].optionName).toBe('Protein');
  });

  it('toCreateOrderDto should omit notes when null', () => {
    store.addItem(makeItem());
    const dto = store.toCreateOrderDto();

    expect(dto.notes).toBeUndefined();
  });
});
