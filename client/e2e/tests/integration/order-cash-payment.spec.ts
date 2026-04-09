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

  // Navigate to Drinks and add Water ($2.00, no modifiers)
  await registerPage.categoryBar.locator('text=Drinks').click();
  await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
    timeout: 10_000,
  });
  await registerPage.selectProductByName('Water');
  await expect(registerPage.orderLineItems.first()).toBeVisible();

  await registerPage.goToCheckout();
}

test.describe('Cash Payment @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndAddWater(page);
  });

  test('should show numpad and quick amounts for cash', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    // Cash should be default
    await expect(checkoutPage.cashDisplay).toBeVisible();
    await expect(checkoutPage.numpadKeys.first()).toBeVisible();
    await expect(checkoutPage.quickAmounts.first()).toBeVisible();
    await expect(checkoutPage.exactButton).toBeVisible();
  });

  test('should enter cash via numpad', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.enterAmount('10');

    await expect(checkoutPage.cashDisplay).toContainText('$10.00');
  });

  test('should set exact amount', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.clickExact();

    // Cash display should match the order total
    const totalText = await checkoutPage.total.textContent();
    const totalAmount = totalText?.match(/\$[\d.]+/)?.[0];
    await expect(checkoutPage.cashDisplay).toContainText(totalAmount!);
  });

  test('should use quick amount button', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    // $5 should be one of the quick amounts for a ~$2 order
    const fiveButton = checkoutPage.quickAmounts.filter({ hasText: '$5.00' });
    await expect(fiveButton).toBeVisible();
    await fiveButton.click();

    await expect(checkoutPage.cashDisplay).toContainText('$5.00');
  });

  test('should calculate correct change', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    // Enter $20
    await checkoutPage.enterAmount('20');

    // Change should be displayed
    await expect(checkoutPage.changeDisplay).toBeVisible();
    await expect(checkoutPage.changeDisplay).toContainText('Change');
  });

  test('should disable submit when cash is less than total', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    // Enter $1 (less than ~$2.30 total)
    await checkoutPage.enterAmount('1');

    await expect(checkoutPage.submitButton).toBeDisabled();
  });

  test('should enable submit when cash meets total', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.clickExact();

    await expect(checkoutPage.submitButton).toBeEnabled();
  });

  test('should complete payment and show change on order-complete', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    // Pay with $20 for a ~$2 order
    await checkoutPage.enterAmount('20');
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    await expect(completePage.paymentRow).toContainText('Cash');
    await expect(completePage.changeRow).toBeVisible();
    await expect(completePage.changeRow).toContainText('Change');
  });

  test('should clear cash input when C is clicked', async ({ page }) => {
    const checkoutPage = new CheckoutPage(page);

    await checkoutPage.enterAmount('15');
    await expect(checkoutPage.cashDisplay).toContainText('$15.00');

    await checkoutPage.clearCash();
    await expect(checkoutPage.cashDisplay).toContainText('$0.00');
  });
});
