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

test.describe('Order with Modifiers @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCashier(page);
  });

  test('should open modifier sheet when clicking a product with required modifiers', async ({
    page,
  }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    // Green Machine has required Size modifier
    await registerPage.selectProductByName('Green Machine');

    // Bottom sheet should open with Size options
    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await expect(sheet.locator('h3', { hasText: 'Size' })).toBeVisible();
  });

  test('should require size selection before adding to cart', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.selectProductByName('Green Machine');

    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Add button should be disabled without size selection
    const addButton = page.locator('.add-btn');
    await expect(addButton).toBeDisabled();
  });

  test('should add product with 16oz size at base price', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.selectProductByName('Green Machine');

    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Select 16 oz variant (base price)
    await sheet.getByText('16 oz').click();

    // Add button should be enabled and show the base price
    const addButton = page.locator('.add-btn');
    await expect(addButton).toBeEnabled({ timeout: 5_000 });
    await expect(addButton).toContainText('$7.50');

    await addButton.click();

    // Item should appear in sidebar
    await expect(registerPage.orderLineItems.first()).toBeVisible();
    await expect(registerPage.orderLineItems.first()).toContainText('Green Machine');
  });

  test('should add product with 24oz size at increased price', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.selectProductByName('Green Machine');

    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Select 24 oz variant (+$1.50 = $9.00)
    await sheet.getByText('24 oz').click();

    const addButton = page.locator('.add-btn');
    await expect(addButton).toBeEnabled({ timeout: 5_000 });
    await expect(addButton).toContainText('$9.00');

    await addButton.click();

    await expect(registerPage.orderLineItems.first()).toBeVisible();
    await expect(registerPage.orderLineItems.first()).toContainText('Green Machine');
  });

  test('should allow adding optional boost modifiers', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.selectProductByName('Green Machine');

    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Select 16 oz first (required variant)
    await sheet.getByText('16 oz').click();
    await expect(page.locator('.add-btn')).toBeEnabled({ timeout: 5_000 });

    // Add Protein boost (+$1.50)
    await sheet.getByText('Protein').click();

    // Price should be $7.50 + $1.50 = $9.00
    const addButton = page.locator('.add-btn');
    await expect(addButton).toContainText('$9.00');

    await addButton.click();

    // Sidebar should show the item with modifier
    await expect(registerPage.orderLineItems.first()).toBeVisible();
    await expect(registerPage.orderLineItems.first()).toContainText('Green Machine');
  });

  test('should complete order with modified product', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    // Add Green Machine with 16oz
    await registerPage.selectProductByName('Green Machine');
    const sheet = page.locator('.sheet-content');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    await sheet.getByText('16 oz').click();
    await expect(page.locator('.add-btn')).toBeEnabled({ timeout: 5_000 });
    await page.locator('.add-btn').click();

    await expect(registerPage.orderLineItems.first()).toBeVisible();

    // Go to checkout
    await registerPage.goToCheckout();

    const checkoutPage = new CheckoutPage(page);
    await expect(page.locator('.summary-line', { hasText: 'Green Machine' })).toBeVisible();

    // Pay exact
    await checkoutPage.clickExact();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    await expect(completePage.heading).toHaveText('Order Complete');
  });
});
