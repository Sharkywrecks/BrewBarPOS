import { Injectable, InjectionToken, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OutboxService } from './outbox.service';

/**
 * Injection token for the API base URL.
 * The app must provide this — typically the same value as API_BASE_URL from api-client.
 */
export const SYNC_API_BASE_URL = new InjectionToken<string>('SYNC_API_BASE_URL');

const SYNC_INTERVAL_MS = 10_000; // Check every 10 seconds

@Injectable({ providedIn: 'root' })
export class SyncEngineService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SYNC_API_BASE_URL);
  private readonly outbox = inject(OutboxService);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /** Start the background sync loop. Call once at app startup. */
  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.processOutbox(), SYNC_INTERVAL_MS);
    // Run immediately on start
    this.processOutbox();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Process all pending outbox entries. */
  async processOutbox(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const pending = await this.outbox.getPendingOrders();
      for (const entry of pending) {
        await this.syncEntry(entry.localId, entry.payload, entry.paymentPayload);
      }
    } finally {
      this.running = false;
    }
  }

  private async syncEntry(
    localId: string,
    orderPayload: string,
    paymentPayload?: string,
  ): Promise<void> {
    await this.outbox.markSyncing(localId);

    try {
      // Step 1: Create the order (idempotent — server deduplicates by LocalId)
      const order = await firstValueFrom(
        this.http.post<{ id: number }>(`${this.baseUrl}/api/orders`, JSON.parse(orderPayload), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      // Step 2: Create the payment if we have one
      if (paymentPayload) {
        const payment = JSON.parse(paymentPayload);
        payment.orderId = order.id; // Patch with server-assigned ID
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/api/payments`, payment, {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }

      await this.outbox.markSynced(localId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown sync error';
      await this.outbox.markFailed(localId, message);
    }
  }
}
