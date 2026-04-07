import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Login @smoke', () => {
  test('should show the pin pad on the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.pinButtons.first()).toBeVisible();
  });

  test('should redirect to register after valid PIN', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Default cashier PIN from seed data
    await loginPage.enterPin('0000');
    await loginPage.waitForRedirect();

    await expect(page).toHaveURL(/.*register/);
  });

  test('should show error for invalid PIN', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.enterPin('9999');

    // Wait for error to appear
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/register');

    // Should be redirected to login
    await expect(page).toHaveURL(/.*login/);
  });
});
