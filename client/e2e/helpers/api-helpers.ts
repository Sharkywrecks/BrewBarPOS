/**
 * Shared API helpers for e2e specs that need to drive the API directly
 * (creating an order from a cashier session, fetching reference data, etc).
 *
 * These are thin wrappers around `page.request` that handle the new
 * /api/auth/pin-login contract: it now requires `userId` + `pin` (the old
 * pin-only lookup was a brute-force vector, see auth hardening session).
 * Each helper looks up the cashier's id via /api/auth/staff once and caches
 * it on the request context so repeat callers don't pay the round-trip.
 */

import type { Page } from '@playwright/test';
import { API_BASE_URL, TEST_CASHIER, TEST_ADMIN } from '../test-data';

export interface CashierToken {
  token: string;
  userId: string;
}

/**
 * Logs in as the seeded e2e cashier (display name "Demo Cashier") and returns
 * a JWT for use in subsequent Authorization headers.
 *
 * Throws if the cashier wasn't created by global-setup — that almost certainly
 * means the playwright config is missing `globalSetup: require.resolve('./global-setup')`.
 */
export async function loginAsCashier(page: Page): Promise<CashierToken> {
  const staffRes = await page.request.get(`${API_BASE_URL}/api/auth/staff`);
  if (!staffRes.ok()) {
    throw new Error(`GET /api/auth/staff failed: ${staffRes.status()}`);
  }
  const staff = (await staffRes.json()) as Array<{ id: string; displayName: string }>;
  const cashier = staff.find((s) => s.displayName === TEST_CASHIER.displayName);
  if (!cashier) {
    throw new Error(
      `Cashier '${TEST_CASHIER.displayName}' not found in /api/auth/staff. ` +
        `Did global-setup run? Configured staff: ${staff.map((s) => s.displayName).join(', ')}`,
    );
  }

  const loginRes = await page.request.post(`${API_BASE_URL}/api/auth/pin-login`, {
    data: { userId: cashier.id, pin: TEST_CASHIER.pin },
  });
  if (!loginRes.ok()) {
    throw new Error(`POST /api/auth/pin-login failed: ${loginRes.status()}`);
  }
  const body = await loginRes.json();
  return { token: body.token as string, userId: cashier.id };
}

/**
 * Logs in as the seeded e2e admin via password and returns a JWT.
 * Used by API-level helpers that need an admin token; UI tests should use
 * AdminLoginPage instead so they exercise the form flow.
 */
export async function loginAsAdminApi(page: Page): Promise<string> {
  const res = await page.request.post(`${API_BASE_URL}/api/auth/login`, {
    data: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  });
  if (!res.ok()) {
    throw new Error(`POST /api/auth/login failed: ${res.status()}`);
  }
  const body = await res.json();
  return body.token as string;
}

/**
 * Creates a paid test order via the cashier API. Returns the created order id
 * so the calling spec can navigate to it. Designed to be called from
 * `test.beforeAll` so the admin orders/reports views have data to display.
 */
export async function createPaidTestOrder(page: Page): Promise<number> {
  const { token } = await loginAsCashier(page);
  const auth = { Authorization: `Bearer ${token}` };

  const catRes = await page.request.get(`${API_BASE_URL}/api/categories?activeOnly=true`, {
    headers: auth,
  });
  const categories = (await catRes.json()) as Array<{ id: number }>;
  if (categories.length === 0) {
    throw new Error('No categories returned by /api/categories — global-setup failed?');
  }

  const catDetailRes = await page.request.get(
    `${API_BASE_URL}/api/categories/${categories[0].id}`,
    {
      headers: auth,
    },
  );
  const catDetail = (await catDetailRes.json()) as {
    products: Array<{ id: number; name: string; basePrice: number }>;
  };
  const product = catDetail.products[0];

  const orderRes = await page.request.post(`${API_BASE_URL}/api/orders`, {
    headers: auth,
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
  const order = (await orderRes.json()) as { id: number; total: number };

  await page.request.post(`${API_BASE_URL}/api/payments`, {
    headers: auth,
    data: {
      orderId: order.id,
      method: 'Cash',
      amountTendered: order.total,
      total: order.total,
    },
  });

  return order.id;
}
