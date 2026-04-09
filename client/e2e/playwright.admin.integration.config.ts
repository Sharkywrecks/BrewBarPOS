import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/admin',
  // See ./global-setup.ts — bootstraps admin + cashier + catalog against the
  // integration API. Both integration configs share the same setup file so
  // running the admin and pos suites back-to-back against the same docker
  // container is idempotent.
  globalSetup: require.resolve('./global-setup'),
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: '../playwright-admin-report' }], ['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env['CI']
    ? undefined
    : {
        command: 'npx ng serve admin --port 4200 --configuration integration',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
