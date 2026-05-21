/**
 * Phase 1.3 E2E — MFE loading.
 *
 * Verifies the public DOM contract scaffolded MFEs are expected to expose:
 *   - The MFE root mounts with [data-mfe="<name>"]
 *   - data-state transitions reach "ready" (or stay in "loading" until forced)
 *   - Capability buttons are discoverable via [data-capability]
 */

import { test, expect } from '@playwright/test';

test.describe('MFE loading', () => {
  test.beforeEach(async ({ page }) => {
    // The auth gate is exercised in authentication.spec.ts; pre-seed a token
    // so this suite focuses on load + render behaviour.
    await page.addInitScript(() => {
      localStorage.setItem('token', 'preseeded-test-token');
    });
  });

  test('boots the data-analysis MFE into the ready state', async ({ page }) => {
    await page.goto('/');

    const root = page.locator('[data-mfe="data-analysis"]');
    await expect(root).toBeVisible();
    await expect(root).toHaveAttribute('data-state', 'ready');
  });

  test('renders both declared capability buttons after load', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('[data-capability="query"]')).toBeVisible();
    await expect(page.locator('[data-capability="report"]')).toBeVisible();
  });

  test('respects a forced loading phase and reaches ready once a hook fires', async ({ page }) => {
    await page.goto('/?init=loading');

    const root = page.locator('[data-mfe="data-analysis"]');
    await expect(root).toHaveAttribute('data-state', 'loading');
    await expect(page.locator('.loading-content')).toBeVisible();

    // Tests are allowed to drive lifecycle transitions via the documented hook.
    await page.evaluate(() => {
      const force = (window as unknown as { __forceReady?: () => void }).__forceReady;
      if (force) force();
    });

    await expect(root).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('[data-capability="query"]')).toBeVisible();
  });

  test('does not render the error fallback on a clean load', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('[data-mfe="data-analysis"]')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('.error-fallback')).toHaveCount(0);
  });
});
