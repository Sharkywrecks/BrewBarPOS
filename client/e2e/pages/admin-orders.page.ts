import { type Page, type Locator } from '@playwright/test';

export class AdminOrdersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly orderRows: Locator;
  readonly spinner: Locator;
  readonly emptyMessage: Locator;
  readonly statusFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1', { hasText: 'Orders' });
    this.orderRows = page.locator('tr.mat-mdc-row');
    this.spinner = page.locator('mat-spinner');
    this.emptyMessage = page.locator('.empty');
    this.statusFilter = page.locator('mat-select').first();
  }

  async goto() {
    await this.page.route('**/config.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ apiUrl: 'http://localhost:5050' }),
      }),
    );
    await this.page.goto('/orders', { timeout: 60_000 });
  }

  async clickOrder(orderNumber: string) {
    await this.page.locator('tr.mat-mdc-row', { hasText: orderNumber }).click();
  }
}

export class AdminOrderDetailPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly backButton: Locator;
  readonly statusChip: Locator;
  readonly voidButton: Locator;
  readonly refundButton: Locator;
  readonly lineItemRows: Locator;
  readonly detailsCard: Locator;
  readonly paymentsCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.backButton = page.locator('button', { hasText: 'Orders' });
    this.statusChip = page.locator('.header mat-chip');
    this.voidButton = page.locator('button', { hasText: 'Void Order' });
    this.refundButton = page.locator('button', { hasText: 'Refund' });
    this.lineItemRows = page.locator('.items-table tr.mat-mdc-row');
    this.detailsCard = page.locator('mat-card', { hasText: 'Details' });
    this.paymentsCard = page.locator('mat-card', { hasText: 'Payments' });
  }

  async goBack() {
    await this.backButton.click();
    await this.page.waitForURL('**/orders');
  }
}
