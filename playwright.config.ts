import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Phase 1.3 E2E suite.
 *
 * The E2E tests in tests/e2e/ run against a static fixture page
 * (tests/e2e/fixtures/index.html) that implements the public DOM contract
 * scaffolded MFEs are expected to expose. The fixture is framework-free and
 * served by `http-server` so CI doesn't need Module Federation, a BFF, or
 * any of the generated dependencies running.
 *
 * To run E2E locally:
 *   npx playwright install chromium      # once per machine
 *   npm run test:e2e                     # or: npx playwright test
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx http-server tests/e2e/fixtures -p 4321 -s -c-1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
