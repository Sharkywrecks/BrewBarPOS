/**
 * Shared test data for the e2e suites.
 *
 * The API no longer seeds users or a sample catalog — fresh installs start
 * empty and the first admin is created via POST /api/auth/setup. The Playwright
 * `globalSetup` (./global-setup.ts) calls that endpoint once before each test
 * run, registers a Cashier, and seeds the catalog the integration tests assume.
 *
 * Both admin- and pos-side specs import constants from this file rather than
 * hard-coding strings, so renaming the test admin / changing the test PIN
 * happens in exactly one place.
 */

export const API_BASE_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5050';

export const TEST_ADMIN = {
  displayName: 'E2E Admin',
  email: 'e2e-admin@brewbar.test',
  password: 'E2eAdminPass123!',
  pin: '1234',
} as const;

export const TEST_CASHIER = {
  displayName: 'Demo Cashier',
  email: 'e2e-cashier@brewbar.test',
  password: 'E2eCashierPass123!',
  pin: '9911',
} as const;
