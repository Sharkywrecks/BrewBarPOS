import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from 'api-client';
import { environment } from '../../environments/environment';

export interface AppSettings {
  storeName: string;
  storeInfo?: string;
  taxRate: number;
  currencyCode: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  readonly settings = signal<AppSettings>({
    storeName: environment.storeName,
    taxRate: environment.taxRate,
    currencyCode: 'USD',
  });

  readonly loaded = signal(false);

  async load(): Promise<void> {
    try {
      const s = await firstValueFrom(this.http.get<AppSettings>(`${this.baseUrl}/api/settings`));
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
}
