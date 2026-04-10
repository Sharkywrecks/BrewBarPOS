import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatNumber } from '@angular/common';
import { CURRENCY_PROVIDER } from './currency-provider';

/**
 * Currency pipe that respects the configured business currency
 * via a CurrencyProvider injection token.
 */
@Pipe({ name: 'appCurrency', standalone: true, pure: true })
export class AppCurrencyPipe implements PipeTransform {
  private readonly provider = inject(CURRENCY_PROVIDER);

  transform(value: number | null | undefined, digits: string = '1.2-2'): string {
    if (value == null || isNaN(value as number)) return '';
    const abs = Math.abs(value as number);
    const formatted = formatNumber(abs, 'en-US', digits);
    const sign = (value as number) < 0 ? '-' : '';
    return `${sign}${this.provider.currencySymbol}${formatted}`;
  }
}
