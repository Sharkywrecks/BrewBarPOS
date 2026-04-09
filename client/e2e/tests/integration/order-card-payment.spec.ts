import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { RegisterPage } from '../../pages/register.page';
import { CheckoutPage } from '../../pages/checkout.page';
import { OrderCompletePage } from '../../pages/order-complete.page';

async function loginAndAddWater(page: Page): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsCashier();

  const registerPage = new RegisterPage(page);
  await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

  await registerPage.categoryBar.locator('text=Drinks').click();
  await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
    timeout: 10_000,
  });
  await registerPage.selectProductByName('Water');
  await expect(registerPage.orderLineItems.first()).toBeVisible();

  await registerPage.goToCheckout();
}

test.describe('Card Payment @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndAddWater(page);
  });

  test('should switch to card payment method', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.selectCard();

    // Numpad and cash section should not be visible
    await expect(checkoutPage.cashDisplay).not.toBeVisible();
    await expect(checkoutPage.numpadKeys.first()).not.toBeVisible();
  });

  test('should enable submit immediately for card', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.selectCard();

    // Submit should be enabled without entering any amount
    await expect(checkoutPage.submitButton).toBeEnabled();
    await expect(checkoutPage.submitButton).toContainText(/process card/i);
  });

  test('should complete card payment', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.selectCard();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });
  });

  test('should show Card as payment method on completion', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.selectCard();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    await expect(completePage.paymentRow).toContainText('Card');
  });

  test('should show no change for card payment', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.selectCard();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    // Change row should not be visible for card payments
    await expect(completePage.changeRow).not.toBeVisible();
  });
});
