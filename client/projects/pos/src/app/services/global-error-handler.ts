import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { extractApiError } from 'api-client';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private readonly injector: Injector) {}

  handleError(error: unknown): void {
    const message = extractApiError(error, 'An unexpected error occurred');

    // Don't show snackbar for NavigationCancel or chunk loading errors during navigation
    if (message.includes('Loading chunk') || message.includes('ChunkLoadError')) {
      // Chunk load failure — likely a new deployment. Reload.
      window.location.reload();
      return;
    }

    console.error('[BrewBar POS]', error);

    // Lazy-inject MatSnackBar to avoid NG0203 during early bootstrap
    try {
      const snackBar = this.injector.get(MatSnackBar);
      snackBar.open(message, 'Dismiss', { duration: 5000 });
    } catch {
      // Snackbar not available yet during early bootstrap — console.error above is enough
    }
  }
}
