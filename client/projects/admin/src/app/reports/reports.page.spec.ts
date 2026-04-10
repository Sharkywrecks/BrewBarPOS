import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideNativeDateAdapter } from '@angular/material/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from 'api-client';
import { of } from 'rxjs';
import { ReportsPage } from './reports.page';

const DAILY_REPORT = {
  date: '2026-04-10',
  orderCount: 5,
  voidedCount: 1,
  itemsSold: 12,
  grossSales: 500,
  taxCollected: 75,
  netSales: 425,
  cashTotal: 300,
  cardTotal: 200,
  averageOrderValue: 100,
  hourlySales: [
    { hour: 9, orderCount: 2, total: 200 },
    { hour: 10, orderCount: 3, total: 300 },
  ],
};

const PRODUCTS = [
  { productId: 1, productName: 'Latte', categoryName: 'Coffee', unitsSold: 8, revenue: 320 },
];

const PAYMENTS = {
  cashTotal: 300,
  cashCount: 3,
  cardTotal: 200,
  cardCount: 2,
  refundTotal: 0,
  refundCount: 0,
};

function makeHttpMock() {
  return {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/reports/daily')) return of(DAILY_REPORT);
      if (url.includes('/reports/products')) return of(PRODUCTS);
      if (url.includes('/reports/payments')) return of(PAYMENTS);
      return of(null);
    }),
  };
}

describe('ReportsPage', () => {
  let component: ReportsPage;
  let fixture: ComponentFixture<ReportsPage>;
  let http: ReturnType<typeof makeHttpMock>;

  beforeEach(async () => {
    http = makeHttpMock();

    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        { provide: HttpClient, useValue: http },
        { provide: API_BASE_URL, useValue: 'http://localhost' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to "today" preset on init', async () => {
    await component.ngOnInit();

    expect(component.activePreset).toBe('today');
    expect(component.fromDate).toBeTruthy();
    expect(http.get).toHaveBeenCalled();
  });

  it('setPreset("yesterday") sets dates to yesterday', () => {
    component.setPreset('yesterday');

    const today = new Date();
    const expected = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    expect(component.fromDate!.toDateString()).toBe(expected.toDateString());
    expect(component.toDate!.toDateString()).toBe(expected.toDateString());
    expect(component.activePreset).toBe('yesterday');
  });

  it('setPreset("last7") sets fromDate 6 days ago and toDate to today', () => {
    component.setPreset('last7');

    const today = new Date();
    const expectedFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const expectedTo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    expect(component.fromDate!.toDateString()).toBe(expectedFrom.toDateString());
    expect(component.toDate!.toDateString()).toBe(expectedTo.toDateString());
  });

  it('setPreset("last30") sets fromDate 29 days ago', () => {
    component.setPreset('last30');

    const today = new Date();
    const expectedFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    expect(component.fromDate!.toDateString()).toBe(expectedFrom.toDateString());
  });

  it('setPreset("thisMonth") sets fromDate to first of month', () => {
    component.setPreset('thisMonth');

    const today = new Date();
    const expected = new Date(today.getFullYear(), today.getMonth(), 1);
    expect(component.fromDate!.toDateString()).toBe(expected.toDateString());
  });

  it('onDateChange clears activePreset and loads data', async () => {
    component.activePreset = 'today';
    component.fromDate = new Date(2026, 3, 5);

    component.onDateChange();

    expect(component.activePreset).toBeNull();
    expect(http.get).toHaveBeenCalled();
  });

  it('onDateChange does not load if fromDate is null', () => {
    http.get.mockClear();
    component.fromDate = null;

    component.onDateChange();

    expect(http.get).not.toHaveBeenCalled();
  });

  it('loadAll populates daily, topProducts, and paymentSummary', async () => {
    component.fromDate = new Date(2026, 3, 10);
    component.toDate = new Date(2026, 3, 10);

    await component.loadAll();

    expect(component.daily()).toEqual(DAILY_REPORT);
    expect(component.topProducts()).toEqual(PRODUCTS);
    expect(component.paymentSummary()).toEqual(PAYMENTS);
  });

  it('loadAll sends correct date in API URLs', async () => {
    component.fromDate = new Date(2026, 3, 10);
    component.toDate = new Date(2026, 3, 12);

    await component.loadAll();

    const fromStr = new Date(2026, 3, 10).toISOString().split('T')[0];
    const toStr = new Date(2026, 3, 12).toISOString().split('T')[0];
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining(`date=${fromStr}`));
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining(`from=${fromStr}&to=${toStr}`));
  });

  it('loadAll skips if fromDate is null', async () => {
    http.get.mockClear();
    component.fromDate = null;

    await component.loadAll();

    expect(http.get).not.toHaveBeenCalled();
  });

  it('sets loading to false after loadAll completes', async () => {
    component.fromDate = new Date(2026, 3, 10);
    await component.loadAll();
    expect(component.loading()).toBe(false);
  });

  it('cashPercent returns correct percentage', async () => {
    component.fromDate = new Date(2026, 3, 10);
    await component.loadAll();

    expect(component.cashPercent()).toBe(60);
  });

  it('cardPercent returns correct percentage', async () => {
    component.fromDate = new Date(2026, 3, 10);
    await component.loadAll();

    expect(component.cardPercent()).toBe(40);
  });

  it('cashPercent returns 0 when no payments', () => {
    expect(component.cashPercent()).toBe(0);
  });

  it('hourPercent returns percentage relative to max', async () => {
    component.fromDate = new Date(2026, 3, 10);
    await component.loadAll();

    expect(component.hourPercent(300)).toBe(100);
    expect(component.hourPercent(150)).toBe(50);
  });
});
