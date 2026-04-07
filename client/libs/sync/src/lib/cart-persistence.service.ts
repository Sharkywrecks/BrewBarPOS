import { Injectable } from '@angular/core';
import { db } from './db';

@Injectable({ providedIn: 'root' })
export class CartPersistenceService {
  /** Save cart state to IndexedDB. */
  async save(cartStateJson: string): Promise<void> {
    await db.savedCart.put({
      id: 1, // singleton
      state: cartStateJson,
      updatedAt: Date.now(),
    });
  }

  /** Load saved cart state from IndexedDB. Returns null if none saved. */
  async load(): Promise<string | null> {
    const row = await db.savedCart.get(1);
    return row?.state ?? null;
  }

  /** Clear saved cart state. */
  async clear(): Promise<void> {
    await db.savedCart.delete(1);
  }
}
