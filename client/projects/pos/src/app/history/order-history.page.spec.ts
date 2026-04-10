import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CLIENT_TOKEN, OrderDto, OrderStatus } from 'api-client';
import { PrinterService } from 'printing';
import { SettingsService } from '../services/settings.service';
import { AuthService } from 'auth';
import { OrderHistoryPage } from './order-history.page';
import { of } from 'rxjs';
import { signal } from '@angular/core';

function makeOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: 42,
    displayOrderNumber: '20260410-001',
    status: OrderStatus.Completed,
    subtotal: 293.48,
    taxRate: 0.15,
    taxAmount: 44.02,
    total: 337.5,
    createdAtUtc: '2026-04-10T04:41:00Z',
    lineItems: [],
    payments: [],
    ...overrides,
  } as OrderDto;
}

describe('OrderHistoryPage', () => {
  let page: OrderHistoryPage;
  let router: Router;
  let clientStub: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    clientStub = {
      orders_GetOrders: vi.fn().mockReturnValue(of({ data: [makeOrder()], total: 1 })),
    };

    TestBed.configureTestingModule({
      imports: [OrderHistoryPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: CLIENT_TOKEN, useValue: clientStub },
        {
          provide: PrinterService,
          useValue: {
            get isConnected() {
              return false;
            },
            connect: vi.fn(),
            print: vi.fn(),
          },
        },
        { provide: SettingsService, useValue: { storeName: 'Test Store' } },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture: ComponentFixture<OrderHistoryPage> = TestBed.createComponent(OrderHistoryPage);
    page = fixture.componentInstance;
  });

  it('should load orders on init', async () => {
    await page.ngOnInit();

    expect(clientStub['orders_GetOrders']).toHaveBeenCalledTimes(1);
    expect(page.orders().length).toBe(1);
    expect(page.orders()[0].displayOrderNumber).toBe('20260410-001');
    expect(page.loading()).toBe(false);
  });

  it('should navigate to order detail on onViewOrder', () => {
    const order = makeOrder({ id: 42 });
    page.onViewOrder(order);

    expect(router.navigate).toHaveBeenCalledWith(['/history', 42]);
  });

  it('should navigate back to register on onBack', () => {
    page.onBack();

    expect(router.navigate).toHaveBeenCalledWith(['/register']);
  });

  it('should show snackbar when reprinting without printer connected', async () => {
    const snackBar = (page as any).snackBar;
    const openSpy = vi.spyOn(snackBar, 'open');

    await page.onReprint(makeOrder());

    expect(openSpy).toHaveBeenCalledWith('Connect a printer first.', 'Dismiss', { duration: 3000 });
  });
});
