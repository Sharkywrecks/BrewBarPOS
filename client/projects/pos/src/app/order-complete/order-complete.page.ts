import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { PaymentMethod } from 'api-client';

interface OrderCompleteState {
  orderNumber: string;
  total: number;
  paymentMethod: PaymentMethod;
  change: number;
}

@Component({
  selector: 'app-order-complete-page',
  standalone: true,
  imports: [CurrencyPipe, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <div class="complete-container">
      <mat-card class="complete-card">
        <mat-card-content>
          <div class="success-icon">
            <mat-icon>check_circle</mat-icon>
          </div>
          <h1>Order Complete</h1>
          <div class="order-number">#{{ orderState().orderNumber }}</div>

          <div class="details">
            <div class="detail-row">
              <span>Total</span>
              <span>{{ orderState().total | currency }}</span>
            </div>
            <div class="detail-row">
              <span>Payment</span>
              <span>{{ paymentLabel() }}</span>
            </div>
            @if (orderState().paymentMethod === PaymentMethod.Cash && orderState().change > 0) {
              <div class="detail-row change">
                <span>Change</span>
                <span>{{ orderState().change | currency }}</span>
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
      }
      .success-icon mat-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        color: #4caf50;
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
