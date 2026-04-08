import {
  initialize,
  feedLines,
  cut,
  alignCenter,
  alignLeft,
  boldOn,
  boldOff,
  doubleHeightOn,
  doubleHeightOff,
  textLine,
  separator,
  twoColumnLine,
  concat,
  DEFAULT_WIDTH,
} from './escpos-commands';

export interface ReceiptLineItem {
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers: { name: string; price: number }[];
}

export interface ReceiptData {
  storeName: string;
  storeInfo?: string;
  orderNumber: string;
  cashierName?: string;
  lineItems: ReceiptLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  amountTendered: number;
  changeGiven: number;
  tipAmount?: number;
  dateTime: Date;
  currencySymbol?: string;
}

function formatMoney(amount: number, symbol: string): string {
  return symbol + amount.toFixed(2);
}

function formatDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Build a complete receipt as ESC/POS byte data.
 * Pure function — no side effects.
 */
export function buildReceipt(data: ReceiptData, width = DEFAULT_WIDTH): Uint8Array {
  const parts: Uint8Array[] = [];
  const sym = data.currencySymbol ?? 'SCR ';

  // Reset
  parts.push(initialize());

  // Header — store name
  parts.push(alignCenter());
  parts.push(boldOn());
  parts.push(doubleHeightOn());
  parts.push(textLine(data.storeName));
  parts.push(doubleHeightOff());
  parts.push(boldOff());

  if (data.storeInfo) {
    parts.push(textLine(data.storeInfo));
  }

  parts.push(alignLeft());
  parts.push(separator('-', width));

  // Order info
  parts.push(textLine(`Order: ${data.orderNumber}`));
  if (data.cashierName) {
    parts.push(textLine(`Cashier: ${data.cashierName}`));
  }
  parts.push(textLine(`Date: ${formatDate(data.dateTime)}`));
  parts.push(separator('-', width));

  // Line items
  for (const item of data.lineItems) {
    const displayName = item.variant ? `${item.name} (${item.variant})` : item.name;

    const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
    parts.push(twoColumnLine(`${qty}${displayName}`, formatMoney(item.lineTotal, sym), width));

    for (const mod of item.modifiers) {
      parts.push(twoColumnLine(`  + ${mod.name}`, formatMoney(mod.price, sym), width));
    }
  }

  parts.push(separator('-', width));

  // Totals
  parts.push(twoColumnLine('Subtotal (ex-VAT)', formatMoney(data.subtotal, sym), width));

  const taxPct = (data.taxRate * 100).toFixed(1);
  parts.push(twoColumnLine(`VAT (${taxPct}%)`, formatMoney(data.taxAmount, sym), width));

  parts.push(boldOn());
  parts.push(twoColumnLine('TOTAL', formatMoney(data.total, sym), width));
  parts.push(boldOff());

  if (data.tipAmount && data.tipAmount > 0) {
    parts.push(twoColumnLine('Tip', formatMoney(data.tipAmount, sym), width));
    parts.push(boldOn());
    parts.push(twoColumnLine('GRAND TOTAL', formatMoney(data.total + data.tipAmount, sym), width));
    parts.push(boldOff());
  }

  parts.push(separator('-', width));

  // Payment
  parts.push(twoColumnLine('Payment', data.paymentMethod, width));
  parts.push(twoColumnLine('Tendered', formatMoney(data.amountTendered, sym), width));
  if (data.changeGiven > 0) {
    parts.push(twoColumnLine('Change', formatMoney(data.changeGiven, sym), width));
  }

  // Footer
  parts.push(feedLines(1));
  parts.push(alignCenter());
  parts.push(textLine('Thank you!'));
  parts.push(alignLeft());
  parts.push(feedLines(3));
  parts.push(cut());

  return concat(...parts);
}
