import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../pages/admin-login.page';
import { AdminCatalogPage } from '../../pages/admin-catalog.page';

async function loginAndGoToModifiers(page: Page): Promise<AdminCatalogPage> {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsAdmin();

  const catalogPage = new AdminCatalogPage(page);
  await catalogPage.goto();
  await expect(catalogPage.heading).toBeVisible({ timeout: 10_000 });

  // Switch to Modifiers tab
  await catalogPage.modifiersTab.click();
  await expect(page.locator('tr.mat-mdc-row').first()).toBeVisible({ timeout: 10_000 });

  return catalogPage;
}

test.describe('Modifier Management @integration', () => {
  test('should display seeded modifiers', async ({ page }) => {
    await loginAndGoToModifiers(page);

    // Seeded: Size, Boost, Milk
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Size' })).toBeVisible();
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Boost' })).toBeVisible();
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Milk' })).toBeVisible();
  });

  test('should show modifier properties', async ({ page }) => {
    await loginAndGoToModifiers(page);

    // Size is required, single-select
    const sizeRow = page.locator('tr.mat-mdc-row', { hasText: 'Size' });
    await expect(sizeRow).toContainText('Yes'); // Required
    await expect(sizeRow).toContainText('No'); // Allow Multiple = No

    // Boost is optional, multi-select
    const boostRow = page.locator('tr.mat-mdc-row', { hasText: 'Boost' });
    await expect(boostRow).toContainText('Yes'); // Allow Multiple
  });

  test('should show option count', async ({ page }) => {
    await loginAndGoToModifiers(page);

    // Size has 2 options (16 oz, 24 oz)
    const sizeRow = page.locator('tr.mat-mdc-row', { hasText: 'Size' });
    await expect(sizeRow).toContainText('2');

    // Boost has 4 options (Protein, Collagen, Immunity, Energy)
    const boostRow = page.locator('tr.mat-mdc-row', { hasText: 'Boost' });
    await expect(boostRow).toContainText('4');

    // Milk has 4 options
    const milkRow = page.locator('tr.mat-mdc-row', { hasText: 'Milk' });
    await expect(milkRow).toContainText('4');
  });

  test('should create a new modifier with options', async ({ page }) => {
    const catalogPage = await loginAndGoToModifiers(page);

    await catalogPage.clickNewModifier();

    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('New Modifier')).toBeVisible();

    // Fill modifier name
    await dialog.locator('input[matInput]').first().fill('Sweetener');

    // Fill first option name
    const optionInputs = dialog.locator('.option-row input[matInput]');
    await optionInputs.first().fill('Honey');

    // Add another option
    await dialog.locator('button', { hasText: 'Add Option' }).click();
    await dialog.locator('.option-row').last().locator('input[matInput]').first().fill('Agave');

    await dialog.locator('button', { hasText: 'Save' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    // New modifier should appear
    await expect(page.locator('tr.mat-mdc-row', { hasText: 'Sweetener' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('should edit a modifier', async ({ page }) => {
    const catalogPage = await loginAndGoToModifiers(page);

    await catalogPage.editRowByName('Size');

    const dialog = page.locator('mat-dialog-container').first();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Edit Modifier')).toBeVisible();

    // Verify name is pre-filled
    const nameInput = dialog.locator('input[matInput]').first();
    await expect(nameInput).toHaveValue('Size');

    // Should show existing options (16 oz, 24 oz)
    await expect(dialog.locator('.option-row')).toHaveCount(2);

    await dialog.locator('button', { hasText: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test('should delete a modifier without products', async ({ page }) => {
    const catalogPage = await loginAndGoToModifiers(page);

    // Delete the "Sweetener" we created
    const sweetenerRow = page.locator('tr.mat-mdc-row', { hasText: 'Sweetener' });
    if (await sweetenerRow.isVisible()) {
      await catalogPage.deleteRowByName('Sweetener');
      await expect(sweetenerRow).not.toBeVisible({ timeout: 10_000 });
    }
  });
});
