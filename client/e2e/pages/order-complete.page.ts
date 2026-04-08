import { type Page, type Locator } from '@playwright/test';

export class OrderCompletePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly orderNumber: Locator;
  readonly totalRow: Locator;
  readonly paymentRow: Locator;
  readonly changeRow: Locator;
  readonly newOrderButton: Locator;
  readonly offlineNotice: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.orderNumber = page.locator('.order-number');
    this.totalRow = page.locator('.detail-row', { hasText: 'Total' });
    this.paymentRow = page.locator('.detail-row', { hasText: 'Payment' });
    this.changeRow = page.locator('.detail-row.change');
    this.newOrderButton = page.locator('.new-order-btn');
    this.offlineNotice = page.locator('.offline-notice');
  }

  async startNewOrder(): Promise<void> {
    await this.newOrderButton.click();
    await this.page.waitForURL('**/register');
  }
}
