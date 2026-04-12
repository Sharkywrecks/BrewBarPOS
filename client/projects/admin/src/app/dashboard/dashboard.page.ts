import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { API_BASE_URL } from 'api-client';
import { AppCurrencyPipe } from 'ui';

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

interface SalesRange {
  from: string;
  to: string;
  totalOrders: number;
  grossSales: number;
  taxCollected: number;
  netSales: number;
  dailyBreakdown: { date: string; orderCount: number; total: number }[];
}

interface ProductPerf {
  productId: number;
  productName: string;
  categoryName: string;
  unitsSold: number;
  revenue: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatIconModule, MatProgressSpinnerModule, AppCurrencyPipe],
  template: `
    <div class="header">
      <h1>Dashboard</h1>
      <div class="today">{{ todayLabel }}</div>
    </div>

    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else {
      <!-- KPIs for today -->
      <div class="kpi-grid">
        <mat-card class="kpi-card">
          <mat-icon>attach_money</mat-icon>
          <div class="kpi-value">{{ today()?.grossSales ?? 0 | appCurrency }}</div>
          <div class="kpi-label">Gross Sales Today</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>receipt_long</mat-icon>
          <div class="kpi-value">{{ today()?.orderCount ?? 0 }}</div>
          <div class="kpi-label">Orders Today</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>shopping_cart</mat-icon>
          <div class="kpi-value">{{ today()?.itemsSold ?? 0 }}</div>
          <div class="kpi-label">Items Sold</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>trending_up</mat-icon>
          <div class="kpi-value">{{ today()?.averageOrderValue ?? 0 | appCurrency }}</div>
          <div class="kpi-label">Avg Order</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>payments</mat-icon>
          <div class="kpi-value">{{ today()?.cashTotal ?? 0 | appCurrency }}</div>
          <div class="kpi-label">Cash</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>credit_card</mat-icon>
          <div class="kpi-value">{{ today()?.cardTotal ?? 0 | appCurrency }}</div>
          <div class="kpi-label">Card</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>account_balance</mat-icon>
          <div class="kpi-value">{{ today()?.netSales ?? 0 | appCurrency }}</div>
          <div class="kpi-label">Net (ex-VAT)</div>
        </mat-card>
        <mat-card class="kpi-card">
          <mat-icon>block</mat-icon>
          <div class="kpi-value">{{ today()?.voidedCount ?? 0 }}</div>
          <div class="kpi-label">Voided</div>
        </mat-card>
      </div>

      <div class="section-grid">
        <!-- 7-day trend -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>Last 7 Days</mat-card-title>
            <mat-card-subtitle
              >{{ weekTotal() | appCurrency }} · {{ weekOrders() }} orders</mat-card-subtitle
            >
          </mat-card-header>
          <mat-card-content>
            @if (weeklySeries().length > 0) {
              <div class="trend-chart">
                @for (d of weeklySeries(); track d.date) {
                  <div
                    class="trend-bar"
                    [title]="d.date + ' — ' + d.orderCount + ' orders, ' + (d.total | appCurrency)"
                  >
                    <div class="trend-fill" [style.height.%]="trendPercent(d.total)"></div>
                    <div class="trend-label">{{ shortDay(d.date) }}</div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-inline">No sales in the last 7 days</div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Top products today -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>Top Products Today</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (topProducts().length > 0) {
              <ul class="top-list">
                @for (p of topProducts(); track p.productId; let i = $index) {
                  <li>
                    <span class="rank">{{ i + 1 }}</span>
                    <span class="name">{{ p.productName }}</span>
                    <span class="meta">{{ p.unitsSold }} ×</span>
                    <span class="revenue">{{ p.revenue | appCurrency }}</span>
                  </li>
                }
              </ul>
            } @else {
              <div class="empty-inline">No items sold today yet</div>
            }
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Quick nav -->
      <div class="nav-grid">
        <mat-card class="nav-card" routerLink="/catalog">
          <mat-card-content>
            <mat-icon>restaurant_menu</mat-icon>
            <div class="nav-label">Catalog</div>
            <div class="nav-hint">Manage categories, products, modifiers</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="nav-card" routerLink="/menu-import">
          <mat-card-content>
            <mat-icon>upload_file</mat-icon>
            <div class="nav-label">Menu Import</div>
            <div class="nav-hint">Bulk-import menu from Excel</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="nav-card" routerLink="/orders">
          <mat-card-content>
            <mat-icon>receipt_long</mat-icon>
            <div class="nav-label">Orders</div>
            <div class="nav-hint">View order history and details</div>
          </mat-card-content>
        </mat-card>
        <mat-card class="nav-card" routerLink="/reports">
          <mat-card-content>
            <mat-icon>bar_chart</mat-icon>
            <div class="nav-label">Reports</div>
            <div class="nav-hint">Sales analytics and breakdowns</div>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
  styles: [
    `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 16px;
      }
      .today {
        opacity: 0.6;
        font-size: 14px;
      }
      .spinner {
        margin: 48px auto;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
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
        font-size: 22px;
        font-weight: 700;
        margin: 4px 0;
      }
      .kpi-label {
        font-size: 12px;
        opacity: 0.6;
      }
      .section-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      @media (max-width: 900px) {
        .section-grid {
          grid-template-columns: 1fr;
        }
      }
      .trend-chart {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        height: 140px;
        padding-top: 8px;
      }
      .trend-bar {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        height: 100%;
      }
      .trend-fill {
        width: 100%;
        background: var(--mat-sys-primary);
        border-radius: 4px 4px 0 0;
        min-height: 2px;
        transition: height 0.3s;
      }
      .trend-label {
        font-size: 11px;
        opacity: 0.6;
        margin-top: 4px;
      }
      .top-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .top-list li {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        font-size: 14px;
      }
      .top-list li:last-child {
        border-bottom: none;
      }
      .top-list .rank {
        font-weight: 700;
        width: 20px;
        opacity: 0.5;
      }
      .top-list .name {
        flex: 1;
      }
      .top-list .meta {
        opacity: 0.6;
        font-size: 12px;
      }
      .top-list .revenue {
        font-weight: 600;
      }
      .empty-inline {
        text-align: center;
        opacity: 0.5;
        padding: 24px 0;
        font-size: 13px;
      }
      .nav-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 12px;
      }
      .nav-card {
        cursor: pointer;
        transition: transform 0.15s;
      }
      .nav-card:hover {
        transform: translateY(-2px);
      }
      .nav-card mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: var(--mat-sys-primary);
        margin-bottom: 8px;
      }
      .nav-label {
        font-size: 16px;
        font-weight: 500;
      }
      .nav-hint {
        font-size: 12px;
        opacity: 0.6;
        margin-top: 4px;
      }
    `,
  ],
})
export class DashboardPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  readonly today = signal<DailyReport | null>(null);
  readonly week = signal<SalesRange | null>(null);
  readonly topProducts = signal<ProductPerf[]>([]);
  readonly loading = signal(true);

  readonly todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  readonly weeklySeries = computed(() => this.week()?.dailyBreakdown ?? []);
  readonly weekTotal = computed(() => this.week()?.grossSales ?? 0);
  readonly weekOrders = computed(() => this.week()?.totalOrders ?? 0);

  private maxTrend = 1;

  async ngOnInit() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const todayFrom = encodeURIComponent(startOfToday.toISOString());
    const todayTo = encodeURIComponent(startOfTomorrow.toISOString());
    const weekFrom = encodeURIComponent(startOfWeekAgo.toISOString());

    try {
      const [daily, week, products] = await Promise.all([
        firstValueFrom(
          this.http.get<DailyReport>(
            `${this.baseUrl}/api/reports/daily?from=${todayFrom}&to=${todayTo}`,
          ),
        ),
        firstValueFrom(
          this.http.get<SalesRange>(
            `${this.baseUrl}/api/reports/sales?from=${weekFrom}&to=${todayTo}`,
          ),
        ),
        firstValueFrom(
          this.http.get<ProductPerf[]>(
            `${this.baseUrl}/api/reports/products?from=${todayFrom}&to=${todayTo}&limit=5`,
          ),
        ),
      ]);
      this.today.set(daily);
      this.week.set(week);
      this.topProducts.set(products);
      this.maxTrend = Math.max(1, ...week.dailyBreakdown.map((d) => d.total));
    } finally {
      this.loading.set(false);
    }
  }

  trendPercent(total: number): number {
    return (total / this.maxTrend) * 100;
  }

  shortDay(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
  }
}
