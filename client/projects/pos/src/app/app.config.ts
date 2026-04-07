import {
  ApplicationConfig,
  APP_INITIALIZER,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { API_BASE_URL, Client, CLIENT_TOKEN } from 'api-client';
import { jwtInterceptor } from 'auth';
import { environment } from '../environments/environment';
import { SettingsService } from './services/settings.service';
import { SyncEngineService, OutboxService, SYNC_API_BASE_URL } from 'sync';
import { GlobalErrorHandler } from './services/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimationsAsync(),
    { provide: API_BASE_URL, useValue: environment.apiUrl },
    { provide: SYNC_API_BASE_URL, useValue: environment.apiUrl },
    { provide: CLIENT_TOKEN, useClass: Client },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory:
        (settings: SettingsService, syncEngine: SyncEngineService, outbox: OutboxService) =>
        async () => {
          await settings.load();
          await outbox.refreshCounts();
          syncEngine.start();
        },
      deps: [SettingsService, SyncEngineService, OutboxService],
      multi: true,
    },
  ],
};
