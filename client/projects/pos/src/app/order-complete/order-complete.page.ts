import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppCurrencyPipe } from '../services/app-currency.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { PaymentMethod } from 'api-client';

interface OrderCompleteState {
  orderNumber: string;
  total: number;
  paymentMethod: PaymentMethod;
  change: number;
  offline: boolean;
}

@Component({
  selector: 'app-order-complete-page',
  standalone: true,
  imports: [AppCurrencyPipe, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <div class="complete-container">
      <mat-card class="complete-card">
        <mat-card-content>
          <div class="success-icon">
            <mat-icon>{{ orderState().offline ? 'cloud_off' : 'check_circle' }}</mat-icon>
          </div>
          <h1>{{ orderState().offline ? 'Order Queued' : 'Order Complete' }}</h1>
          @if (orderState().offline) {
            <div class="offline-notice">
              This order was saved offline and will sync when the connection is restored.
            </div>
          }
          <div class="order-number">#{{ orderState().orderNumber }}</div>

          <div class="details">
            <div class="detail-row">
              <span>Total</span>
              <span>{{ orderState().total | appCurrency }}</span>
            </div>
            <div class="detail-row">
              <span>Payment</span>
              <span>{{ paymentLabel() }}</span>
            </div>
            @if (orderState().paymentMethod === PaymentMethod.Cash && orderState().change > 0) {
              <div class="detail-row change">
                <span>Change</span>
                <span>{{ orderState().change | appCurrency }}</span>
              </div>
            }
          </div>

          <button mat-flat-button color="primary" class="new-order-btn" (click)="onNewOrder()">
            <mat-icon>add</mat-icon>
            New Order
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .complete-container {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: var(--mat-sys-surface-container-low);
      }
      .complete-card {
        padding: 40px;
        text-align: center;
        min-width: 400px;
        border-radius: 16px;
      }
      .success-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .success-icon mat-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        color: #4caf50;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .offline-notice {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 14px;
        margin-bottom: 16px;
      }
      h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 16px 0 8px;
      }
      .order-number {
        font-size: 20px;
        opacity: 0.7;
        margin-bottom: 24px;
      }
      .details {
        background: var(--mat-sys-surface-container);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 16px;
      }
      .detail-row.change {
        font-weight: 700;
        font-size: 18px;
        padding-top: 12px;
        margin-top: 8px;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
      .new-order-btn {
        width: 100%;
        height: 56px;
        font-size: 18px;
        font-weight: 600;
        border-radius: 12px;
      }
      .new-order-btn mat-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
        margin-right: 4px;
      }
    `,
  ],
})
export class OrderCompletePage implements OnInit {
  private readonly router = inject(Router);
  protected readonly PaymentMethod = PaymentMethod;

  protected readonly orderState = signal<OrderCompleteState>({
    orderNumber: '',
    total: 0,
    paymentMethod: PaymentMethod.Cash,
    change: 0,
    offline: false,
  });

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state ?? history.state;
    if (state?.orderNumber) {
      this.orderState.set({
        orderNumber: state.orderNumber,
        total: state.total,
        paymentMethod: state.paymentMethod,
        change: state.change ?? 0,
        offline: state.offline ?? false,
      });
    }
  }

  protected paymentLabel(): string {
    return this.orderState().paymentMethod === PaymentMethod.Cash ? 'Cash' : 'Card';
  }

  onNewOrder(): void {
    this.router.navigate(['/register']);
  }
}
