import { describe, it, expect } from 'vitest';
import { buildReceipt, ReceiptData } from './receipt-builder';

function decode(bytes: Uint8Array): string {
  // Strip control chars and return printable text for assertion
  return Array.from(bytes)
    .filter((b) => b >= 0x20 || b === 0x0a)
    .map((b) => String.fromCharCode(b))
    .join('');
}

function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    storeName: 'BrewBar',
    storeInfo: '123 Main St',
    orderNumber: '20260407-001',
    cashierName: 'Demo Cashier',
    lineItems: [
      {
        name: 'Green Machine',
        variant: '24 oz',
        quantity: 1,
        unitPrice: 7.5,
        lineTotal: 9.0,
        modifiers: [{ name: 'Protein', price: 1.5 }],
      },
      {
        name: 'Water',
        quantity: 2,
        unitPrice: 2.0,
        lineTotal: 4.0,
        modifiers: [],
      },
    ],
    subtotal: 13.0,
    taxRate: 0.08,
    taxAmount: 1.04,
    total: 14.04,
    paymentMethod: 'Cash',
    amountTendered: 20.0,
    changeGiven: 5.96,
    dateTime: new Date(2026, 3, 7, 14, 30),
    ...overrides,
  };
}

describe('Receipt Builder', () => {
  it('should return a Uint8Array', () => {
    const result = buildReceipt(makeReceipt());
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should contain the store name', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('BrewBar');
  });

  it('should contain store info when provided', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('123 Main St');
  });

  it('should omit store info when not provided', () => {
    const text = decode(buildReceipt(makeReceipt({ storeInfo: undefined })));
    expect(text).not.toContain('123 Main St');
  });

  it('should contain order number', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('20260407-001');
  });

  it('should contain cashier name', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('Demo Cashier');
  });

  it('should omit cashier when not provided', () => {
    const text = decode(buildReceipt(makeReceipt({ cashierName: undefined })));
    expect(text).not.toContain('Cashier:');
  });

  it('should contain formatted date', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('04/07/2026 14:30');
  });

  it('should render line items with product name', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('Green Machine');
    expect(text).toContain('Water');
  });

  it('should render variant in parentheses', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('(24 oz)');
  });

  it('should render quantity prefix for qty > 1', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('2x Water');
  });

  it('should not render quantity prefix for qty = 1', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).not.toContain('1x Green');
  });

  it('should render modifiers indented', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('+ Protein');
  });

  it('should render subtotal', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('Subtotal');
    expect(text).toContain('$13.00');
  });

  it('should render tax with percentage', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('Tax (8.0%)');
    expect(text).toContain('$1.04');
  });

  it('should render total', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('TOTAL');
    expect(text).toContain('$14.04');
  });

  it('should render payment method', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('Cash');
  });

  it('should render amount tendered and change', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('$20.00');
    expect(text).toContain('$5.96');
  });

  it('should omit change line when change is 0', () => {
    const text = decode(buildReceipt(makeReceipt({ changeGiven: 0, paymentMethod: 'Card' })));
    expect(text).not.toContain('Change');
  });

  it('should contain thank you message', () => {
    const text = decode(buildReceipt(makeReceipt()));
    expect(text).toContain('Thank you!');
  });

  it('should start with initialize command (ESC @)', () => {
    const result = buildReceipt(makeReceipt());
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x40);
  });

  it('should end with cut command (GS V 0)', () => {
    const result = buildReceipt(makeReceipt());
    const len = result.length;
    expect(result[len - 3]).toBe(0x1d);
    expect(result[len - 2]).toBe(0x56);
    expect(result[len - 1]).toBe(0x00);
  });

  it('should handle items with no modifiers', () => {
    const data = makeReceipt({
      lineItems: [{ name: 'Water', quantity: 1, unitPrice: 2, lineTotal: 2, modifiers: [] }],
    });
    const text = decode(buildReceipt(data));
    expect(text).toContain('Water');
    expect(text).not.toContain('+ ');
  });
});
