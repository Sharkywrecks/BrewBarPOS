import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AppCurrencyPipe } from '../services/app-currency.pipe';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CLIENT_TOKEN, IClient, OrderDto, PaginationOfOrderDto, OrderStatus } from 'api-client';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    AppCurrencyPipe,
    DatePipe,
    FormsModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatPaginatorModule,
  ],
  template: `
    <div class="header">
      <h1>Orders</h1>
    </div>

    <!-- Quick date presets -->
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

    <!-- Filters -->
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="statusFilter" (selectionChange)="onFilterChange()">
          <mat-option [value]="null">All</mat-option>
          <mat-option [value]="OrderStatus.Open">Open</mat-option>
          <mat-option [value]="OrderStatus.Completed">Completed</mat-option>
          <mat-option [value]="OrderStatus.Voided">Voided</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>From</mat-label>
        <input
          matInput
          [matDatepicker]="fromPicker"
          [(ngModel)]="fromDate"
          (dateChange)="onFilterChange()"
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
          (dateChange)="onFilterChange()"
        />
        <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
        <mat-datepicker #toPicker></mat-datepicker>
      </mat-form-field>

      <button mat-stroked-button (click)="clearFilters()"><mat-icon>clear</mat-icon> Clear</button>
    </div>

    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else {
      <table mat-table [dataSource]="orders()" class="orders-table">
        <ng-container matColumnDef="orderNumber">
          <th mat-header-cell *matHeaderCellDef>Order #</th>
          <td mat-cell *matCellDef="let o">{{ o.displayOrderNumber }}</td>
        </ng-container>

        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let o">{{ o.createdAtUtc | date: 'short' }}</td>
        </ng-container>

        <ng-container matColumnDef="items">
          <th mat-header-cell *matHeaderCellDef>Items</th>
          <td mat-cell *matCellDef="let o">{{ o.lineItems?.length ?? 0 }}</td>
        </ng-container>

        <ng-container matColumnDef="total">
          <th mat-header-cell *matHeaderCellDef>Total</th>
          <td mat-cell *matCellDef="let o">{{ o.total | appCurrency }}</td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let o">
            <mat-chip>{{ o.status }}</mat-chip>
          </td>
        </ng-container>

        <ng-container matColumnDef="cashier">
          <th mat-header-cell *matHeaderCellDef>Cashier</th>
          <td mat-cell *matCellDef="let o">{{ o.cashierName }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: columns"
          class="clickable-row"
          (click)="onRowClick(row)"
        ></tr>
      </table>

      @if (orders().length === 0) {
        <p class="empty">No orders found.</p>
      }

      <mat-paginator
        [length]="totalCount()"
        [pageSize]="pageSize"
        [pageIndex]="pageIndex()"
        [pageSizeOptions]="[25, 50, 100]"
        (page)="onPage($event)"
        showFirstLastButtons
      >
      </mat-paginator>
    }
  `,
  styles: [
    `
      .header {
        margin-bottom: 16px;
      }
      .date-presets {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .date-presets button.active {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
      }
      .filters {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .filters mat-form-field {
        width: 180px;
      }
      .orders-table {
        width: 100%;
      }
      .clickable-row {
        cursor: pointer;
      }
      .clickable-row:hover {
        background: var(--mat-sys-surface-container);
      }
      .spinner {
        margin: 32px auto;
      }
      .empty {
        text-align: center;
        opacity: 0.5;
        margin-top: 32px;
      }
    `,
  ],
})
export class OrdersPage implements OnInit {
  private readonly client = inject(CLIENT_TOKEN) as IClient;
  private readonly router = inject(Router);

  protected readonly OrderStatus = OrderStatus;

  readonly orders = signal<OrderDto[]>([]);
  readonly loading = signal(false);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(0);

  readonly columns = ['orderNumber', 'date', 'items', 'total', 'status', 'cashier'];

  statusFilter: OrderStatus | null = null;
  fromDate: Date | null = null;
  toDate: Date | null = null;
  activePreset: string | null = null;
  pageSize = 50;

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
        this.toDate = null;
        break;
      case 'yesterday': {
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        this.fromDate = yesterday;
        this.toDate = startOfToday;
        break;
      }
      case 'last7': {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - 7);
        this.fromDate = d;
        this.toDate = null;
        break;
      }
      case 'last30': {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - 30);
        this.fromDate = d;
        this.toDate = null;
        break;
      }
      case 'thisMonth':
        this.fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.toDate = null;
        break;
    }
    this.pageIndex.set(0);
    this.loadOrders();
  }

  onFilterChange() {
    this.activePreset = null;
    this.pageIndex.set(0);
    this.loadOrders();
  }

  async loadOrders() {
    this.loading.set(true);
    try {
      const result: PaginationOfOrderDto = await firstValueFrom(
        this.client.orders_GetOrders(
          this.statusFilter ?? undefined,
          this.fromDate ?? undefined,
          this.toDate ?? undefined,
          this.pageIndex(),
          this.pageSize,
        ),
      );
      this.orders.set(result.data ?? []);
      this.totalCount.set(result.count ?? 0);
    } finally {
      this.loading.set(false);
    }
  }

  clearFilters() {
    this.statusFilter = null;
    this.fromDate = null;
    this.toDate = null;
    this.activePreset = null;
    this.pageIndex.set(0);
    this.loadOrders();
  }

  onPage(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.pageIndex.set(event.pageIndex);
    this.loadOrders();
  }

  onRowClick(order: OrderDto) {
    this.router.navigate(['/orders', order.id]);
  }
}
