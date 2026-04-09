import { Injectable, Inject, inject } from '@angular/core';
import {
  CLIENT_TOKEN,
  IClient,
  CreateOrderDto,
  OrderDto,
  CreatePaymentDto,
  PaymentDto,
  OrderStatus,
  PaymentStatus,
} from 'api-client';
import { OutboxService } from 'sync';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly outbox = inject(OutboxService);
  private _lastOrderWasOffline = false;

  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  /** Whether the last createOrder call was queued offline instead of sent to the API. */
  get wasOffline(): boolean {
    return this._lastOrderWasOffline;
  }

  async createOrder(dto: CreateOrderDto): Promise<OrderDto> {
    this._lastOrderWasOffline = false;
    try {
      return await firstValueFrom(this.client.orders_CreateOrder(dto));
    } catch {
      // API unreachable — queue for later sync
      await this.outbox.enqueue(dto.localId!, JSON.stringify(dto));
      this._lastOrderWasOffline = true;

      // Return a synthetic OrderDto so the checkout flow can continue
      return {
        id: 0,
        localId: dto.localId,
        displayOrderNumber: `OFFLINE-${dto.localId!.substring(0, 8).toUpperCase()}`,
        status: OrderStatus.Open,
        subtotal: dto.lineItems!.reduce((sum, li) => sum + li.unitPrice! * li.quantity!, 0),
        taxRate: dto.taxRate,
        taxAmount: 0,
        total: 0,
        lineItems: [],
      } as OrderDto;
    }
  }

  async createPayment(dto: CreatePaymentDto): Promise<PaymentDto> {
    if (this._lastOrderWasOffline) {
      // Attach payment to the outbox entry — it'll be synced together
      const orders = await this.outbox.getPendingOrders();
      const match = orders.find((o) => {
        const parsed = JSON.parse(o.payload);
        return parsed.localId && dto.orderId === 0;
      });
      if (match) {
        // Re-enqueue with payment info
        await this.outbox.enqueue(match.localId, match.payload, JSON.stringify(dto));
      }

      // Return synthetic PaymentDto
      return {
        id: 0,
        orderId: dto.orderId,
        method: dto.method,
        status: PaymentStatus.Completed,
        amountTendered: dto.amountTendered,
        changeGiven: 0,
        total: dto.total,
      } as PaymentDto;
    }

    return firstValueFrom(this.client.payments_CreatePayment(dto));
  }

  async getOrder(id: number): Promise<OrderDto> {
    return firstValueFrom(this.client.orders_GetOrder(id));
  }
}
