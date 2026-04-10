import { Component, inject, signal, OnInit, Inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AppCurrencyPipe } from '../services/app-currency.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CLIENT_TOKEN, IClient, OrderDto } from 'api-client';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    AppCurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDividerModule,
    MatCardModule,
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

      <mat-card class="details-card">
        <mat-card-content>
          <div class="info-row">
            <span>Date</span><span>{{ order()!.createdAtUtc | date: 'medium' }}</span>
          </div>
          <div class="info-row">
            <span>Cashier</span><span>{{ order()!.cashierName ?? 'N/A' }}</span>
          </div>
          @if (order()!.notes) {
            <div class="info-row">
              <span>Notes</span><span>{{ order()!.notes }}</span>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="items-card">
        <mat-card-header><mat-card-title>Items</mat-card-title></mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="order()!.lineItems!" class="items-table">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef>Product</th>
              <td mat-cell *matCellDef="let li">
                {{ li.productName }}
                @if (li.variantName) {
                  <span class="variant">({{ li.variantName }})</span>
                }
                @for (mod of li.modifierItems; track mod.optionName) {
                  <div class="modifier">
                    + {{ mod.optionName }}
                    @if (mod.price > 0) {
                      ({{ mod.price | appCurrency }})
                    }
                  </div>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="qty">
              <th mat-header-cell *matHeaderCellDef>Qty</th>
              <td mat-cell *matCellDef="let li">{{ li.quantity }}</td>
            </ng-container>
            <ng-container matColumnDef="unitPrice">
              <th mat-header-cell *matHeaderCellDef>Price</th>
              <td mat-cell *matCellDef="let li">{{ li.unitPrice | appCurrency }}</td>
            </ng-container>
            <ng-container matColumnDef="lineTotal">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let li">{{ li.lineTotal | appCurrency }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="itemColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: itemColumns"></tr>
          </table>
        </mat-card-content>
      </mat-card>

      <mat-card class="totals-card">
        <mat-card-content>
          <div class="info-row">
            <span>Subtotal</span><span>{{ order()!.subtotal | appCurrency }}</span>
          </div>
          <div class="info-row">
            <span>VAT ({{ (order()!.taxRate! * 100).toFixed(1) }}%)</span>
            <span>{{ order()!.taxAmount | appCurrency }}</span>
          </div>
          @if (order()!.orderDiscountAmount! > 0) {
            <div class="info-row discount">
              <span>Discount</span>
              <span>-{{ order()!.orderDiscountAmount | appCurrency }}</span>
            </div>
          }
          <mat-divider />
          <div class="info-row total">
            <span>Total</span><span>{{ order()!.total | appCurrency }}</span>
          </div>

          @for (p of order()!.payments; track p.id) {
            <div class="info-row payment">
              <span>{{ p.method }}</span>
              <span>{{ p.amountTendered | appCurrency }}</span>
            </div>
            @if (p.changeGiven! > 0) {
              <div class="info-row change">
                <span>Change</span>
                <span>{{ p.changeGiven | appCurrency }}</span>
              </div>
            }
          }
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
        padding: 16px;
      }
      .header h1 {
        margin: 0;
        font-size: 20px;
      }
      .details-card,
      .items-card,
      .totals-card {
        margin: 0 16px 16px;
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
      .info-row.discount {
        color: #e65100;
      }
      .info-row.payment {
        opacity: 0.7;
      }
      .info-row.change {
        opacity: 0.5;
        font-size: 13px;
      }
      .items-table {
        width: 100%;
      }
      .variant {
        opacity: 0.7;
      }
      .modifier {
        font-size: 12px;
        opacity: 0.6;
        padding-left: 8px;
      }
    `,
  ],
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  readonly order = signal<OrderDto | null>(null);
  readonly loading = signal(true);
  readonly itemColumns = ['product', 'qty', 'unitPrice', 'lineTotal'];

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    try {
      const order = await firstValueFrom(this.client.orders_GetOrder(id));
      this.order.set(order);
    } finally {
      this.loading.set(false);
    }
  }

  onBack() {
    this.router.navigate(['/history']);
  }
}
