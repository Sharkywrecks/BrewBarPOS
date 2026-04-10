import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { CLIENT_TOKEN, OrderDto, OrderStatus, PaginationOfOrderDto } from 'api-client';
import { of } from 'rxjs';
import { OrdersPage } from './orders.page';

function makePagination(data: OrderDto[] = [], count = 0): PaginationOfOrderDto {
  return { data, count, pageIndex: 0, pageSize: 50 };
}

function makeClientMock() {
  return {
    orders_GetOrders: vi.fn().mockReturnValue(of(makePagination())),
  };
}

describe('OrdersPage', () => {
  let component: OrdersPage;
  let fixture: ComponentFixture<OrdersPage>;
  let client: ReturnType<typeof makeClientMock>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    client = makeClientMock();
    router = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        provideRouter([]),
        { provide: CLIENT_TOKEN, useValue: client },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to "today" preset on init', async () => {
    await component.ngOnInit();

    expect(component.activePreset).toBe('today');
    expect(component.fromDate).toBeTruthy();
    expect(client.orders_GetOrders).toHaveBeenCalled();
  });

  it('setPreset("yesterday") sets fromDate to yesterday', () => {
    component.setPreset('yesterday');

    const today = new Date();
    const expected = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    expect(component.fromDate!.toDateString()).toBe(expected.toDateString());
    expect(component.activePreset).toBe('yesterday');
  });

  it('setPreset("last7") sets fromDate 7 days ago', () => {
    component.setPreset('last7');

    const today = new Date();
    const expected = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    expect(component.fromDate!.toDateString()).toBe(expected.toDateString());
  });

  it('setPreset("last30") sets fromDate 30 days ago', () => {
    component.setPreset('last30');

    const today = new Date();
    const expected = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    expect(component.fromDate!.toDateString()).toBe(expected.toDateString());
  });

  it('setPreset("thisMonth") sets fromDate to first of month', () => {
    component.setPreset('thisMonth');

    const today = new Date();
    const expected = new Date(today.getFullYear(), today.getMonth(), 1);
    expect(component.fromDate!.toDateString()).toBe(expected.toDateString());
  });

  it('resets pageIndex when changing preset', () => {
    component.pageIndex.set(3);
    component.setPreset('yesterday');
    expect(component.pageIndex()).toBe(0);
  });

  it('onFilterChange clears activePreset and resets page', () => {
    component.activePreset = 'today';
    component.pageIndex.set(2);

    component.onFilterChange();

    expect(component.activePreset).toBeNull();
    expect(component.pageIndex()).toBe(0);
  });

  it('clearFilters resets all filters to defaults', () => {
    component.statusFilter = OrderStatus.Completed;
    component.fromDate = new Date();
    component.toDate = new Date();
    component.activePreset = 'today';
    component.pageIndex.set(5);

    component.clearFilters();

    expect(component.statusFilter).toBeNull();
    expect(component.fromDate).toBeNull();
    expect(component.toDate).toBeNull();
    expect(component.activePreset).toBeNull();
    expect(component.pageIndex()).toBe(0);
  });

  it('passes status filter to API', async () => {
    component.statusFilter = OrderStatus.Completed;
    await component.loadOrders();

    expect(client.orders_GetOrders).toHaveBeenCalledWith(
      OrderStatus.Completed,
      undefined,
      undefined,
      0,
      50,
    );
  });

  it('passes date filters to API', async () => {
    const from = new Date(2026, 3, 1);
    const to = new Date(2026, 3, 10);
    component.fromDate = from;
    component.toDate = to;

    await component.loadOrders();

    expect(client.orders_GetOrders).toHaveBeenCalledWith(undefined, from, to, 0, 50);
  });

  it('populates orders and totalCount from API response', async () => {
    const orders: OrderDto[] = [{ id: 1, displayOrderNumber: '001', total: 100 } as OrderDto];
    client.orders_GetOrders.mockReturnValue(of(makePagination(orders, 1)));

    await component.loadOrders();

    expect(component.orders()).toEqual(orders);
    expect(component.totalCount()).toBe(1);
  });

  it('onPage updates pageSize and pageIndex then reloads', async () => {
    await component.onPage({ pageIndex: 2, pageSize: 25, length: 100 });

    expect(component.pageSize).toBe(25);
    expect(component.pageIndex()).toBe(2);
    expect(client.orders_GetOrders).toHaveBeenCalled();
  });

  it('onRowClick navigates to order detail', () => {
    const order = { id: 42 } as OrderDto;
    component.onRowClick(order);
    expect(router.navigate).toHaveBeenCalledWith(['/orders', 42]);
  });

  it('sets loading to false even on API error', async () => {
    client.orders_GetOrders.mockReturnValue(of(undefined as any));

    try {
      await component.loadOrders();
    } catch {
      // expected
    }

    expect(component.loading()).toBe(false);
  });
});
