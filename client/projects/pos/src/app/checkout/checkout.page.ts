import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { PaymentMethod, CreatePaymentDto } from 'api-client';
import { PrinterService, CashDrawerService, buildReceipt, ReceiptData } from 'printing';
import { AuthService } from 'auth';
import { CartStore } from '../store/cart.store';
import { OrderService } from '../services/order.service';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="checkout-layout">
      <div class="checkout-content">
        <button mat-button class="back-btn" (click)="onBack()">
          <mat-icon>arrow_back</mat-icon> Back to Order
        </button>

        <h1>Checkout</h1>

        <!-- Order Summary -->
        <div class="order-summary">
          @for (item of cart.lineItems(); track item.localId) {
            <div class="summary-line">
              <span
                >{{ item.quantity }}x {{ item.productName }}
                @if (item.variantName) {
                  ({{ item.variantName }})
                }
              </span>
              <span>{{ lineTotal(item) | currency }}</span>
            </div>
          }
          <mat-divider />
          <div class="summary-line">
            <span>Subtotal</span>
            <span>{{ cart.subtotal() | currency }}</span>
          </div>
          <div class="summary-line">
            <span>Tax</span>
            <span>{{ cart.taxAmount() | currency }}</span>
          </div>
          <div class="summary-line total">
            <span>Total</span>
            <span>{{ cart.total() | currency }}</span>
          </div>
        </div>

        @if (cart.notes()) {
          <div class="notes-display">
            <mat-icon>note</mat-icon>
            {{ cart.notes() }}
          </div>
        }

        <!-- Payment Method -->
        <h2>Payment Method</h2>
        <mat-button-toggle-group [(ngModel)]="paymentMethod" class="payment-toggle">
          <mat-button-toggle [value]="PaymentMethod.Cash" class="method-btn">
            <mat-icon>payments</mat-icon>
            Cash
          </mat-button-toggle>
          <mat-button-toggle [value]="PaymentMethod.Card" class="method-btn">
            <mat-icon>credit_card</mat-icon>
            Card
          </mat-button-toggle>
        </mat-button-toggle-group>

        <!-- Cash Input -->
        @if (paymentMethod() === PaymentMethod.Cash) {
          <div class="cash-section">
            <h3>Amount Tendered</h3>
            <div class="cash-display">
              {{ cashAmount() | currency }}
            </div>
            <div class="quick-amounts">
              @for (amount of quickAmounts(); track amount) {
                <button
                  mat-stroked-button
                  (click)="setCashAmount(amount)"
                  [class.selected]="cashAmount() === amount"
                >
                  {{ amount | currency }}
                </button>
              }
              <button mat-stroked-button (click)="setCashAmount(cart.total())">Exact</button>
            </div>
            <div class="numpad">
              @for (key of numKeys; track key) {
                <button mat-flat-button class="num-btn" (click)="onNumKey(key)">{{ key }}</button>
              }
              <button mat-flat-button class="num-btn" (click)="onNumKey('.')">.</button>
              <button mat-flat-button class="num-btn" (click)="onNumKey('0')">0</button>
              <button mat-flat-button class="num-btn" (click)="clearCash()">C</button>
            </div>
            @if (change() > 0) {
              <div class="change-display">
                Change: <strong>{{ change() | currency }}</strong>
              </div>
            }
          </div>
        }

        <!-- Submit -->
        <button
          mat-flat-button
          color="primary"
          class="submit-btn"
          [disabled]="!canSubmit() || submitting()"
          (click)="onSubmit()"
        >
          @if (submitting()) {
            <mat-spinner diameter="24" color="accent"></mat-spinner>
          } @else if (paymentMethod() === PaymentMethod.Cash) {
            Complete — Change {{ change() | currency }}
          } @else {
            Process Card Payment
          }
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .checkout-layout {
        height: 100%;
        overflow-y: auto;
        display: flex;
        justify-content: center;
        padding: 16px;
      }
      .checkout-content {
        max-width: 560px;
        width: 100%;
      }
      .back-btn {
        margin-bottom: 8px;
      }
      h1 {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 16px;
      }
      h2 {
        font-size: 18px;
        font-weight: 600;
        margin: 24px 0 12px;
      }
      h3 {
        font-size: 15px;
        font-weight: 600;
        margin: 16px 0 8px;
      }
      .order-summary {
        background: var(--mat-sys-surface-container);
        border-radius: 12px;
        padding: 16px;
      }
      .summary-line {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 14px;
      }
      .summary-line.total {
        font-size: 18px;
        font-weight: 700;
        padding-top: 12px;
        margin-top: 8px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
      .notes-display {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        margin-top: 12px;
        font-size: 14px;
        opacity: 0.7;
        background: var(--mat-sys-surface-container);
        border-radius: 8px;
      }
      .payment-toggle {
        width: 100%;
      }
      .method-btn {
        flex: 1;
        height: 56px;
        font-size: 16px;
      }
      .method-btn mat-icon {
        margin-right: 8px;
      }
      .cash-section {
        margin-top: 8px;
      }
      .cash-display {
        font-size: 32px;
        font-weight: 700;
        text-align: center;
        padding: 16px;
        background: var(--mat-sys-surface-container);
        border-radius: 12px;
      }
      .quick-amounts {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
      }
      .quick-amounts button {
        flex: 1;
        min-width: 72px;
        height: 44px;
      }
      .quick-amounts button.selected {
        border-color: var(--mat-sys-primary);
        color: var(--mat-sys-primary);
      }
      .numpad {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 12px;
      }
      .num-btn {
        height: 56px;
        font-size: 20px;
        font-weight: 500;
      }
      .change-display {
        text-align: center;
        font-size: 20px;
        padding: 16px;
        margin-top: 12px;
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
        border-radius: 12px;
      }
      .submit-btn {
        width: 100%;
        height: 56px;
        font-size: 18px;
        font-weight: 600;
        margin-top: 24px;
        margin-bottom: 24px;
      }
    `,
  ],
})
export class CheckoutPage {
  protected readonly cart = inject(CartStore);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly printer = inject(PrinterService);
  private readonly cashDrawer = inject(CashDrawerService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);

  protected readonly PaymentMethod = PaymentMethod;
  protected readonly paymentMethod = signal<PaymentMethod>(PaymentMethod.Cash);
  protected readonly cashInput = signal('');
  protected readonly submitting = signal(false);

  protected readonly cashAmount = computed(() => {
    const val = parseFloat(this.cashInput());
    return isNaN(val) ? 0 : val;
  });

  protected readonly change = computed(() =>
    Math.max(0, Math.round((this.cashAmount() - this.cart.total()) * 100) / 100),
  );

  protected readonly canSubmit = computed(() => {
    if (this.cart.isEmpty()) return false;
    if (this.paymentMethod() === PaymentMethod.Cash) {
      return this.cashAmount() >= this.cart.total();
    }
    return true; // Card always submittable
  });

  protected readonly quickAmounts = computed(() => {
    const total = this.cart.total();
    const amounts = [5, 10, 20, 50, 100].filter((a) => a >= total);
    return amounts.slice(0, 4);
  });

  readonly numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  protected lineTotal(item: {
    unitPrice: number;
    quantity: number;
    modifierItems: { price: number }[];
  }): number {
    const modTotal = item.modifierItems.reduce((s, m) => s + m.price, 0);
    return (item.unitPrice + modTotal) * item.quantity;
  }

  protected setCashAmount(amount: number): void {
    this.cashInput.set(amount.toFixed(2));
  }

  protected onNumKey(key: string): void {
    const current = this.cashInput();
    if (key === '.' && current.includes('.')) return;
    // Limit to 2 decimal places
    if (current.includes('.') && current.split('.')[1].length >= 2) return;
    this.cashInput.update((v) => v + key);
  }

  protected clearCash(): void {
    this.cashInput.set('');
  }

  protected onBack(): void {
    this.router.navigate(['/register']);
  }

  protected async onSubmit(): Promise<void> {
    this.submitting.set(true);

    try {
      const orderDto = this.cart.toCreateOrderDto();
      const order = await this.orderService.createOrder(orderDto);

      const isCash = this.paymentMethod() === PaymentMethod.Cash;
      const amountTendered = isCash ? this.cashAmount() : this.cart.total();
      const changeGiven = isCash ? this.change() : 0;

      const paymentDto: CreatePaymentDto = {
        orderId: order.id!,
        method: this.paymentMethod(),
        amountTendered,
        total: this.cart.total(),
      };

      await this.orderService.createPayment(paymentDto);

      // Build receipt data before clearing cart
      const receiptData: ReceiptData = {
        storeName: this.settings.storeName,
        orderNumber: order.displayOrderNumber!,
        cashierName: this.auth.currentUser()?.displayName ?? undefined,
        lineItems: this.cart.lineItems().map((li) => ({
          name: li.productName,
          variant: li.variantName ?? undefined,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          lineTotal: this.lineTotal(li),
          modifiers: li.modifierItems.map((m) => ({ name: m.optionName, price: m.price })),
        })),
        subtotal: this.cart.subtotal(),
        taxRate: order.taxRate!,
        taxAmount: this.cart.taxAmount(),
        total: this.cart.total(),
        paymentMethod: isCash ? 'Cash' : 'Card',
        amountTendered,
        changeGiven,
        dateTime: new Date(),
      };

      const isOffline = this.orderService.wasOffline;
      const displayTotal = isOffline ? this.cart.total() : order.total!;

      this.cart.clear();

      // Print receipt and open cash drawer (non-blocking — don't fail the order)
      if (!isOffline) {
        this.printAndKick(receiptData, isCash);
      }

      this.router.navigate(['/order-complete'], {
        state: {
          orderNumber: order.displayOrderNumber,
          total: displayTotal,
          paymentMethod: this.paymentMethod(),
          change: changeGiven,
          offline: isOffline,
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'status' in err
            ? `Server error (${(err as { status: number }).status})`
            : 'Payment failed. Please try again.';
      this.snackBar.open(message, 'Dismiss', { duration: 5000 });
      this.submitting.set(false);
    }
  }

  private async printAndKick(receipt: ReceiptData, openDrawer: boolean): Promise<void> {
    try {
      if (this.printer.isConnected) {
        const bytes = buildReceipt(receipt);
        await this.printer.print(bytes);
        if (openDrawer) {
          await this.cashDrawer.kick();
        }
      }
    } catch {
      // Printing failures should not block the order flow
      this.snackBar.open('Receipt printing failed.', 'Dismiss', { duration: 3000 });
    }
  }
}
