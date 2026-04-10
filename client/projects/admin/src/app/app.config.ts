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
import { API_BASE_URL, Client, CLIENT_TOKEN } from 'api-client';
import { jwtInterceptor } from 'auth';
import { RuntimeConfigService } from './services/runtime-config.service';
import { SettingsService } from './services/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    {
      provide: APP_INITIALIZER,
      useFactory: (cfg: RuntimeConfigService) => () => cfg.load(),
      deps: [RuntimeConfigService],
      multi: true,
    },
    {
      provide: API_BASE_URL,
      useFactory: (cfg: RuntimeConfigService) => cfg.apiUrl,
      deps: [RuntimeConfigService],
    },
    { provide: CLIENT_TOKEN, useClass: Client },
    {
      provide: APP_INITIALIZER,
      useFactory: (settings: SettingsService) => () => settings.load(),
      deps: [SettingsService],
      multi: true,
    },
  ],
};
