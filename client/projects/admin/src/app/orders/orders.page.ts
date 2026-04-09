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
  ],
  template: `
    <div class="header">
      <h1>Orders</h1>
    </div>

    <!-- Filters -->
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="statusFilter" (selectionChange)="loadOrders()">
          <mat-option [value]="null">All</mat-option>
          <mat-option [value]="OrderStatus.Open">Open</mat-option>
          <mat-option [value]="OrderStatus.Completed">Completed</mat-option>
          <mat-option [value]="OrderStatus.Voided">Voided</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>From</mat-label>
        <input matInput type="date" [(ngModel)]="fromDate" (change)="loadOrders()" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>To</mat-label>
        <input matInput type="date" [(ngModel)]="toDate" (change)="loadOrders()" />
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
    }
  `,
  styles: [
    `
      .header {
        margin-bottom: 16px;
      }
      .filters {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .filters mat-form-field {
        width: 160px;
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

  // Expose the enum to the template — templates can only see component members.
  protected readonly OrderStatus = OrderStatus;

  readonly orders = signal<OrderDto[]>([]);
  readonly loading = signal(false);

  readonly columns = ['orderNumber', 'date', 'items', 'total', 'status', 'cashier'];

  statusFilter: OrderStatus | null = null;
  fromDate = '';
  toDate = '';

  async ngOnInit() {
    await this.loadOrders();
  }

  async loadOrders() {
    this.loading.set(true);
    try {
      const from = this.fromDate ? new Date(this.fromDate) : undefined;
      const to = this.toDate ? new Date(this.toDate) : undefined;
      const result: PaginationOfOrderDto = await firstValueFrom(
        this.client.orders_GetOrders(this.statusFilter ?? undefined, from, to, 0, 100),
      );
      this.orders.set(result.data ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  clearFilters() {
    this.statusFilter = null;
    this.fromDate = '';
    this.toDate = '';
    this.loadOrders();
  }

  onRowClick(order: OrderDto) {
    this.router.navigate(['/orders', order.id]);
  }
}
