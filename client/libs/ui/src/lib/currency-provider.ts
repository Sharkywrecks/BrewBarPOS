import { InjectionToken } from '@angular/core';

export interface CurrencyProvider {
  readonly currencySymbol: string;
}

export const CURRENCY_PROVIDER = new InjectionToken<CurrencyProvider>('CurrencyProvider');
