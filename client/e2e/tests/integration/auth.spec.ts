import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { TEST_ADMIN, TEST_CASHIER } from '../../test-data';

test.describe('Authentication @integration', () => {
  test('should display staff members from the API', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // global-setup creates exactly two users: TEST_ADMIN and TEST_CASHIER.
    const staffButtons = page.locator('.staff-btn');
    await expect(staffButtons.first()).toBeVisible({ timeout: 15_000 });
    await expect(staffButtons).toHaveCount(2);
    await expect(loginPage.staffButton(TEST_ADMIN.displayName)).toBeVisible();
    await expect(loginPage.staffButton(TEST_CASHIER.displayName)).toBeVisible();
  });

  test('should login as cashier with valid PIN', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsCashier();
    await expect(page).toHaveURL(/.*register/);
  });

  test('should login as admin with valid PIN', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdminViaPin();
    await expect(page).toHaveURL(/.*register/);
  });

  test('should reject invalid PIN with error message', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.selectStaff(TEST_CASHIER.displayName);
    await loginPage.enterPin('9999');

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/.*login/);
  });

  test('should persist session across page reload', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsCashier();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on register (JWT token in localStorage)
    await expect(page).toHaveURL(/.*register/);
  });

  test('should redirect to login when token is cleared', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsCashier();

    // Clear the JWT token from localStorage
    await page.evaluate(() => localStorage.removeItem('brewbar_token'));

    // Navigate to a protected route
    await page.goto('/register');

    await expect(page).toHaveURL(/.*login/);
  });
});
