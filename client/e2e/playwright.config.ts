import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
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
