import { Injectable, Inject } from '@angular/core';
import {
  CLIENT_TOKEN,
  IClient,
  CreateOrderDto,
  OrderDto,
  CreatePaymentDto,
  PaymentDto,
} from 'api-client';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(@Inject(CLIENT_TOKEN) private readonly client: IClient) {}

  async createOrder(dto: CreateOrderDto): Promise<OrderDto> {
    return firstValueFrom(this.client.orders_CreateOrder(dto));
  }

  async createPayment(dto: CreatePaymentDto): Promise<PaymentDto> {
    return firstValueFrom(this.client.payments_CreatePayment(dto));
  }

  async getOrder(id: number): Promise<OrderDto> {
    return firstValueFrom(this.client.orders_GetOrder(id));
  }
}
