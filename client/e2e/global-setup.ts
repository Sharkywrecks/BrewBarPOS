/**
 * Playwright globalSetup — bootstraps a fresh API instance for the e2e suite.
 *
 * Runs once per Playwright invocation, before any tests. Idempotent: if the API
 * already has the test admin (e.g. you re-ran tests against the same docker
 * compose without restarting), every step short-circuits cleanly.
 *
 * Sequence:
 *   1. Wait for /health/ready (the docker-compose healthcheck already gates
 *      this, but the local-dev "no docker" path needs explicit polling).
 *   2. POST /api/auth/setup with TEST_ADMIN credentials. 200 = first run, 409 =
 *      already done — both are fine.
 *   3. Log in as admin to get a token.
 *   4. POST /api/auth/register to create TEST_CASHIER. 400 (duplicate email) =
 *      already done.
 *   5. GET /api/categories — if empty, seed modifiers + categories + products
 *      and link them. The catalog mirrors what the old in-process SeedData used
 *      to create, so existing tests that look for "Smoothies" / "Green Machine"
 *      / "16 oz" still pass.
 */

import { request, type APIRequestContext, type FullConfig } from '@playwright/test';
import { API_BASE_URL, TEST_ADMIN, TEST_CASHIER } from './test-data';

const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;

async function waitForApi(api: APIRequestContext): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await api.get(`${API_BASE_URL}/health/ready`);
      if (res.ok()) return;
      lastError = `HTTP ${res.status()}`;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    `[e2e global-setup] API at ${API_BASE_URL} not ready after ${READY_TIMEOUT_MS}ms: ${lastError}`,
  );
}

async function bootstrapAdmin(api: APIRequestContext): Promise<string> {
  const setupRes = await api.post(`${API_BASE_URL}/api/auth/setup`, {
    data: {
      displayName: TEST_ADMIN.displayName,
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      pin: TEST_ADMIN.pin,
    },
  });

  if (setupRes.status() === 200) {
    const body = await setupRes.json();
    console.log(`[e2e global-setup] Created admin via /setup: ${TEST_ADMIN.email}`);
    return body.token as string;
  }

  if (setupRes.status() !== 409) {
    throw new Error(
      `[e2e global-setup] /setup returned unexpected status ${setupRes.status()}: ${await setupRes.text()}`,
    );
  }

  // 409 — admin already exists. Log in instead.
  console.log('[e2e global-setup] Admin already exists, logging in');
  const loginRes = await api.post(`${API_BASE_URL}/api/auth/login`, {
    data: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  });
  if (!loginRes.ok()) {
    throw new Error(
      `[e2e global-setup] Could not log in as existing admin (${loginRes.status()}). ` +
        `If the API was provisioned by a previous test run with different credentials, ` +
        `restart the API container to wipe state.`,
    );
  }
  const body = await loginRes.json();
  return body.token as string;
}

async function ensureCashier(api: APIRequestContext, adminToken: string): Promise<void> {
  const res = await api.post(`${API_BASE_URL}/api/auth/register`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      displayName: TEST_CASHIER.displayName,
      email: TEST_CASHIER.email,
      password: TEST_CASHIER.password,
      pin: TEST_CASHIER.pin,
      role: 'Cashier',
    },
  });

  if (res.ok()) {
    console.log(`[e2e global-setup] Created cashier: ${TEST_CASHIER.displayName}`);
    return;
  }
  if (res.status() === 400) {
    // Duplicate email — already provisioned.
    return;
  }
  throw new Error(
    `[e2e global-setup] /register failed for cashier (${res.status()}): ${await res.text()}`,
  );
}

interface SeededModifierIds {
  size: number;
  boost: number;
  milk: number;
}

