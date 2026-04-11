import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter } from '@angular/material/core';

import { routes } from './app.routes';
import { Client, CLIENT_TOKEN } from 'api-client';
import { jwtInterceptor } from 'auth';
import { SettingsService } from './services/settings.service';
import { CURRENCY_PROVIDER } from 'ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    // API_BASE_URL is provided by main.ts after loading config.json
    { provide: CLIENT_TOKEN, useClass: Client },
    { provide: CURRENCY_PROVIDER, useExisting: SettingsService },
    {
      provide: APP_INITIALIZER,
      useFactory: (settings: SettingsService) => () => settings.load(),
      deps: [SettingsService],
      multi: true,
    },
  ],
};
