import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { RegisterPage } from '../../pages/register.page';

test.describe('Order Flow @smoke', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsCashier();
  });

  test('should display categories and products', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await expect(registerPage.categoryBar).toBeVisible();
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should add a product to the order', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    // Wait for products to load
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    // Add first product
    await registerPage.selectFirstProduct();

    // Order sidebar should show the item
    await expect(registerPage.orderLineItems.first()).toBeVisible();
  });

  test('should navigate to checkout with items', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });
    await registerPage.selectFirstProduct();
    await expect(registerPage.orderLineItems.first()).toBeVisible();

    await registerPage.goToCheckout();

    await expect(page).toHaveURL(/.*checkout/);
  });

  test('should complete a cash payment', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });
    await registerPage.selectFirstProduct();
    await expect(registerPage.orderLineItems.first()).toBeVisible();
    await registerPage.goToCheckout();

    // Click the cash payment button
    const cashButton = page.locator('button', { hasText: /cash/i });
    await expect(cashButton).toBeVisible();
    await cashButton.click();

    // Should see exact cash or a denomination button — click the first pay option
    const payButton = page.locator('button', { hasText: /exact|pay/i }).first();
    await payButton.click();

    // Should reach order complete page
    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });
  });
});
