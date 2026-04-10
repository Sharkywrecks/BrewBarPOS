import { Currency } from 'api-client';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.SCR]: 'SCR ',
  [Currency.USD]: '$ ',
  [Currency.EUR]: '€ ',
  [Currency.GBP]: '£ ',
  [Currency.AED]: 'AED ',
};

export function getCurrencySymbol(currency: Currency | undefined): string {
  return CURRENCY_SYMBOLS[currency ?? Currency.SCR] ?? 'SCR ';
}
