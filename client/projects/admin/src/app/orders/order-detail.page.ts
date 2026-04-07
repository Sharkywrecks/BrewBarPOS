import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import {
  CLIENT_TOKEN,
  IClient,
  OrderDto,
  PaymentDto,
  PaymentStatus,
  OrderStatus,
  API_BASE_URL,
} from 'api-client';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else if (order()) {
      <div class="header">
        <button mat-button (click)="onBack()"><mat-icon>arrow_back</mat-icon> Orders</button>
        <h1>Order #{{ order()!.displayOrderNumber }}</h1>
        <mat-chip>{{ order()!.status }}</mat-chip>
      </div>

      <div class="grid">
        <!-- Order Info -->
        <mat-card>
          <mat-card-header><mat-card-title>Details</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="info-row">
              <span>Date</span><span>{{ order()!.createdAtUtc | date: 'medium' }}</span>
            </div>
            <div class="info-row">
              <span>Cashier</span><span>{{ order()!.cashierName ?? 'N/A' }}</span>
            </div>
            <div class="info-row">
              <span>Subtotal</span><span>{{ order()!.subtotal | currency }}</span>
            </div>
            <div class="info-row">
              <span>Tax ({{ (order()!.taxRate! * 100).toFixed(1) }}%)</span
              ><span>{{ order()!.taxAmount | currency }}</span>
            </div>
            <mat-divider />
            <div class="info-row total">
              <span>Total</span><span>{{ order()!.total | currency }}</span>
            </div>
            @if (order()!.notes) {
              <div class="notes">{{ order()!.notes }}</div>
            }
          </mat-card-content>
          <mat-card-actions>
            @if (order()!.status !== OrderStatus.Voided) {
              <button mat-stroked-button color="warn" (click)="onVoid()" [disabled]="actioning()">
                <mat-icon>block</mat-icon> Void Order
              </button>
            }
          </mat-card-actions>
        </mat-card>

        <!-- Payments -->
        <mat-card>
          <mat-card-header><mat-card-title>Payments</mat-card-title></mat-card-header>
          <mat-card-content>
            @for (p of payments(); track p.id) {
              <div class="payment-row">
                <div>
                  <strong>{{ p.method }}</strong>
                  <mat-chip [class.refunded]="p.status === PaymentStatus.Refunded">{{
                    p.status
                  }}</mat-chip>
                </div>
                <div class="payment-amounts">
                  <span>{{ p.total | currency }}</span>
                  @if (p.changeGiven! > 0) {
                    <span class="change">Change: {{ p.changeGiven | currency }}</span>
                  }
                </div>
                @if (p.status === PaymentStatus.Completed) {
                  <button
                    mat-stroked-button
                    color="warn"
                    (click)="onRefund(p.id!)"
                    [disabled]="actioning()"
                  >
                    Refund
                  </button>
                }
              </div>
            } @empty {
              <p class="empty">No payments recorded.</p>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Line Items -->
      <mat-card class="items-card">
        <mat-card-header><mat-card-title>Line Items</mat-card-title></mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="order()!.lineItems!" class="items-table">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef>Product</th>
              <td mat-cell *matCellDef="let li">
                {{ li.productName }}
                @if (li.variantName) {
                  ({{ li.variantName }})
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="qty">
              <th mat-header-cell *matHeaderCellDef>Qty</th>
              <td mat-cell *matCellDef="let li">{{ li.quantity }}</td>
            </ng-container>
            <ng-container matColumnDef="unitPrice">
              <th mat-header-cell *matHeaderCellDef>Unit Price</th>
              <td mat-cell *matCellDef="let li">{{ li.unitPrice | currency }}</td>
            </ng-container>
            <ng-container matColumnDef="lineTotal">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let li">{{ li.lineTotal | currency }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="itemColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: itemColumns"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [
    `
      .spinner {
        margin: 48px auto;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 14px;
      }
      .info-row.total {
        font-weight: 700;
        font-size: 18px;
        padding-top: 12px;
      }
      .notes {
        margin-top: 12px;
        padding: 8px 12px;
        background: var(--mat-sys-surface-container);
        border-radius: 8px;
        font-size: 14px;
      }
      .payment-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .payment-amounts {
        text-align: right;
      }
      .change {
        display: block;
        font-size: 12px;
        opacity: 0.7;
      }
      .empty {
        opacity: 0.5;
        font-style: italic;
      }
      .items-card {
        margin-top: 0;
      }
      .items-table {
        width: 100%;
      }
    `,
  ],
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly client = inject(CLIENT_TOKEN) as IClient;
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly PaymentStatus = PaymentStatus;
  protected readonly OrderStatus = OrderStatus;
  readonly order = signal<OrderDto | null>(null);
  readonly payments = signal<PaymentDto[]>([]);
  readonly loading = signal(true);
  readonly actioning = signal(false);
  readonly itemColumns = ['product', 'qty', 'unitPrice', 'lineTotal'];

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    await this.loadOrder(id);
  }

  private async loadOrder(id: number) {
    this.loading.set(true);
    try {
      const [order, payments] = await Promise.all([
        firstValueFrom(this.client.orders_GetOrder(id)),
        firstValueFrom(this.client.payments_GetPaymentsByOrder(id)),
      ]);
      this.order.set(order);
      this.payments.set(payments as PaymentDto[]);
    } finally {
      this.loading.set(false);
    }
  }

  async onVoid() {
    const id = this.order()?.id;
    if (!id) return;
    this.actioning.set(true);
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/api/orders/${id}/void`, {}));
      await this.loadOrder(id);
      this.snackBar.open('Order voided.', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Failed to void order.', 'Dismiss', { duration: 5000 });
    } finally {
      this.actioning.set(false);
    }
  }

  async onRefund(paymentId: number) {
    this.actioning.set(true);
    try {
      await firstValueFrom(this.http.post(`${this.baseUrl}/api/payments/${paymentId}/refund`, {}));
      await this.loadOrder(this.order()!.id!);
      this.snackBar.open('Payment refunded.', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Failed to refund payment.', 'Dismiss', { duration: 5000 });
    } finally {
      this.actioning.set(false);
    }
  }

  onBack() {
    this.router.navigate(['/orders']);
  }
}
