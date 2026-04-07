import { Component, inject, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CartStore } from '../store/cart.store';
import { OrderLineItemRowComponent } from './order-line-item-row.component';

@Component({
  selector: 'app-order-sidebar',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    OrderLineItemRowComponent,
  ],
  template: `
    <div class="sidebar">
      <div class="sidebar-header">
        <h3>Current Order</h3>
        <span class="item-count">{{ cart.itemCount() }} items</span>
      </div>

      <div class="line-items">
        @for (item of cart.lineItems(); track item.localId) {
          <app-order-line-item-row
            [item]="item"
            (quantityChanged)="onQuantityChanged($event)"
            (remove)="cart.removeItem($event)"
          />
        } @empty {
          <div class="empty-cart">
            <mat-icon class="empty-icon">receipt_long</mat-icon>
            <p>No items yet</p>
          </div>
        }
      </div>

      <div class="sidebar-footer">
        <mat-divider />
        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>{{ cart.subtotal() | currency }}</span>
          </div>
          <div class="total-row">
            <span>Tax</span>
            <span>{{ cart.taxAmount() | currency }}</span>
          </div>
          <div class="total-row grand-total">
            <span>Total</span>
            <span>{{ cart.total() | currency }}</span>
          </div>
        </div>

        <div class="action-buttons">
          <button mat-stroked-button (click)="onNotes()" class="notes-btn">
            <mat-icon>note</mat-icon>
            Notes
          </button>
          <button
            mat-stroked-button
            color="warn"
            (click)="cart.clear()"
            [disabled]="cart.isEmpty()"
          >
            Clear
          </button>
          <button
            mat-flat-button
            color="primary"
            class="pay-btn"
            (click)="pay.emit()"
            [disabled]="cart.isEmpty()"
          >
            Pay {{ cart.total() | currency }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .sidebar {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--mat-sys-surface);
        border-left: 1px solid var(--mat-sys-outline-variant);
      }
      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .sidebar-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .item-count {
        font-size: 13px;
        opacity: 0.6;
      }
      .line-items {
        flex: 1;
        overflow-y: auto;
        padding: 0 12px;
      }
      .empty-cart {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 16px;
        opacity: 0.4;
      }
      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }
      .sidebar-footer {
        flex-shrink: 0;
        padding: 12px 16px;
      }
      .totals {
        padding: 12px 0;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        padding: 2px 0;
      }
      .grand-total {
        font-size: 18px;
        font-weight: 700;
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
      .action-buttons {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      .notes-btn {
        flex-shrink: 0;
      }
      .pay-btn {
        flex: 1;
        height: 48px;
        font-size: 16px;
        font-weight: 600;
      }
    `,
  ],
})
export class OrderSidebarComponent {
  protected readonly cart = inject(CartStore);
  readonly pay = output<void>();
  readonly notesRequested = output<void>();

  onQuantityChanged(event: { localId: string; quantity: number }): void {
    this.cart.updateItemQuantity(event.localId, event.quantity);
  }

  onNotes(): void {
    this.notesRequested.emit();
  }
}
