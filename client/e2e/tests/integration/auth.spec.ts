import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Authentication @integration', () => {
  test('should display staff members from the API', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Seeded staff: "Admin" and "Demo Cashier"
    const staffButtons = page.locator('.staff-btn');
    await expect(staffButtons.first()).toBeVisible({ timeout: 15_000 });
    await expect(staffButtons).toHaveCount(2);
    await expect(staffButtons.filter({ hasText: 'Admin' })).toBeVisible();
    await expect(staffButtons.filter({ hasText: 'Demo Cashier' })).toBeVisible();
  });

  test('should login as cashier with valid PIN (0000)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Select Demo Cashier
    const cashierBtn = page.locator('.staff-btn', { hasText: 'Demo Cashier' });
    await expect(cashierBtn).toBeVisible({ timeout: 15_000 });
    await cashierBtn.click();

    // Enter PIN
    await loginPage.enterPin('0000');
    await loginPage.waitForRedirect();

    await expect(page).toHaveURL(/.*register/);
  });

  test('should login as admin with valid PIN (1234)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const adminBtn = page.locator('.staff-btn', { hasText: 'Admin' });
    await expect(adminBtn).toBeVisible({ timeout: 15_000 });
    await adminBtn.click();

    await loginPage.enterPin('1234');
    await loginPage.waitForRedirect();

    await expect(page).toHaveURL(/.*register/);
  });

  test('should reject invalid PIN with error message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const cashierBtn = page.locator('.staff-btn', { hasText: 'Demo Cashier' });
    await expect(cashierBtn).toBeVisible({ timeout: 15_000 });
    await cashierBtn.click();

    await loginPage.enterPin('9999');

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/.*login/);
  });

  test('should persist session across page reload', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const cashierBtn = page.locator('.staff-btn', { hasText: 'Demo Cashier' });
    await expect(cashierBtn).toBeVisible({ timeout: 15_000 });
    await cashierBtn.click();

    await loginPage.enterPin('0000');
    await loginPage.waitForRedirect();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on register (JWT token in localStorage)
    await expect(page).toHaveURL(/.*register/);
  });

  test('should redirect to login when token is cleared', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const cashierBtn = page.locator('.staff-btn', { hasText: 'Demo Cashier' });
    await expect(cashierBtn).toBeVisible({ timeout: 15_000 });
    await cashierBtn.click();

    await loginPage.enterPin('0000');
    await loginPage.waitForRedirect();

    // Clear the JWT token from localStorage
    await page.evaluate(() => localStorage.removeItem('brewbar_token'));

    // Navigate to a protected route
    await page.goto('/register');

    await expect(page).toHaveURL(/.*login/);
  });
});
