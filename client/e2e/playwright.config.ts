import { defineConfig, devices } from '@playwright/test';

// Smoke tests run against the local dev pos server (port 4201) backed by the
// dev API on port 5000. global-setup.ts reads the API URL from E2E_API_URL,
// so set the dev port here before the import is evaluated.
process.env['E2E_API_URL'] ??= 'http://localhost:5000';

export default defineConfig({
  testDir: './tests',
  // Bootstraps the e2e admin + cashier + sample catalog against the dev API.
  // Same script as the integration configs; idempotent so re-running smoke
  // doesn't fail on duplicate-user errors.
  globalSetup: require.resolve('./global-setup'),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [['html', { outputFolder: '../playwright-report' }], ['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4201',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the POS dev server if not already running
  webServer: process.env['CI']
    ? undefined
    : {
        command: 'npx ng serve pos --port 4201',
        url: 'http://localhost:4201',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
