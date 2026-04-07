import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly pinButtons: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pinButtons = page.locator('.key-btn');
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async enterPin(pin: string) {
    for (const digit of pin) {
      await this.pinButtons.filter({ hasText: digit }).first().click();
    }
  }

  async waitForRedirect() {
    await this.page.waitForURL('**/register', { timeout: 10_000 });
  }
}
