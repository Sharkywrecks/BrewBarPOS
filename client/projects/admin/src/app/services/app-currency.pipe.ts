import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatNumber } from '@angular/common';
import { SettingsService } from './settings.service';

/**
 * Currency pipe that respects the configured business currency
 * (loaded from BusinessSettings via SettingsService) instead of
 * Angular's default locale-based USD formatting.
 */
@Pipe({ name: 'appCurrency', standalone: true, pure: true })
export class AppCurrencyPipe implements PipeTransform {
  private readonly settings = inject(SettingsService);

  transform(value: number | null | undefined, digits: string = '1.2-2'): string {
    if (value == null || isNaN(value as number)) return '';
    const abs = Math.abs(value as number);
    const formatted = formatNumber(abs, 'en-US', digits);
    const sign = (value as number) < 0 ? '-' : '';
    return `${sign}${this.settings.currencySymbol}${formatted}`;
  }
}
