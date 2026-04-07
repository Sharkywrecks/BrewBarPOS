import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly snackBar = inject(MatSnackBar);

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    // Don't show snackbar for NavigationCancel or chunk loading errors during navigation
    if (message.includes('Loading chunk') || message.includes('ChunkLoadError')) {
      // Chunk load failure — likely a new deployment. Reload.
      window.location.reload();
      return;
    }

    console.error('[BrewBar POS]', error);
    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
  }
}
