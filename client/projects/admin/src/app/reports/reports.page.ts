import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { AppCurrencyPipe } from 'ui';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { API_BASE_URL } from 'api-client';
import { firstValueFrom } from 'rxjs';

interface DailyReport {
  date: string;
  orderCount: number;
  voidedCount: number;
  itemsSold: number;
  grossSales: number;
  taxCollected: number;
  netSales: number;
  cashTotal: number;
  cardTotal: number;
  averageOrderValue: number;
  hourlySales: { hour: number; orderCount: number; total: number }[];
}

interface ProductPerf {
  productId: number;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
}

interface PaymentSummary {
  cashTotal: number;
  cashCount: number;
  cardTotal: number;
  cardCount: number;
  refundTotal: number;
  refundCount: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    AppCurrencyPipe,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatProgressBarModule,
    MatDatepickerModule,
  ],
  template: `
    <div class="header">
      <h1>Reports</h1>
      <div class="header-controls">
        <div class="date-presets">
          <button
            mat-stroked-button
            (click)="setPreset('today')"
            [class.active]="activePreset === 'today'"
          >
            Today
          </button>
          <button
            mat-stroked-button
            (click)="setPreset('yesterday')"
            [class.active]="activePreset === 'yesterday'"
          >
            Yesterday
          </button>
          <button
            mat-stroked-button
            (click)="setPreset('last7')"
            [class.active]="activePreset === 'last7'"
          >
            Last 7 days
          </button>
          <button
            mat-stroked-button
            (click)="setPreset('last30')"
            [class.active]="activePreset === 'last30'"
          >
            Last 30 days
          </button>
          <button
            mat-stroked-button
            (click)="setPreset('thisMonth')"
            [class.active]="activePreset === 'thisMonth'"
          >
            This month
          </button>
        </div>
        <div class="date-range">
          <mat-form-field appearance="outline">
            <mat-label>From</mat-label>
            <input
              matInput
              [matDatepicker]="fromPicker"
              [(ngModel)]="fromDate"
              (dateChange)="onDateChange()"
            />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
            <mat-datepicker #fromPicker></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>To</mat-label>
            <input
              matInput
              [matDatepicker]="toPicker"
              [(ngModel)]="toDate"
              (dateChange)="onDateChange()"
            />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
            <mat-datepicker #toPicker></mat-datepicker>
          </mat-form-field>
        </div>
      </div>
    </div>

    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else if (daily()) {
      <!-- KPI Cards -->
      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-icon>receipt_long</mat-icon>
          <div class="kpi-value">{{ daily()!.orderCount }}</div>
          <div class="kpi-label">Orders</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>attach_money</mat-icon>
          <div class="kpi-value">{{ daily()!.grossSales | appCurrency }}</div>
          <div class="kpi-label">Gross Sales</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>account_balance</mat-icon>
          <div class="kpi-value">{{ daily()!.netSales | appCurrency }}</div>
          <div class="kpi-label">Net Sales</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>trending_up</mat-icon>
          <div class="kpi-value">{{ daily()!.averageOrderValue | appCurrency }}</div>
          <div class="kpi-label">Avg Order</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>shopping_cart</mat-icon>
          <div class="kpi-value">{{ daily()!.itemsSold }}</div>
          <div class="kpi-label">Items Sold</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>block</mat-icon>
          <div class="kpi-value">{{ daily()!.voidedCount }}</div>
          <div class="kpi-label">Voided</div>
        </mat-card>
      </div>

      <!-- Payment Breakdown -->
      <div class="section-grid">
        <mat-card>
          <mat-card-header><mat-card-title>Payment Methods</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (paymentSummary()) {
              <div class="payment-bar">
                <div class="bar-label">Cash</div>
                <div class="bar-row">
                  <mat-progress-bar mode="determinate" [value]="cashPercent()"></mat-progress-bar>
                  <span
                    >{{ paymentSummary()!.cashTotal | appCurrency }} ({{
                      paymentSummary()!.cashCount
                    }})</span
                  >
                </div>
              </div>
              <div class="payment-bar">
                <div class="bar-label">Card</div>
                <div class="bar-row">
                  <mat-progress-bar
                    mode="determinate"
                    color="accent"
                    [value]="cardPercent()"
                  ></mat-progress-bar>
                  <span
                    >{{ paymentSummary()!.cardTotal | appCurrency }} ({{
                      paymentSummary()!.cardCount
                    }})</span
                  >
                </div>
              </div>
              @if (paymentSummary()!.refundCount > 0) {
                <div class="payment-bar">
                  <div class="bar-label">Refunds</div>
                  <span class="refund-text"
                    >{{ paymentSummary()!.refundTotal | appCurrency }} ({{
                      paymentSummary()!.refundCount
                    }})</span
                  >
                </div>
              }
            }
          </mat-card-content>
        </mat-card>

        <!-- Hourly Sales -->
        <mat-card>
          <mat-card-header><mat-card-title>Hourly Sales</mat-card-title></mat-card-header>
          <mat-card-content>
            <div class="hourly-chart">
              @for (h of daily()!.hourlySales; track h.hour) {
                <div
                  class="hour-bar"
                  [title]="h.hour + ':00 — ' + h.orderCount + ' orders, ' + (h.total | appCurrency)"
                >
                  <div class="hour-fill" [style.height.%]="hourPercent(h.total)"></div>
                  <div class="hour-label">{{ h.hour }}</div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Top Products -->
      <mat-card>
        <mat-card-header><mat-card-title>Top Products</mat-card-title></mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="topProducts()" class="products-table">
            <ng-container matColumnDef="rank">
              <th mat-header-cell *matHeaderCellDef>#</th>
              <td mat-cell *matCellDef="let p; let i = index">{{ i + 1 }}</td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Product</th>
              <td mat-cell *matCellDef="let p">{{ p.productName }}</td>
            </ng-container>
            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Category</th>
              <td mat-cell *matCellDef="let p">{{ p.categoryName }}</td>
            </ng-container>
            <ng-container matColumnDef="units">
              <th mat-header-cell *matHeaderCellDef>Units</th>
              <td mat-cell *matCellDef="let p">{{ p.unitsSold }}</td>
            </ng-container>
            <ng-container matColumnDef="revenue">
              <th mat-header-cell *matHeaderCellDef>Revenue</th>
              <td mat-cell *matCellDef="let p">{{ p.revenue | appCurrency }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="productColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: productColumns"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    } @else {
      <p class="empty">No data for the selected date.</p>
    }
  `,
  styles: [
    `
      .header {
        margin-bottom: 16px;
      }
      .header-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 8px;
      }
      .date-presets {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .date-presets button.active {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
      }
      .date-range {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .date-range mat-form-field {
        width: 180px;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .kpi-card {
        text-align: center;
        padding: 16px;
      }
      .kpi-card mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: var(--mat-sys-primary);
      }
      .kpi-value {
        font-size: 24px;
        font-weight: 700;
        margin: 4px 0;
      }
      .kpi-label {
        font-size: 13px;
        opacity: 0.6;
      }
      .section-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      .payment-bar {
        margin-bottom: 12px;
      }
      .bar-label {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 4px;
      }
      .bar-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .bar-row mat-progress-bar {
        flex: 1;
      }
      .bar-row span {
        font-size: 13px;
        white-space: nowrap;
      }
      .refund-text {
        color: var(--mat-sys-error);
        font-size: 13px;
      }
      .hourly-chart {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 120px;
        padding-top: 8px;
      }
      .hour-bar {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        height: 100%;
      }
      .hour-fill {
        width: 100%;
        background: var(--mat-sys-primary);
        border-radius: 4px 4px 0 0;
        min-height: 2px;
        transition: height 0.3s;
      }
      .hour-label {
        font-size: 10px;
        opacity: 0.5;
        margin-top: 4px;
      }
      .products-table {
        width: 100%;
      }
      .spinner {
        margin: 48px auto;
      }
      .empty {
        text-align: center;
        opacity: 0.5;
        margin-top: 48px;
      }
    `,
  ],
})
export class ReportsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  readonly daily = signal<DailyReport | null>(null);
  readonly topProducts = signal<ProductPerf[]>([]);
  readonly paymentSummary = signal<PaymentSummary | null>(null);
  readonly loading = signal(false);

  fromDate: Date | null = null;
  toDate: Date | null = null;
  activePreset: string | null = null;
  readonly productColumns = ['rank', 'name', 'category', 'units', 'revenue'];

  private maxHourlyTotal = 1;

  async ngOnInit() {
    this.setPreset('today');
  }

  setPreset(preset: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    this.activePreset = preset;
    switch (preset) {
      case 'today':
        this.fromDate = startOfToday;
        this.toDate = startOfToday;
        break;
      case 'yesterday': {
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        this.fromDate = yesterday;
        this.toDate = yesterday;
        break;
      }
      case 'last7': {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - 6);
        this.fromDate = d;
        this.toDate = startOfToday;
        break;
      }
      case 'last30': {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - 29);
        this.fromDate = d;
        this.toDate = startOfToday;
        break;
      }
      case 'thisMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.toDate = startOfToday;
        break;
    }
    this.loadAll();
  }

  onDateChange() {
    this.activePreset = null;
    if (this.fromDate) {
      this.loadAll();
    }
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  async loadAll() {
    if (!this.fromDate) return;
    this.loading.set(true);
    try {
      const from = this.formatDate(this.fromDate);
      const to = this.toDate ? this.formatDate(this.toDate) : from;
      const [daily, products, payments] = await Promise.all([
        firstValueFrom(
          this.http.get<DailyReport>(`${this.baseUrl}/api/reports/daily?date=${from}`),
        ),
        firstValueFrom(
          this.http.get<ProductPerf[]>(
            `${this.baseUrl}/api/reports/products?from=${from}&to=${to}&limit=10`,
          ),
        ),
        firstValueFrom(
          this.http.get<PaymentSummary>(
            `${this.baseUrl}/api/reports/payments?from=${from}&to=${to}`,
          ),
        ),
      ]);
      this.daily.set(daily);
      this.topProducts.set(products);
      this.paymentSummary.set(payments);
      this.maxHourlyTotal = Math.max(1, ...daily.hourlySales.map((h) => h.total));
    } finally {
      this.loading.set(false);
    }
  }

  cashPercent(): number {
    const s = this.paymentSummary();
    if (!s) return 0;
    const total = s.cashTotal + s.cardTotal;
    return total > 0 ? (s.cashTotal / total) * 100 : 0;
  }

  cardPercent(): number {
    const s = this.paymentSummary();
    if (!s) return 0;
    const total = s.cashTotal + s.cardTotal;
    return total > 0 ? (s.cardTotal / total) * 100 : 0;
  }

  hourPercent(total: number): number {
    return (total / this.maxHourlyTotal) * 100;
  }
}
