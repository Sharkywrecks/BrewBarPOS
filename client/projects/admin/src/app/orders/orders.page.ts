import { Component, inject, signal, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CLIENT_TOKEN, IClient, OrderDto, PaginationOfOrderDto } from 'api-client';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, MatTableModule, MatChipsModule, MatProgressSpinnerModule],
  template: `
    <h1>Orders</h1>

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
          <td mat-cell *matCellDef="let o">{{ o.total | currency }}</td>
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
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    }
  `,
  styles: [
    `
      .orders-table {
        width: 100%;
        margin-top: 16px;
      }
      .spinner {
        margin: 32px auto;
      }
    `,
  ],
})
export class OrdersPage implements OnInit {
  private readonly client = inject(CLIENT_TOKEN) as IClient;

  readonly orders = signal<OrderDto[]>([]);
  readonly loading = signal(false);

  readonly columns = ['orderNumber', 'date', 'items', 'total', 'status', 'cashier'];

  async ngOnInit() {
    this.loading.set(true);
    try {
      const result: PaginationOfOrderDto = await firstValueFrom(
        this.client.orders_GetOrders(undefined, undefined, undefined, 0, 50),
      );
      this.orders.set(result.data ?? []);
    } finally {
      this.loading.set(false);
    }
  }
}
