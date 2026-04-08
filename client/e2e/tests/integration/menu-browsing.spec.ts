import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { RegisterPage } from '../../pages/register.page';

async function loginAsCashier(page: Page): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  const cashierBtn = page.locator('.staff-btn', { hasText: 'Demo Cashier' });
  await expect(cashierBtn).toBeVisible({ timeout: 15_000 });
  await cashierBtn.click();

  await loginPage.enterPin('0000');
  await loginPage.waitForRedirect();
}

test.describe('Menu Browsing @integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCashier(page);
  });

  test('should load all 4 seeded categories', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.categoryBar).toBeVisible({ timeout: 10_000 });

    // Seeded categories: Smoothies, Fresh Juices, Acai Bowls, Drinks
    for (const name of ['Smoothies', 'Fresh Juices', 'Acai Bowls', 'Drinks']) {
      await expect(registerPage.categoryBar.locator(`text=${name}`)).toBeVisible();
    }
  });

  test('should auto-select first category (Smoothies) and show its products', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    // Smoothies has 4 products: Green Machine, Berry Blast, Tropical Paradise, PB Power
    await expect(registerPage.productCards).toHaveCount(4);
    await expect(page.locator('app-product-card', { hasText: 'Green Machine' })).toBeVisible();
    await expect(page.locator('app-product-card', { hasText: 'Berry Blast' })).toBeVisible();
    await expect(page.locator('app-product-card', { hasText: 'Tropical Paradise' })).toBeVisible();
    await expect(page.locator('app-product-card', { hasText: 'PB Power' })).toBeVisible();
  });

  test('should switch to Fresh Juices and show 3 products', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    // Click Fresh Juices category
    await registerPage.categoryBar.locator('text=Fresh Juices').click();

    // Wait for new products to load
    await expect(page.locator('app-product-card', { hasText: 'Orange Sunrise' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(registerPage.productCards).toHaveCount(3);
    await expect(page.locator('app-product-card', { hasText: 'Green Detox' })).toBeVisible();
    await expect(page.locator('app-product-card', { hasText: 'Beet It' })).toBeVisible();
  });

  test('should switch to Drinks and show 3 products including Water', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    await registerPage.categoryBar.locator('text=Drinks').click();

    await expect(page.locator('app-product-card', { hasText: 'Water' })).toBeVisible({
      timeout: 10_000,
    });
    // At least 3 seeded drinks (Cold Brew, Matcha Latte, Water), may have more from admin CRUD tests
    const count = await registerPage.productCards.count();
    expect(count).toBeGreaterThanOrEqual(3);
    await expect(page.locator('app-product-card', { hasText: 'Cold Brew' })).toBeVisible();
    await expect(page.locator('app-product-card', { hasText: 'Matcha Latte' })).toBeVisible();
  });

  test('should show product names and prices on cards', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await expect(registerPage.productCards.first()).toBeVisible({ timeout: 10_000 });

    // Check that prices are visible on product cards
    const greenMachineCard = page.locator('app-product-card', { hasText: 'Green Machine' });
    await expect(greenMachineCard).toContainText('$7.50');

    // Switch to Drinks to check Water price
    await registerPage.categoryBar.locator('text=Drinks').click();
    const waterCard = page.locator('app-product-card', { hasText: 'Water' });
    await expect(waterCard).toBeVisible({ timeout: 10_000 });
    await expect(waterCard).toContainText('$2.00');
  });
});
