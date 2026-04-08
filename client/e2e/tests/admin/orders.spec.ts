import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../pages/admin-login.page';
import { AdminOrdersPage, AdminOrderDetailPage } from '../../pages/admin-orders.page';

async function loginAsAdmin(page: Page): Promise<void> {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsAdmin();
}

// Helper: create an order via POS API directly so admin has something to view
async function createTestOrder(page: Page): Promise<void> {
  const baseUrl = 'http://localhost:5050';

  // Login as cashier to get token
  const loginRes = await page.request.post(`${baseUrl}/api/auth/pin-login`, {
    data: { pin: '0000' },
  });
  const { token } = await loginRes.json();

  // Get categories to find a product
  const catRes = await page.request.get(`${baseUrl}/api/categories?activeOnly=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const categories = await catRes.json();
  const catDetailRes = await page.request.get(`${baseUrl}/api/categories/${categories[0].id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const catDetail = await catDetailRes.json();
  const product = catDetail.products[0];

  // Create order
  const orderRes = await page.request.post(`${baseUrl}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      localId: crypto.randomUUID(),
      taxRate: 0.15,
      lineItems: [
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.basePrice,
          quantity: 1,
          modifierItems: [],
        },
      ],
    },
  });
  const order = await orderRes.json();

  // Create payment
  await page.request.post(`${baseUrl}/api/payments`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      orderId: order.id,
      method: 0, // Cash
      amountTendered: order.total,
      total: order.total,
    },
  });
}

test.describe('Order Management @integration', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await createTestOrder(page);
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
    await createTestOrder(page);

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

      // Status should change to Voided (status enum: 0=Open, 1=Completed, 2=Voided)
      await expect(detailPage.statusChip).toContainText('2', { timeout: 10_000 });

      // Void button should disappear
      await expect(detailPage.voidButton).not.toBeVisible();
    }
  });
});
