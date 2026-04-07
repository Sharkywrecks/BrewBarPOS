import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrencyPipe } from '@angular/common';
import { CartLineItem } from '../store/cart.models';

@Component({
  selector: 'app-order-line-item-row',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, CurrencyPipe],
  template: `
    <div class="line-item">
      <div class="item-info">
        <div class="item-name">
          {{ item().productName }}
          @if (item().variantName) {
            <span class="variant"> — {{ item().variantName }}</span>
          }
        </div>
        @if (item().modifierItems.length > 0) {
          <div class="modifiers">
            {{ modifierSummary() }}
          </div>
        }
      </div>
      <div class="item-controls">
        <div class="qty-controls">
          <button mat-icon-button class="qty-btn" (click)="decrement()">
            <mat-icon>remove</mat-icon>
          </button>
          <span class="qty">{{ item().quantity }}</span>
          <button mat-icon-button class="qty-btn" (click)="increment()">
            <mat-icon>add</mat-icon>
          </button>
        </div>
        <span class="line-total">{{ lineTotal() | currency }}</span>
        <button mat-icon-button class="remove-btn" (click)="remove.emit(item().localId)">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .line-item {
        display: flex;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        gap: 8px;
      }
      .item-info {
        flex: 1;
        min-width: 0;
      }
      .item-name {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .variant {
        font-weight: 400;
        opacity: 0.8;
      }
      .modifiers {
        font-size: 12px;
        opacity: 0.6;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .item-controls {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .qty-controls {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .qty-btn {
        width: 32px;
        height: 32px;
      }
      .qty-btn ::ng-deep .mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .qty {
        font-size: 14px;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
      }
      .line-total {
        font-size: 14px;
        font-weight: 500;
        min-width: 56px;
        text-align: right;
      }
      .remove-btn {
        width: 32px;
        height: 32px;
        opacity: 0.5;
      }
      .remove-btn ::ng-deep .mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    `,
  ],
})
export class OrderLineItemRowComponent {
  readonly item = input.required<CartLineItem>();
  readonly quantityChanged = output<{ localId: string; quantity: number }>();
  readonly remove = output<string>();

  protected modifierSummary(): string {
    return this.item()
      .modifierItems.map((m) => m.optionName)
      .join(', ');
  }

  protected lineTotal(): number {
    const li = this.item();
    const modTotal = li.modifierItems.reduce((sum, m) => sum + m.price, 0);
    return (li.unitPrice + modTotal) * li.quantity;
  }

  increment(): void {
    const li = this.item();
    this.quantityChanged.emit({ localId: li.localId, quantity: li.quantity + 1 });
  }

  decrement(): void {
    const li = this.item();
    this.quantityChanged.emit({ localId: li.localId, quantity: li.quantity - 1 });
  }
}
