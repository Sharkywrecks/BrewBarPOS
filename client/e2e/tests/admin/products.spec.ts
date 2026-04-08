import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../pages/admin-login.page';
import { AdminCatalogPage } from '../../pages/admin-catalog.page';

async function loginAndGoToProducts(page: Page): Promise<AdminCatalogPage> {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsAdmin();

  const catalogPage = new AdminCatalogPage(page);
  await catalogPage.goto();
  await expect(catalogPage.heading).toBeVisible({ timeout: 10_000 });

  // Switch to Products tab
  await catalogPage.productsTab.click();
  await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 10_000 });

  return catalogPage;
}

test.describe('Product Management @integration', () => {
  test('should display seeded products', async ({ page }) => {
    await loginAndGoToProducts(page);

    // Seeded products across all categories
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Green Machine' })).toBeVisible();
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Water' })).toBeVisible();
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Cold Brew' })).toBeVisible();
  });

  test('should show product prices and categories', async ({ page }) => {
    await loginAndGoToProducts(page);

    const waterRow = page.locator('tr.mat-mdc-row', { hasText: 'Water' });
    await expect(waterRow).toContainText('$2.00');
    await expect(waterRow).toContainText('Drinks');
  });

  test('should create a new product', async ({ page }) => {
    const catalogPage = await loginAndGoToProducts(page);

    await catalogPage.clickNewProduct();

    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('New Product')).toBeVisible();

    // Fill product form
    await dialog.locator('input[matInput]').first().fill('Chai Latte');

    // Set price
    const priceInput = dialog.locator('input[type="number"]').first();
    await priceInput.fill('5.00');

    // Select category
    await dialog.locator('mat-select').click();
    await page.locator('mat-option', { hasText: 'Drinks' }).click();

    await dialog.locator('button', { hasText: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // New product should appear
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Chai Latte' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should edit a product', async ({ page }) => {
    const catalogPage = await loginAndGoToProducts(page);

    await catalogPage.editRowByName('Water');

    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Edit Product')).toBeVisible();

    // Verify name is pre-filled
    const nameInput = dialog.locator('input[matInput]').first();
    await expect(nameInput).toHaveValue('Water');

    // Update description
    const descInput = dialog.locator('input[matInput]').nth(1);
    await descInput.fill('Premium bottled water');
    await dialog.locator('button', { hasText: 'Save' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test('should delete a product', async ({ page }) => {
    const catalogPage = await loginAndGoToProducts(page);

    // First create a product to delete
    await catalogPage.clickNewProduct();
    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const uniqueName = `TempProd-${Date.now()}`;
    await dialog.locator('input[matInput]').first().fill(uniqueName);
    await dialog.locator('input[type="number"]').first().fill('1.00');
    await dialog.locator('mat-select').click();
    await page.locator('mat-option', { hasText: 'Drinks' }).click();
    await dialog.locator('button', { hasText: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    await expect(page.locator('tr.mat-mdc-row', { hasText: uniqueName }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Delete it (confirm dialog handled by deleteRowByName)
    await catalogPage.deleteRowByName(uniqueName);
    await expect(page.locator('tr.mat-mdc-row', { hasText: uniqueName })).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test('should show product availability status', async ({ page }) => {
    await loginAndGoToProducts(page);

    // All seeded products should show Available
    const greenMachineRow = page.locator('tr.mat-mdc-row', { hasText: 'Green Machine' });
    await expect(greenMachineRow.locator('mat-chip')).toContainText('Available');
  });
});
