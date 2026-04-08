import { type Page, type Locator } from '@playwright/test';

export class AdminLoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.signInButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    // Intercept config.json to point to the integration API
    await this.page.route('**/config.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ apiUrl: 'http://localhost:5050' }),
      }),
    );
    await this.page.goto('/login', { timeout: 60_000 });
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async loginAsAdmin() {
    await this.login('admin@brewbar.local', 'Admin123!');
    await this.page.waitForURL('**/dashboard', { timeout: 15_000 });
  }
}
