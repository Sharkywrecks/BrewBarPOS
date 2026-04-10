import { Injectable, Inject, signal } from '@angular/core';
import { firstValueFrom, catchError, of } from 'rxjs';
import { CLIENT_TOKEN, IClient, BusinessSettingsDto, Currency } from 'api-client';
import { getCurrencySymbol } from 'shared-models';
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
    const s = await firstValueFrom(
      this.client.settings_GetSettings().pipe(catchError(() => of(null))),
    );
    if (s) this.settings.set(s);
    this.loaded.set(true);
  }

  get storeName(): string {
    return this.settings().storeName ?? environment.storeName;
  }

  get taxRate(): number {
    return this.settings().taxRate ?? environment.taxRate;
  }

  /** Currency symbol string for receipt printing */
  get currencySymbol(): string {
    return getCurrencySymbol(this.settings().currency);
  }
}
