import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { RegisterPage } from '../../pages/register.page';
import { CheckoutPage } from '../../pages/checkout.page';
import { OrderCompletePage } from '../../pages/order-complete.page';

async function loginAsCashier(page: Page): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsCashier();
}

async function navigateToDrinks(page: Page): Promise<RegisterPage> {
  const registerPage = new RegisterPage(page);
  await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });
  await registerPage.categoryBar.locator('text=Drinks').click();
  await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
    timeout: 10_000,
  });
  return registerPage;
}

test.describe('Simple Order Flow @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCashier(page);
  });

  test('should add Water to cart and show in sidebar', async ({ page }) => {
    const registerPage = await navigateToDrinks(page);

    // Water has no modifiers — direct add to cart
    await registerPage.selectProductByName('Water');

    // Sidebar should show the item
    await expect(registerPage.orderLineItems.first()).toBeVisible();
    await expect(registerPage.orderLineItems.first()).toContainText('Water');
  });

  test('should show correct subtotal, tax, and total', async ({ page }) => {
    const registerPage = await navigateToDrinks(page);
    await registerPage.selectProductByName('Water');

    await expect(registerPage.orderLineItems.first()).toBeVisible();

    // Water is $2.00 tax-inclusive — check sidebar totals
    const sidebar = page.locator('app-order-sidebar');
    await expect(sidebar.locator('.total-row', { hasText: 'Subtotal (ex-VAT)' })).toBeVisible();
    await expect(sidebar.locator('.total-row').filter({ hasText: /^VAT/ })).toBeVisible();
    // Grand total should be displayed
    await expect(sidebar.locator('.grand-total')).toBeVisible();
  });

  test('should navigate to checkout with items', async ({ page }) => {
    const registerPage = await navigateToDrinks(page);
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems.first()).toBeVisible();

    await registerPage.goToCheckout();

    await expect(page).toHaveURL(/.*checkout/);
  });

  test('should display order summary on checkout page', async ({ page }) => {
    const registerPage = await navigateToDrinks(page);
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems.first()).toBeVisible();

    await registerPage.goToCheckout();

    const checkoutPage = new CheckoutPage(page);
    // Should show Water in the order summary
    await expect(page.locator('.summary-line', { hasText: 'Water' })).toBeVisible();
    await expect(checkoutPage.subtotal).toBeVisible();
    await expect(checkoutPage.total).toBeVisible();
  });

  test('should complete cash payment with exact amount', async ({ page }) => {
    const registerPage = await navigateToDrinks(page);
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems.first()).toBeVisible();

    await registerPage.goToCheckout();

    const checkoutPage = new CheckoutPage(page);
    await checkoutPage.clickExact();
    await checkoutPage.submit();

    // Should reach order complete page
    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });
  });

  test('should show server-generated order number on completion page', async ({ page }) => {
    const registerPage = await navigateToDrinks(page);
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems.first()).toBeVisible();

    await registerPage.goToCheckout();

    const checkoutPage = new CheckoutPage(page);
    await checkoutPage.clickExact();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    await expect(completePage.heading).toHaveText('Order Complete');
    // Order number should be in YYYYMMDD-NNN format
    await expect(completePage.orderNumber).toBeVisible();
    await expect(completePage.orderNumber).toContainText('#');
  });

  test('should return to register on "New Order" with empty cart', async ({ page }) => {
    const registerPage = await navigateToDrinks(page);
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems.first()).toBeVisible();

    await registerPage.goToCheckout();

    const checkoutPage = new CheckoutPage(page);
    await checkoutPage.clickExact();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    await completePage.startNewOrder();

    await expect(page).toHaveURL(/.*register/);

    // Cart should be empty
    const sidebar = page.locator('app-order-sidebar');
    await expect(sidebar.locator('.empty-cart')).toBeVisible();
  });
});
