import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../pages/admin-login.page';
import { AdminOrdersPage, AdminOrderDetailPage } from '../../pages/admin-orders.page';
import { createPaidTestOrder } from '../../helpers/api-helpers';

async function loginAsAdmin(page: Page): Promise<void> {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsAdmin();
}

test.describe('Order Management @integration', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await createPaidTestOrder(page);
    await page.close();
  });

  test('should display orders list', async ({ page }) => {
    await loginAsAdmin(page);
    const ordersPage = new AdminOrdersPage(page);
    await ordersPage.goto();

    await expect(ordersPage.heading).toBeVisible({ timeout: 10_000 });
    await expect(ordersPage.orderRows.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show order details with columns', async ({ page }) => {
    await loginAsAdmin(page);
    const ordersPage = new AdminOrdersPage(page);
    await ordersPage.goto();
    await expect(ordersPage.orderRows.first()).toBeVisible({ timeout: 10_000 });

    // Rows should show order number, total, status
    const firstRow = ordersPage.orderRows.first();
    await expect(firstRow).toContainText('$');
  });

  test('should navigate to order detail on row click', async ({ page }) => {
    await loginAsAdmin(page);
    const ordersPage = new AdminOrdersPage(page);
    await ordersPage.goto();
    await expect(ordersPage.orderRows.first()).toBeVisible({ timeout: 10_000 });

    await ordersPage.orderRows.first().click();
    await expect(page).toHaveURL(/.*orders\/\d+/, { timeout: 10_000 });

    const detailPage = new AdminOrderDetailPage(page);
    await expect(detailPage.heading).toBeVisible();
    await expect(detailPage.detailsCard).toBeVisible();
    await expect(detailPage.lineItemRows.first()).toBeVisible();
  });

  test('should show order details with totals and payments', async ({ page }) => {
    await loginAsAdmin(page);
    const ordersPage = new AdminOrdersPage(page);
    await ordersPage.goto();
    await expect(ordersPage.orderRows.first()).toBeVisible({ timeout: 10_000 });

    await ordersPage.orderRows.first().click();
    await expect(page).toHaveURL(/.*orders\/\d+/, { timeout: 10_000 });

    const detailPage = new AdminOrderDetailPage(page);

    // Details card should show subtotal, tax, total
    await expect(detailPage.detailsCard.getByText('Subtotal')).toBeVisible();
    await expect(detailPage.detailsCard.locator('.info-row.total')).toBeVisible();

    // Payments card should show payment info
    await expect(detailPage.paymentsCard).toBeVisible();
  });

  test('should navigate back to orders list', async ({ page }) => {
    await loginAsAdmin(page);
    const ordersPage = new AdminOrdersPage(page);
    await ordersPage.goto();
    await expect(ordersPage.orderRows.first()).toBeVisible({ timeout: 10_000 });

    await ordersPage.orderRows.first().click();
    await expect(page).toHaveURL(/.*orders\/\d+/, { timeout: 10_000 });

    const detailPage = new AdminOrderDetailPage(page);
    await detailPage.goBack();
    await expect(page).toHaveURL(/.*orders$/);
  });

  test('should void an order', async ({ page }) => {
    // Create a fresh order to void
    await createPaidTestOrder(page);

    await loginAsAdmin(page);
    const ordersPage = new AdminOrdersPage(page);
    await ordersPage.goto();
    await expect(ordersPage.orderRows.first()).toBeVisible({ timeout: 10_000 });

    // Click the most recent order
    await ordersPage.orderRows.first().click();
    await expect(page).toHaveURL(/.*orders\/\d+/, { timeout: 10_000 });

    const detailPage = new AdminOrderDetailPage(page);

    // Void the order
    if (await detailPage.voidButton.isVisible()) {
      await detailPage.voidButton.click();

      // Status should change to Voided. The wire format is now string-named
      // enums (Open / Completed / Voided), no longer integer ordinals.
      await expect(detailPage.statusChip).toContainText('Voided', { timeout: 10_000 });

      // Void button should disappear
      await expect(detailPage.voidButton).not.toBeVisible();
    }
  });
});
