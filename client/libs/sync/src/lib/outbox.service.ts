import { Injectable, signal, computed } from '@angular/core';
import { db, PendingOrder } from './db';

const MAX_ATTEMPTS = 5;

@Injectable({ providedIn: 'root' })
export class OutboxService {
  readonly pendingCount = signal(0);
  readonly failedCount = signal(0);
  readonly hasPending = computed(() => this.pendingCount() > 0);

  /** Queue an order for sync. Called when the API is unreachable. */
  async enqueue(localId: string, orderPayload: string, paymentPayload?: string): Promise<void> {
    await db.pendingOrders.put({
      localId,
      payload: orderPayload,
      paymentPayload,
      status: 'pending',
      attemptCount: 0,
      createdAt: Date.now(),
    });
    await this.refreshCounts();
  }

  /** Get all pending/failed orders ready for retry. */
  async getPendingOrders(): Promise<PendingOrder[]> {
    return db.pendingOrders
      .where('status')
      .anyOf('pending', 'failed')
      .filter((o) => o.attemptCount < MAX_ATTEMPTS)
      .toArray();
  }

  /** Mark an order as currently syncing. */
  async markSyncing(localId: string): Promise<void> {
    await db.pendingOrders.update(localId, {
      status: 'syncing',
      lastAttemptAt: Date.now(),
    });
  }

  /** Remove a successfully synced order from the outbox. */
  async markSynced(localId: string): Promise<void> {
    await db.pendingOrders.delete(localId);
    await this.refreshCounts();
  }

  /** Mark an order as failed with error details. */
  async markFailed(localId: string, error: string): Promise<void> {
    const entry = await db.pendingOrders.get(localId);
    if (!entry) return;

    await db.pendingOrders.update(localId, {
      status: 'failed',
      attemptCount: entry.attemptCount + 1,
      errorMessage: error,
      lastAttemptAt: Date.now(),
    });
    await this.refreshCounts();
  }

  /** Refresh the pending/failed counts for UI binding. */
  async refreshCounts(): Promise<void> {
    const pending = await db.pendingOrders.where('status').anyOf('pending', 'syncing').count();
    const failed = await db.pendingOrders.where('status').equals('failed').count();

    this.pendingCount.set(pending);
    this.failedCount.set(failed);
  }
}
