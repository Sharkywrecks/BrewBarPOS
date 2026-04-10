import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { CLIENT_TOKEN, OrderDto, OrderStatus } from 'api-client';
import { OrderDetailPage } from './order-detail.page';
import { of } from 'rxjs';

function makeOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: 42,
    displayOrderNumber: '20260410-001',
    status: OrderStatus.Completed,
    subtotal: 293.48,
    taxRate: 0.15,
    taxAmount: 44.02,
    total: 337.5,
    orderDiscountAmount: 0,
    createdAtUtc: '2026-04-10T04:41:00Z',
    cashierName: 'Jane',
    notes: null,
    lineItems: [
      {
        productName: 'Latte',
        variantName: 'Large',
        quantity: 2,
        unitPrice: 75,
        lineTotal: 150,
        modifierItems: [{ optionName: 'Oat Milk', price: 15 }],
      },
    ],
    payments: [{ id: 1, method: 'Cash', amountTendered: 350, changeGiven: 12.5, total: 337.5 }],
    ...overrides,
  } as OrderDto;
}

describe('OrderDetailPage', () => {
  let page: OrderDetailPage;
  let router: Router;
  let clientStub: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    clientStub = {
      orders_GetOrder: vi.fn().mockReturnValue(of(makeOrder())),
    };

    TestBed.configureTestingModule({
      imports: [OrderDetailPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: CLIENT_TOKEN, useValue: clientStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '42' } } },
        },
      ],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture: ComponentFixture<OrderDetailPage> = TestBed.createComponent(OrderDetailPage);
    page = fixture.componentInstance;
  });

  it('should load order on init using route param id', async () => {
    await page.ngOnInit();

    expect(clientStub['orders_GetOrder']).toHaveBeenCalledWith(42);
    expect(page.order()!.displayOrderNumber).toBe('20260410-001');
    expect(page.loading()).toBe(false);
  });

  it('should set loading to false even if API call fails', async () => {
    clientStub['orders_GetOrder'] = vi.fn().mockReturnValue(of(undefined).pipe());

    // Replace with a throwing observable
    const { throwError } = await import('rxjs');
    clientStub['orders_GetOrder'] = vi.fn().mockReturnValue(throwError(() => new Error('fail')));

    await page.ngOnInit().catch(() => {});

    expect(page.loading()).toBe(false);
  });

  it('should navigate back to history list on onBack', () => {
    page.onBack();

    expect(router.navigate).toHaveBeenCalledWith(['/history']);
  });

  it('should render order details in the template', async () => {
    const fixture = TestBed.createComponent(OrderDetailPage);
    await fixture.componentInstance.ngOnInit();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('20260410-001');
    expect(text).toContain('Jane');
    expect(text).toContain('Latte');
    expect(text).toContain('Large');
    expect(text).toContain('Oat Milk');
  });
});
