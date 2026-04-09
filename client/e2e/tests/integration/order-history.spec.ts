import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { RegisterPage } from '../../pages/register.page';
import { CheckoutPage } from '../../pages/checkout.page';
import { OrderHistoryPage } from '../../pages/order-history.page';

async function loginAsCashier(page: Page): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsCashier();
}

async function placeWaterOrder(page: Page): Promise<void> {
  const registerPage = new RegisterPage(page);
  await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

  await registerPage.categoryBar.locator('text=Drinks').click();
  await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
    timeout: 10_000,
  });
  await registerPage.selectProductByName('Water');
  await expect(registerPage.orderLineItems.first()).toBeVisible();

  await registerPage.goToCheckout();

  const checkoutPage = new CheckoutPage(page);
  await checkoutPage.clickExact();
  await checkoutPage.submit();

  await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

  // Return to register
  await page.locator('.new-order-btn').click();
  await page.waitForURL('**/register');
}

test.describe('Order History @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCashier(page);
  });

  test('should navigate to order history page', async ({ page }) => {
    // First place an order so there's something to see
    await placeWaterOrder(page);

    await page.goto('/history');

    const historyPage = new OrderHistoryPage(page);
    await expect(historyPage.heading).toBeVisible({ timeout: 10_000 });
  });

  test('should display previously completed orders', async ({ page }) => {
    await placeWaterOrder(page);

    await page.goto('/history');

    const historyPage = new OrderHistoryPage(page);
    // Wait for orders to load
    await expect(historyPage.spinner).not.toBeVisible({ timeout: 10_000 });

    // Should have at least one order row
    await expect(historyPage.orderRows.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show correct order totals', async ({ page }) => {
    await placeWaterOrder(page);

    await page.goto('/history');

    const historyPage = new OrderHistoryPage(page);
    await expect(historyPage.orderRows.first()).toBeVisible({ timeout: 10_000 });

    // The order should contain a total amount
    const firstRow = historyPage.orderRows.first();
    await expect(firstRow).toContainText('$');
  });

  test('should navigate back to register', async ({ page }) => {
    await page.goto('/history');

    const historyPage = new OrderHistoryPage(page);
    await expect(historyPage.heading).toBeVisible({ timeout: 10_000 });

    await historyPage.goBack();

    await expect(page).toHaveURL(/.*register/);
  });
});
