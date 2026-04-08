import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../pages/admin-login.page';
import { AdminCatalogPage } from '../../pages/admin-catalog.page';

async function loginAndGoToCatalog(page: Page): Promise<AdminCatalogPage> {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsAdmin();

  const catalogPage = new AdminCatalogPage(page);
  await catalogPage.goto();
  await expect(catalogPage.heading).toBeVisible({ timeout: 10_000 });
  return catalogPage;
}

test.describe('Category Management @integration', () => {
  test('should display seeded categories', async ({ page }) => {
    const catalogPage = await loginAndGoToCatalog(page);

    // Categories tab should be selected by default
    await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 10_000 });

    // Seeded: Smoothies, Fresh Juices, Acai Bowls, Drinks
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Smoothies' })).toBeVisible();
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Fresh Juices' })).toBeVisible();
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Acai Bowls' })).toBeVisible();
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Drinks' })).toBeVisible();
  });

  test('should show product count for categories', async ({ page }) => {
    const catalogPage = await loginAndGoToCatalog(page);
    await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 10_000 });

    // Smoothies has 4 products
    const smoothiesRow = page.locator('tr.mat-mdc-row', { hasText: 'Smoothies' });
    await expect(smoothiesRow).toContainText('4');
  });

  test('should create a new category', async ({ page }) => {
    const catalogPage = await loginAndGoToCatalog(page);
    await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 10_000 });

    await catalogPage.clickNewCategory();

    // Dialog should open
    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('New Category')).toBeVisible();

    // Fill form
    await dialog.locator('input[matInput]').first().fill('Specials');
    await dialog.locator('button', { hasText: 'Save' }).click();

    // Dialog should close and new category should appear
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Specials' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should edit an existing category', async ({ page }) => {
    const catalogPage = await loginAndGoToCatalog(page);
    await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 10_000 });

    // Edit the "Specials" category we just created (or any seeded one)
    await catalogPage.editRowByName('Drinks');

    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Edit Category')).toBeVisible();

    // Verify name is pre-filled
    const nameInput = dialog.locator('input[matInput]').first();
    await expect(nameInput).toHaveValue('Drinks');

    // Change the description
    const descInput = dialog.locator('input[matInput]').nth(1);
    await descInput.fill('Hot and cold beverages');
    await dialog.locator('button', { hasText: 'Save' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test('should delete a category without products', async ({ page }) => {
    const catalogPage = await loginAndGoToCatalog(page);
    await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 10_000 });

    const uniqueName = `DeleteMe-${Date.now()}`;

    // First create a category to delete
    await catalogPage.clickNewCategory();
    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.locator('input[matInput]').first().fill(uniqueName);
    await dialog.locator('button', { hasText: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // Verify it exists
    await expect(page.locator('tr.mat-mdc-row', { hasText: uniqueName }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Delete it (confirm dialog is handled by deleteRowByName)
    await catalogPage.deleteRowByName(uniqueName);

    // Should disappear
    await expect(page.locator('tr.mat-mdc-row', { hasText: uniqueName })).not.toBeVisible({
      timeout: 10_000,
    });
  });
});
