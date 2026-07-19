import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5000',
    headless: true,
    viewport: { width: 1440, height: 900 },
    // Sandboxes with a preinstalled Chromium can point at it instead of
    // downloading a browser (e.g. CHROMIUM_PATH=/opt/pw-browsers/chromium).
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
