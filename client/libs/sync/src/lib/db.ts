import Dexie, { Table } from 'dexie';

export interface PendingOrder {
  localId: string;
  payload: string; // JSON-serialized CreateOrderDto
  paymentPayload?: string; // JSON-serialized CreatePaymentDto (added after order created)
  status: 'pending' | 'syncing' | 'failed';
  attemptCount: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  createdAt: number;
}

export interface SavedCart {
  id: number; // always 1 — singleton row
  state: string; // JSON-serialized CartState
  updatedAt: number;
}

export class BrewBarDB extends Dexie {
  pendingOrders!: Table<PendingOrder, string>;
  savedCart!: Table<SavedCart, number>;

  constructor() {
    super('BrewBarPOS');

    this.version(1).stores({
      pendingOrders: 'localId, status, createdAt',
      savedCart: 'id',
    });
  }
}

export const db = new BrewBarDB();
