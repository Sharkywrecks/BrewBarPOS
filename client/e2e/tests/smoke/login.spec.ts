import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Login @smoke', () => {
  test('should show the staff picker on the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // The POS login page now requires picking a staff member before the PIN
    // pad appears. global-setup provisions the e2e cashier so the button is
    // visible.
    await expect(page.locator('.staff-btn').first()).toBeVisible({ timeout: 15_000 });
  });

  test('should redirect to register after valid PIN', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsCashier();
    await expect(page).toHaveURL(/.*register/);
  });

  test('should show error for invalid PIN', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.selectStaff('Demo Cashier');
    await loginPage.enterPin('9999');

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/register');

    // Should be redirected to login
    await expect(page).toHaveURL(/.*login/);
  });
});
