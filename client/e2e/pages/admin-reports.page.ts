import { type Page, type Locator } from '@playwright/test';

export class AdminReportsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly dateInput: Locator;
  readonly kpiCards: Locator;
  readonly ordersKpi: Locator;
  readonly grossSalesKpi: Locator;
  readonly paymentMethodsCard: Locator;
  readonly topProductsTable: Locator;
  readonly spinner: Locator;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1', { hasText: 'Reports' });
    this.dateInput = page.locator('.header input[type="date"]');
    this.kpiCards = page.locator('.kpi-card');
    this.ordersKpi = page.locator('.kpi-card', { hasText: 'Orders' });
    this.grossSalesKpi = page.locator('.kpi-card', { hasText: 'Gross Sales' });
    this.paymentMethodsCard = page.locator('mat-card', { hasText: 'Payment Methods' });
    this.topProductsTable = page.locator('.products-table');
    this.spinner = page.locator('mat-spinner');
    this.emptyMessage = page.locator('.empty');
  }

  async goto() {
    await this.page.route('**/config.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ apiUrl: 'http://localhost:5050' }),
      }),
    );
    await this.page.goto('/reports', { timeout: 60_000 });
  }
}
