import { Injectable, Inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CLIENT_TOKEN, IClient, BusinessSettingsDto, Currency } from 'api-client';
import { getCurrencySymbol } from 'shared-models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  readonly settings = signal<BusinessSettingsDto>({
    storeName: 'BrewBar',
    taxRate: 0.15,
    currency: Currency.SCR,
  });

  readonly loaded = signal(false);

  async load(): Promise<void> {
    try {
      const s = await firstValueFrom(this.client.settings_GetSettings());
      this.settings.set(s);
    } catch {
      // Fall back to defaults if API is unreachable
    } finally {
      this.loaded.set(true);
    }
  }

  get currencySymbol(): string {
    return getCurrencySymbol(this.settings().currency);
  }
}
