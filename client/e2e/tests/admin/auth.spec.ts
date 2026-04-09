import { test, expect } from '@playwright/test';
import { AdminLoginPage } from '../../pages/admin-login.page';
import { TEST_ADMIN } from '../../test-data';

test.describe('Admin Authentication @integration', () => {
  test('should show login form', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();

    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInButton).toBeVisible();
    await expect(page.getByText('BrewBar Admin')).toBeVisible();
  });

  test('should login as admin with valid credentials', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();

    await loginPage.login(TEST_ADMIN.email, TEST_ADMIN.password);
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10_000 });
  });

  test('should reject invalid credentials', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();

    await loginPage.login('wrong@brewbar.local', 'BadPassword!');
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/.*login/);
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should navigate to dashboard after login', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();

    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
    // Dashboard cards should be visible
    await expect(page.locator('.card-label', { hasText: 'Catalog' })).toBeVisible();
    await expect(page.locator('.card-label', { hasText: 'Orders' })).toBeVisible();
  });

  test('should persist session across reload', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should logout and redirect to login', async ({ page }) => {
    const loginPage = new AdminLoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();

    // Click logout button in toolbar
    await page.locator('mat-icon', { hasText: 'logout' }).click();
    await expect(page).toHaveURL(/.*login/, { timeout: 5_000 });
  });
});
