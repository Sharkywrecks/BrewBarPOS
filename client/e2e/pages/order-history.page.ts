import { type Page, type Locator } from '@playwright/test';

export class OrderHistoryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly backButton: Locator;
  readonly orderRows: Locator;
  readonly spinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1', { hasText: 'Recent Orders' });
    this.backButton = page.locator('button', { hasText: /register/i });
    this.orderRows = page.locator('tr.mat-mdc-row');
    this.spinner = page.locator('mat-spinner');
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForURL('**/register');
  }
}
