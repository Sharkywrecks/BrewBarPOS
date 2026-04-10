export * from './lib/escpos-commands';
export { buildReceipt } from './lib/receipt-builder';
export type { ReceiptData, ReceiptLineItem } from './lib/receipt-builder';
export { PrinterService, NAVIGATOR, PRINT_API_CLIENT } from './lib/printer.service';
export type { PrinterMode, PrintApiClient } from './lib/printer.service';
export { CashDrawerService } from './lib/cash-drawer.service';
