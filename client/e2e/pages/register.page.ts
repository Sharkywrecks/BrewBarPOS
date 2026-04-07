import { type Page, type Locator } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;
  readonly categoryBar: Locator;
  readonly productGrid: Locator;
  readonly productCards: Locator;
  readonly orderSidebar: Locator;
  readonly orderLineItems: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.categoryBar = page.locator('app-category-bar');
    this.productGrid = page.locator('app-product-grid');
    this.productCards = page.locator('app-product-card');
    this.orderSidebar = page.locator('app-order-sidebar');
    this.orderLineItems = page.locator('app-order-line-item-row');
    this.checkoutButton = page.locator('button', { hasText: /checkout/i });
  }

  async selectFirstProduct() {
    await this.productCards.first().click();
  }

  async selectProductByName(name: string) {
    await this.productCards.filter({ hasText: name }).first().click();
  }

  async goToCheckout() {
    await this.checkoutButton.click();
    await this.page.waitForURL('**/checkout');
  }
}
