import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { API_BASE_URL } from 'api-client';

async function bootstrap(): Promise<void> {
  let apiUrl = '';
  try {
    const res = await fetch('config.json');
    if (res.ok) {
      const config = await res.json();
      apiUrl = config.apiUrl ?? '';
    }
  } catch {
    // Fall back to empty base URL (proxy handles routing in dev, reverse proxy in prod)
  }

  await bootstrapApplication(App, {
    ...appConfig,
    providers: [...appConfig.providers, { provide: API_BASE_URL, useValue: apiUrl }],
  });
}

bootstrap().catch((err) => console.error(err));