async function ensureCatalog(api: APIRequestContext, adminToken: string): Promise<void> {
  const auth = { Authorization: `Bearer ${adminToken}` };

  const existing = await api.get(`${API_BASE_URL}/api/categories`, { headers: auth });
  if (!existing.ok()) {
    throw new Error(`[e2e global-setup] GET /api/categories failed: ${existing.status()}`);
  }
  const categories = (await existing.json()) as Array<{ name: string }>;
  if (categories.length > 0) {
    console.log(`[e2e global-setup] Catalog already seeded (${categories.length} categories)`);
    return;
  }

  console.log('[e2e global-setup] Seeding catalog (modifiers, categories, products)...');

  // ─── Modifiers ────────────────────────────────────────────────
  const modifierIds: SeededModifierIds = {
    size: await createModifier(api, auth, {
      name: 'Size',
      isRequired: true,
      allowMultiple: false,
      sortOrder: 0,
      options: [
        { name: '16 oz', price: 0, sortOrder: 0 },
        { name: '24 oz', price: 1.5, sortOrder: 1 },
      ],
    }),
    boost: await createModifier(api, auth, {
      name: 'Boost',
      isRequired: false,
      allowMultiple: true,
      sortOrder: 1,
      options: [
        { name: 'Protein', price: 1.5, sortOrder: 0 },
        { name: 'Collagen', price: 1.5, sortOrder: 1 },
        { name: 'Immunity', price: 1.0, sortOrder: 2 },
        { name: 'Energy', price: 1.0, sortOrder: 3 },
      ],
    }),
    milk: await createModifier(api, auth, {
      name: 'Milk',
      isRequired: true,
      allowMultiple: false,
      sortOrder: 2,
      options: [
        { name: 'Whole Milk', price: 0, sortOrder: 0 },
        { name: 'Oat Milk', price: 0.75, sortOrder: 1 },
        { name: 'Almond Milk', price: 0.75, sortOrder: 2 },
        { name: 'Coconut Milk', price: 0.75, sortOrder: 3 },
      ],
    }),
  };

  // ─── Categories + products ────────────────────────────────────
  const smoothiesId = await createCategory(api, auth, {
    name: 'Smoothies',
    description: 'Fresh blended smoothies',
    sortOrder: 0,
    isActive: true,
  });
  const smoothies = [
    { name: 'Green Machine', basePrice: 7.5, description: 'Spinach, banana, mango, pineapple' },
    {
      name: 'Berry Blast',
      basePrice: 7.5,
      description: 'Strawberry, blueberry, raspberry, banana',
    },
    {
      name: 'Tropical Paradise',
      basePrice: 8.0,
      description: 'Mango, pineapple, coconut, passion fruit',
    },
    { name: 'PB Power', basePrice: 8.5, description: 'Peanut butter, banana, chocolate, oats' },
  ];
  for (const [i, p] of smoothies.entries()) {
    const id = await createProduct(api, auth, { ...p, categoryId: smoothiesId, sortOrder: i });
    await assignModifier(api, auth, id, modifierIds.size);
    await assignModifier(api, auth, id, modifierIds.boost);
  }

  const juicesId = await createCategory(api, auth, {
    name: 'Fresh Juices',
    description: 'Cold-pressed fresh juices',
    sortOrder: 1,
    isActive: true,
  });
  const juices = [
    { name: 'Orange Sunrise', basePrice: 6.5, description: 'Orange, carrot, ginger' },
    { name: 'Green Detox', basePrice: 7.0, description: 'Celery, cucumber, apple, lemon' },
    { name: 'Beet It', basePrice: 7.0, description: 'Beet, apple, ginger, lemon' },
  ];
  for (const [i, p] of juices.entries()) {
    const id = await createProduct(api, auth, { ...p, categoryId: juicesId, sortOrder: i });
    await assignModifier(api, auth, id, modifierIds.size);
  }

  const bowlsId = await createCategory(api, auth, {
    name: 'Acai Bowls',
    description: 'Acai and smoothie bowls',
    sortOrder: 2,
    isActive: true,
  });
  const bowls = [
    { name: 'Classic Acai', basePrice: 10.0, description: 'Acai, granola, banana, honey' },
    { name: 'Pitaya Bowl', basePrice: 10.5, description: 'Dragon fruit, mango, coconut, granola' },
  ];
  for (const [i, p] of bowls.entries()) {
    const id = await createProduct(api, auth, { ...p, categoryId: bowlsId, sortOrder: i });
    await assignModifier(api, auth, id, modifierIds.boost);
  }

  const drinksId = await createCategory(api, auth, {
    name: 'Drinks',
    description: 'Coffee, tea, and other beverages',
    sortOrder: 3,
    isActive: true,
  });
  const coldBrewId = await createProduct(api, auth, {
    name: 'Cold Brew',
    basePrice: 4.5,
    description: 'House cold brew coffee',
    categoryId: drinksId,
    sortOrder: 0,
  });
  await assignModifier(api, auth, coldBrewId, modifierIds.milk);

  const matchaId = await createProduct(api, auth, {
    name: 'Matcha Latte',
    basePrice: 5.5,
    description: 'Ceremonial grade matcha',
    categoryId: drinksId,
    sortOrder: 1,
  });
  await assignModifier(api, auth, matchaId, modifierIds.milk);

  // Water has no modifiers.
  await createProduct(api, auth, {
    name: 'Water',
    basePrice: 2.0,
    description: 'Bottled water',
    categoryId: drinksId,
    sortOrder: 2,
  });

  console.log('[e2e global-setup] Catalog seeded.');
}

