import { Component, inject, signal, OnInit, Inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CLIENT_TOKEN, IClient, OrderDto, PaginationOfOrderDto } from 'api-client';
import { PrinterService, buildReceipt, ReceiptData } from 'printing';
import { SettingsService } from '../services/settings.service';
import { AuthService } from 'auth';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="header">
      <button mat-button (click)="onBack()"><mat-icon>arrow_back</mat-icon> Register</button>
      <h1>Recent Orders</h1>
    </div>

    @if (loading()) {
      <mat-spinner diameter="32" class="spinner"></mat-spinner>
    } @else {
      <table mat-table [dataSource]="orders()" class="orders-table">
        <ng-container matColumnDef="orderNumber">
          <th mat-header-cell *matHeaderCellDef>Order #</th>
          <td mat-cell *matCellDef="let o">{{ o.displayOrderNumber }}</td>
        </ng-container>

        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef>Time</th>
          <td mat-cell *matCellDef="let o">{{ o.createdAtUtc | date: 'shortTime' }}</td>
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

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let o">
            <button mat-icon-button (click)="onReprint(o)" matTooltip="Reprint receipt">
              <mat-icon>print</mat-icon>
            </button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    }
  `,
  styles: [
    `
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
      .orders-table {
        width: 100%;
      }
      .spinner {
        margin: 48px auto;
      }
    `,
  ],
})
export class OrderHistoryPage implements OnInit {
  private readonly router = inject(Router);
  private readonly printer = inject(PrinterService);
  private readonly settings = inject(SettingsService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  readonly orders = signal<OrderDto[]>([]);
  readonly loading = signal(false);
  readonly columns = ['orderNumber', 'time', 'total', 'status', 'actions'];

  async ngOnInit() {
    this.loading.set(true);
    try {
      // Load today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result: PaginationOfOrderDto = await firstValueFrom(
        this.client.orders_GetOrders(undefined, today, undefined, 0, 50),
      );
      this.orders.set(result.data ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  async onReprint(order: OrderDto) {
    if (!this.printer.isConnected) {
      this.snackBar.open('Connect a printer first.', 'Dismiss', { duration: 3000 });
      return;
    }

    const receiptData: ReceiptData = {
      storeName: this.settings.storeName,
      orderNumber: order.displayOrderNumber!,
      cashierName: order.cashierName ?? undefined,
      lineItems: (order.lineItems ?? []).map((li) => ({
        name: li.productName!,
        variant: li.variantName ?? undefined,
        quantity: li.quantity!,
        unitPrice: li.unitPrice!,
        lineTotal: li.lineTotal!,
        modifiers: (li.modifierItems ?? []).map((m) => ({
          name: m.optionName!,
          price: m.price!,
        })),
      })),
      subtotal: order.subtotal!,
      taxRate: order.taxRate!,
      taxAmount: order.taxAmount!,
      total: order.total!,
      paymentMethod:
        (order.payments?.length ?? 0) > 0 ? String(order.payments![0].method) : 'Unknown',
      amountTendered:
        (order.payments?.length ?? 0) > 0 ? order.payments![0].amountTendered! : order.total!,
      changeGiven: (order.payments?.length ?? 0) > 0 ? order.payments![0].changeGiven! : 0,
      dateTime: new Date(order.createdAtUtc!),
    };

    try {
      const bytes = buildReceipt(receiptData);
      await this.printer.print(bytes);
      this.snackBar.open('Receipt reprinted.', 'OK', { duration: 2000 });
    } catch {
      this.snackBar.open('Failed to print receipt.', 'Dismiss', { duration: 3000 });
    }
  }

  onBack() {
    this.router.navigate(['/register']);
  }
}
