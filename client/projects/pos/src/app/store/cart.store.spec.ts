import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CartStore } from './cart.store';
import { CartLineItem } from './cart.models';

function makeItem(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    localId: 'item-1',
    productId: 1,
    productName: 'Green Machine',
    variantName: '24 oz',
    unitPrice: 7.5,
    quantity: 1,
    modifierItems: [],
    ...overrides,
  };
}

describe('CartStore', () => {
  let store: CartStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
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
    store.addItem(makeItem({ localId: 'b', productName: 'Water' }));
    store.removeItem('a');

    expect(store.lineItems()).toHaveLength(1);
    expect(store.lineItems()[0].productName).toBe('Water');
  });

  it('should update item quantity', () => {
    store.addItem(makeItem({ localId: 'a', quantity: 1 }));
    store.updateItemQuantity('a', 5);

    expect(store.lineItems()[0].quantity).toBe(5);
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

  it('should calculate subtotal without modifiers', () => {
    store.addItem(makeItem({ unitPrice: 7.5, quantity: 2 }));

    expect(store.subtotal()).toBe(15.0);
  });

  it('should calculate subtotal with modifiers', () => {
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

    // (7.50 + 1.50 + 1.00) * 1 = 10.00
    expect(store.subtotal()).toBe(10.0);
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

    // (7.50 + 1.50) * 1 + 2.00 * 2 = 9.00 + 4.00 = 13.00
    expect(store.subtotal()).toBe(13.0);
  });

  it('should calculate tax amount rounded to 2 decimals', () => {
    // taxRate default is 0.0875
    store.addItem(makeItem({ unitPrice: 10.0, quantity: 1 }));

    // 10.00 * 0.0875 = 0.875 → rounded to 0.88
    expect(store.taxAmount()).toBe(0.88);
  });

  it('should calculate total as subtotal + tax', () => {
    store.addItem(makeItem({ unitPrice: 10.0, quantity: 1 }));

    expect(store.total()).toBe(10.0 + 0.88);
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
