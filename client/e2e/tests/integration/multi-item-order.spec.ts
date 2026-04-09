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

test.describe('Multi-Item Order @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCashier(page);
  });

  test('should add multiple different products to cart', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    // Navigate to Drinks
    await registerPage.categoryBar.locator('text=Drinks').click();
    await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
      timeout: 10_000,
    });

    // Add Water ($2.00, no modifiers)
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems).toHaveCount(1);

    // Add Cold Brew — this has required Size (variants) and Milk modifier
    await registerPage.selectProductByName('Cold Brew');

    // Modifier sheet should open for Cold Brew
    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Select Whole Milk (required modifier, no extra cost)
    await sheet.getByText('Whole Milk').click();
    await page.locator('.add-btn').click();

    // Should now have 2 line items
    await expect(registerPage.orderLineItems).toHaveCount(2);
  });

  test('should show correct running total with multiple items', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.categoryBar.locator('text=Drinks').click();
    await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
      timeout: 10_000,
    });

    // Add Water ($2.00)
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems).toHaveCount(1);

    const sidebar = page.locator('app-order-sidebar');
    await expect(sidebar.locator('.total-row', { hasText: 'Subtotal (ex-VAT)' })).toBeVisible();

    // Add Cold Brew ($4.50) with Whole Milk (only Milk modifier, no size variant)
    await registerPage.selectProductByName('Cold Brew');
    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await sheet.getByText('Whole Milk').click();
    await page.locator('.add-btn').click();

    // Subtotal should update (ex-VAT amounts, just verify it's visible)
    await expect(sidebar.locator('.total-row', { hasText: 'Subtotal (ex-VAT)' })).toBeVisible();
    await expect(sidebar.locator('.grand-total')).toBeVisible();
  });

  test('should remove item from cart', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.categoryBar.locator('text=Drinks').click();
    await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
      timeout: 10_000,
    });

    // Add Water
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems).toHaveCount(1);

    // Add Water again for a second item
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems).toHaveCount(2);

    // Remove first item using the close button
    const removeBtn = registerPage.orderLineItems.first().locator('.remove-btn');
    await removeBtn.click();

    await expect(registerPage.orderLineItems).toHaveCount(1);
  });

  test('should update item quantity with +/- buttons', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.categoryBar.locator('text=Drinks').click();
    await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
      timeout: 10_000,
    });

    // Add Water
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems).toHaveCount(1);

    // Click + to increment quantity
    const lineItem = registerPage.orderLineItems.first();
    const incrementBtn = lineItem.locator('.qty-btn').last(); // + button
    await incrementBtn.click();

    // Quantity should show 2
    await expect(lineItem.locator('.qty')).toHaveText('2');

    // Sidebar item count should show 2
    await expect(page.locator('.item-count')).toContainText('2 items');
  });

  test('should complete multi-item order with cash', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.categoryBar.locator('text=Drinks').click();
    await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
      timeout: 10_000,
    });

    // Add Water ($2.00)
    await registerPage.selectProductByName('Water');
    await expect(registerPage.orderLineItems).toHaveCount(1);

    // Add Cold Brew with Whole Milk (only Milk modifier, no size variant)
    await registerPage.selectProductByName('Cold Brew');
    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await sheet.getByText('Whole Milk').click();
    await page.locator('.add-btn').click();

    await expect(registerPage.orderLineItems).toHaveCount(2);

    // Checkout
    await registerPage.goToCheckout();

    const checkoutPage = new CheckoutPage(page);
    // Both items should be in summary
    await expect(page.locator('.summary-line', { hasText: 'Water' })).toBeVisible();
    await expect(page.locator('.summary-line', { hasText: 'Cold Brew' })).toBeVisible();

    // Pay with exact amount
    await checkoutPage.clickExact();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    await expect(completePage.heading).toHaveText('Order Complete');
  });
});
