import { type Page, type Locator, expect } from '@playwright/test';
import { TEST_ADMIN, TEST_CASHIER } from '../test-data';

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

  staffButton(displayName: string): Locator {
    return this.page.locator('.staff-btn', { hasText: displayName });
  }

  async selectStaff(displayName: string) {
    const btn = this.staffButton(displayName);
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
  }

  async enterPin(pin: string) {
    for (const digit of pin) {
      await this.pinButtons.filter({ hasText: digit }).first().click();
    }
  }

  async waitForRedirect() {
    await this.page.waitForURL('**/register', { timeout: 10_000 });
  }

  /**
   * Full UI login flow as the seeded e2e cashier. Selects the staff button,
   * enters the PIN, waits for redirect to /register. Centralised here so
   * renaming the cashier or changing the PIN happens in one place.
   */
  async loginAsCashier() {
    await this.selectStaff(TEST_CASHIER.displayName);
    await this.enterPin(TEST_CASHIER.pin);
    await this.waitForRedirect();
  }

  /**
   * Full UI login flow as the seeded e2e admin via PIN (the POS app uses PIN
   * login for everyone, including admins). Used by integration auth specs that
   * need to assert the admin can pin-login.
   */
  async loginAsAdminViaPin() {
    await this.selectStaff(TEST_ADMIN.displayName);
    await this.enterPin(TEST_ADMIN.pin);
    await this.waitForRedirect();
  }
}
