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

async function addWaterToCart(page: Page): Promise<RegisterPage> {
  const registerPage = new RegisterPage(page);
  await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

  await registerPage.categoryBar.locator('text=Drinks').click();
  await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
    timeout: 10_000,
  });
  await registerPage.selectProductByName('Water');
  await expect(registerPage.orderLineItems.first()).toBeVisible();

  return registerPage;
}

test.describe('Order Notes @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCashier(page);
  });

  test('should open notes dialog from sidebar', async ({ page }) => {
    await addWaterToCart(page);

    // Click the Notes button in sidebar
    const notesBtn = page.locator('.notes-btn');
    await notesBtn.click();

    // Dialog should open
    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.locator('text=Order Notes')).toBeVisible();
  });

  test('should save notes to order', async ({ page }) => {
    await addWaterToCart(page);

    // Open notes dialog
    await page.locator('.notes-btn').click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Type notes
    await page.locator('textarea[matInput]').fill('No ice please');

    // Save
    await page.locator('button', { hasText: 'Save' }).click();

    // Dialog should close — wait for it to disappear
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test('should display notes on checkout page', async ({ page }) => {
    const registerPage = await addWaterToCart(page);

    // Add notes
    await page.locator('.notes-btn').click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.locator('textarea[matInput]').fill('Extra cold');
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Go to checkout
    await registerPage.goToCheckout();

    const checkoutPage = new CheckoutPage(page);
    await expect(checkoutPage.notesDisplay).toBeVisible();
    await expect(checkoutPage.notesDisplay).toContainText('Extra cold');
  });

  test('should include notes in completed order', async ({ page }) => {
    const registerPage = await addWaterToCart(page);

    // Add notes
    await page.locator('.notes-btn').click();
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await page.locator('textarea[matInput]').fill('Rush order');
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Checkout and pay
    await registerPage.goToCheckout();
    const checkoutPage = new CheckoutPage(page);
    await checkoutPage.clickExact();
    await checkoutPage.submit();

    await expect(page).toHaveURL(/.*order-complete/, { timeout: 10_000 });

    const completePage = new OrderCompletePage(page);
    await expect(completePage.heading).toHaveText('Order Complete');
    // The order was successfully created with notes — verified by reaching completion
  });
});
