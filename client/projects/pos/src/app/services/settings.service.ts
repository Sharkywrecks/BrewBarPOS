import { Injectable, Inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CLIENT_TOKEN, IClient, BusinessSettingsDto, Currency } from 'api-client';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  readonly settings = signal<BusinessSettingsDto>({
    storeName: environment.storeName,
    taxRate: environment.taxRate,
    currency: Currency.SCR,
  });

  readonly loaded = signal(false);

  async load(): Promise<void> {
    try {
      const s = await firstValueFrom(this.client.settings_GetSettings());
      this.settings.set(s);
    } catch {
      // Fall back to environment defaults if API is unreachable
    } finally {
      this.loaded.set(true);
    }
  }

  get storeName(): string {
    return this.settings().storeName ?? environment.storeName;
  }

  get taxRate(): number {
    return this.settings().taxRate ?? environment.taxRate;
  }

  /** Currency symbol string for receipt printing */
  get currencySymbol(): string {
    const SYMBOLS: Record<Currency, string> = {
      [Currency.SCR]: 'SCR ',
      [Currency.USD]: '$ ',
      [Currency.EUR]: '€ ',
      [Currency.GBP]: '£ ',
      [Currency.AED]: 'AED ',
    };
    return SYMBOLS[this.settings().currency ?? Currency.SCR] ?? 'SCR ';
  }
}
