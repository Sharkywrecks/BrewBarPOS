import { Injectable } from '@angular/core';

export interface RuntimeConfig {
  apiUrl: string;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private config: RuntimeConfig = { apiUrl: '' };

  get apiUrl(): string {
    return this.config.apiUrl;
  }

  async load(): Promise<void> {
    try {
      const res = await fetch('config.json');
      if (res.ok) {
        this.config = await res.json();
      }
    } catch {
      console.warn('[RuntimeConfig] Could not load config.json, using defaults');
    }
  }
}
