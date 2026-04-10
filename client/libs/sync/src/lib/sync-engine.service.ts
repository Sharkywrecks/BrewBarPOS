import { Injectable, Inject, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CLIENT_TOKEN, IClient, CreateOrderDto, CreatePaymentDto } from 'api-client';
import { OutboxService } from './outbox.service';
import { ConnectivityService } from './connectivity.service';

const SYNC_INTERVAL_MS = 10_000; // Check every 10 seconds

@Injectable({ providedIn: 'root' })
export class SyncEngineService implements OnDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(CLIENT_TOKEN) private readonly client: IClient,
    private readonly outbox: OutboxService,
    private readonly connectivity: ConnectivityService,
  ) {}

  /** Start the background sync loop and connectivity heartbeat. Call once at app startup. */
  start(): void {
    if (this.intervalId) return;
    this.connectivity.start();
    this.intervalId = setInterval(() => this.processOutbox(), SYNC_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.connectivity.stop();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Process all pending outbox entries. Skips if offline. */
  async processOutbox(): Promise<void> {
    if (this.running) return;
    if (!this.connectivity.isOnline()) return;
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
      const orderDto = JSON.parse(orderPayload) as CreateOrderDto;
      const order = await firstValueFrom(this.client.orders_CreateOrder(orderDto));

      // Step 2: Create the payment if we have one
      if (paymentPayload) {
        const paymentDto = JSON.parse(paymentPayload) as CreatePaymentDto;
        paymentDto.orderId = order.id!; // Patch with server-assigned ID
        await firstValueFrom(this.client.payments_CreatePayment(paymentDto));
      }

      await this.outbox.markSynced(localId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown sync error';
      await this.outbox.markFailed(localId, message);
    }
  }
}
