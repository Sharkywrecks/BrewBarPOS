import { type Page, type Locator } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly backButton: Locator;
  readonly heading: Locator;
  readonly summaryLines: Locator;
  readonly subtotal: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  readonly notesDisplay: Locator;
  readonly cashToggle: Locator;
  readonly cardToggle: Locator;
  readonly cashDisplay: Locator;
  readonly numpadKeys: Locator;
  readonly quickAmounts: Locator;
  readonly exactButton: Locator;
  readonly clearButton: Locator;
  readonly changeDisplay: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.locator('.back-btn');
    this.heading = page.locator('h1');
    this.summaryLines = page.locator('.summary-line').filter({ hasNot: page.locator('.total') });
    this.subtotal = page.locator('.summary-line', { hasText: 'Subtotal (ex-VAT)' });
    this.tax = page.locator('.summary-line', { hasText: 'VAT' });
    this.total = page.locator('.summary-line.total');
    this.notesDisplay = page.locator('.notes-display');
    this.cashToggle = page.locator('mat-button-toggle', { hasText: /cash/i });
    this.cardToggle = page.locator('mat-button-toggle', { hasText: /card/i });
    this.cashDisplay = page.locator('.cash-display');
    this.numpadKeys = page.locator('.num-btn');
    this.quickAmounts = page.locator('.quick-amounts button');
    this.exactButton = page.locator('.quick-amounts button', { hasText: 'Exact' });
    this.clearButton = page.locator('.num-btn', { hasText: 'C' });
    this.changeDisplay = page.locator('.change-display');
    this.submitButton = page.locator('.submit-btn');
  }

  async selectCash(): Promise<void> {
    await this.cashToggle.click();
  }

  async selectCard(): Promise<void> {
    await this.cardToggle.click();
  }

  async clickExact(): Promise<void> {
    await this.exactButton.click();
  }

  async clickQuickAmount(label: string): Promise<void> {
    await this.quickAmounts.filter({ hasText: label }).click();
  }

  async enterAmount(keys: string): Promise<void> {
    for (const key of keys) {
      await this.numpadKeys.filter({ hasText: new RegExp(`^${key}$`) }).click();
    }
  }

  async clearCash(): Promise<void> {
    await this.clearButton.click();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForURL('**/register');
  }
}
