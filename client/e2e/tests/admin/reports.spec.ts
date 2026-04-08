import { test, expect, Page } from '@playwright/test';
import { AdminLoginPage } from '../../pages/admin-login.page';
import { AdminReportsPage } from '../../pages/admin-reports.page';

async function loginAsAdmin(page: Page): Promise<void> {
  const loginPage = new AdminLoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsAdmin();
}

// Helper: create a test order so reports have data
async function createTestOrder(page: Page): Promise<void> {
  const baseUrl = 'http://localhost:5050';

  const loginRes = await page.request.post(`${baseUrl}/api/auth/pin-login`, {
    data: { pin: '0000' },
  });
  const { token } = await loginRes.json();

  const catRes = await page.request.get(`${baseUrl}/api/categories?activeOnly=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const categories = await catRes.json();
  const catDetailRes = await page.request.get(`${baseUrl}/api/categories/${categories[0].id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const catDetail = await catDetailRes.json();
  const product = catDetail.products[0];

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
          quantity: 2,
          modifierItems: [],
        },
      ],
    },
  });
  const order = await orderRes.json();

  await page.request.post(`${baseUrl}/api/payments`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      orderId: order.id,
      method: 0,
      amountTendered: order.total,
      total: order.total,
    },
  });
}

test.describe('Reports @integration', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await createTestOrder(page);
    await page.close();
  });

  test('should display reports page with KPI cards', async ({ page }) => {
    await loginAsAdmin(page);
    const reportsPage = new AdminReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.heading).toBeVisible({ timeout: 10_000 });

    // Wait for data to load
    await expect(reportsPage.kpiCards.first()).toBeVisible({ timeout: 15_000 });

    // Should show 6 KPI cards
    await expect(reportsPage.ordersKpi).toBeVisible();
    await expect(reportsPage.grossSalesKpi).toBeVisible();
  });

  test('should show order count greater than 0', async ({ page }) => {
    await loginAsAdmin(page);
    const reportsPage = new AdminReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.ordersKpi).toBeVisible({ timeout: 15_000 });

    // Orders count should be at least 1
    const ordersValue = reportsPage.ordersKpi.locator('.kpi-value');
    await expect(ordersValue).not.toHaveText('0');
  });

  test('should show gross sales amount', async ({ page }) => {
    await loginAsAdmin(page);
    const reportsPage = new AdminReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.grossSalesKpi).toBeVisible({ timeout: 15_000 });

    // Gross sales should show a dollar amount
    await expect(reportsPage.grossSalesKpi.locator('.kpi-value')).toContainText('$');
  });

  test('should show payment methods breakdown', async ({ page }) => {
    await loginAsAdmin(page);
    const reportsPage = new AdminReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.paymentMethodsCard).toBeVisible({ timeout: 15_000 });
    await expect(reportsPage.paymentMethodsCard.getByText('Cash')).toBeVisible();
  });

  test('should show top products table', async ({ page }) => {
    await loginAsAdmin(page);
    const reportsPage = new AdminReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.topProductsTable).toBeVisible({ timeout: 15_000 });
    // Should have at least one product row
    await expect(reportsPage.topProductsTable.locator('tr.mat-mdc-row').first()).toBeVisible();
  });

  test('should have date picker for selecting report date', async ({ page }) => {
    await loginAsAdmin(page);
    const reportsPage = new AdminReportsPage(page);
    await reportsPage.goto();

    await expect(reportsPage.dateInput).toBeVisible();
  });
});
