import { Component, inject, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CartStore } from '../store/cart.store';
import { OrderLineItemRowComponent } from './order-line-item-row.component';
import {
  DiscountDialogComponent,
  DiscountDialogData,
  DiscountDialogResult,
} from './discount-dialog.component';

@Component({
  selector: 'app-order-sidebar',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatDialogModule,
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
            (discountRequested)="onLineDiscount($event)"
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
            <span>Subtotal (ex-VAT)</span>
            <span>{{ cart.subtotal() | currency }}</span>
          </div>
          @if (cart.orderDiscount().amount > 0) {
            <div class="total-row discount-row">
              <span>
                Discount
                <button
                  mat-icon-button
                  class="inline-icon-btn"
                  (click)="cart.removeOrderDiscount()"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </span>
              <span>-{{ cart.orderDiscount().amount | currency }}</span>
            </div>
          }
          <div class="total-row">
            <span>VAT</span>
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
            (click)="onOrderDiscount()"
            [disabled]="cart.isEmpty()"
            class="discount-btn"
          >
            <mat-icon>local_offer</mat-icon>
            Discount
          </button>
          <button
            mat-stroked-button
            color="warn"
            (click)="cart.clear()"
            [disabled]="cart.isEmpty()"
          >
            Clear
          </button>
        </div>
        <div class="pay-row">
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
        opacity: 0.35;
      }
      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
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
      .discount-row {
        color: var(--mat-sys-error);
      }
      .inline-icon-btn {
        width: 20px;
        height: 20px;
        line-height: 20px;
        font-size: 14px;
      }
      .inline-icon-btn mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
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
      .notes-btn,
      .discount-btn {
        flex-shrink: 0;
      }
      .notes-btn mat-icon,
      .discount-btn mat-icon,
      .action-buttons mat-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }
      .pay-row {
        margin-top: 8px;
      }
      .pay-btn {
        width: 100%;
        height: 48px;
        font-size: 16px;
        font-weight: 600;
        border-radius: 10px;
      }
    `,
  ],
})
export class OrderSidebarComponent {
  protected readonly cart = inject(CartStore);
  private readonly dialog = inject(MatDialog);
  readonly pay = output<void>();
  readonly notesRequested = output<void>();

  onQuantityChanged(event: { localId: string; quantity: number }): void {
    this.cart.updateItemQuantity(event.localId, event.quantity);
  }

  onNotes(): void {
    this.notesRequested.emit();
  }

  onLineDiscount(localId: string): void {
    const item = this.cart.lineItems().find((li) => li.localId === localId);
    if (!item) return;
    const modifierTotal = item.modifierItems.reduce((s, m) => s + m.price, 0);
    const grossAmount = (item.unitPrice + modifierTotal) * item.quantity;

    const ref = this.dialog.open(DiscountDialogComponent, {
      data: { itemLabel: item.productName, grossAmount } as DiscountDialogData,
      width: '400px',
    });

    ref.afterClosed().subscribe((result: DiscountDialogResult | undefined) => {
      if (result) {
        this.cart.applyLineDiscount(localId, result.type, result.value, result.reason);
      }
    });
  }

  onOrderDiscount(): void {
    const ref = this.dialog.open(DiscountDialogComponent, {
      data: { itemLabel: 'Order', grossAmount: this.cart.inclusiveTotal() } as DiscountDialogData,
      width: '400px',
    });

    ref.afterClosed().subscribe((result: DiscountDialogResult | undefined) => {
      if (result) {
        this.cart.applyOrderDiscount(result.type, result.value, result.reason);
      }
    });
  }
}