// ─── Low-level helpers ────────────────────────────────────────────

// Playwright's `headers` option requires a string-indexed map, not a record
// with named keys. Using `Record<string, string>` keeps `Authorization` as a
// regular property while still being assignable to the request option type.
type AuthHeaders = Record<string, string>;

async function createModifier(
  api: APIRequestContext,
  headers: AuthHeaders,
  body: {
    name: string;
    isRequired: boolean;
    allowMultiple: boolean;
    sortOrder: number;
    options: Array<{ name: string; price: number; sortOrder: number }>;
  },
): Promise<number> {
  const res = await api.post(`${API_BASE_URL}/api/modifiers`, { headers, data: body });
  if (!res.ok()) {
    throw new Error(`Create modifier '${body.name}' failed: ${res.status()} ${await res.text()}`);
  }
  const json = await res.json();
  return json.id as number;
}

async function createCategory(
  api: APIRequestContext,
  headers: AuthHeaders,
  body: { name: string; description: string; sortOrder: number; isActive: boolean },
): Promise<number> {
  const res = await api.post(`${API_BASE_URL}/api/categories`, { headers, data: body });
  if (!res.ok()) {
    throw new Error(`Create category '${body.name}' failed: ${res.status()} ${await res.text()}`);
  }
  const json = await res.json();
  return json.id as number;
}

async function createProduct(
  api: APIRequestContext,
  headers: AuthHeaders,
  body: {
    name: string;
    description: string;
    basePrice: number;
    categoryId: number;
    sortOrder: number;
  },
): Promise<number> {
  const res = await api.post(`${API_BASE_URL}/api/products`, {
    headers,
    data: { ...body, isAvailable: true },
  });
  if (!res.ok()) {
    throw new Error(`Create product '${body.name}' failed: ${res.status()} ${await res.text()}`);
  }
  const json = await res.json();
  return json.id as number;
}

async function assignModifier(
  api: APIRequestContext,
  headers: AuthHeaders,
  productId: number,
  modifierId: number,
): Promise<void> {
  const res = await api.post(`${API_BASE_URL}/api/products/${productId}/modifiers/${modifierId}`, {
    headers,
  });
  if (!res.ok()) {
    throw new Error(
      `Assign modifier ${modifierId} → product ${productId} failed: ${res.status()} ${await res.text()}`,
    );
  }
}

// ─── Entry point ──────────────────────────────────────────────────

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const api = await request.newContext();
  try {
    console.log(`[e2e global-setup] Bootstrapping API at ${API_BASE_URL}`);
    await waitForApi(api);
    const adminToken = await bootstrapAdmin(api);
    await ensureCashier(api, adminToken);
    await ensureCatalog(api, adminToken);
    console.log('[e2e global-setup] Done.');
  } finally {
    await api.dispose();
  }
}
