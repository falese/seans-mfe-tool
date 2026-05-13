/**
 * Phase 1.3 E2E — authentication.
 *
 * Verifies the auth-gate contract:
 *   - Without a token, the auth gate is rendered and data-state="denied"
 *   - Capability buttons are NOT rendered while denied
 *   - Logging in (clicking .login) transitions the MFE to "ready"
 *   - Logging out reverses the transition
 *   - ?auth=required forces the gate even when a token is present
 */

import { test, expect } from '@playwright/test';

test.describe('authentication', () => {
  test('renders the auth gate when no token is present', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('token'));
    await page.goto('/');

    const root = page.locator('[data-mfe="data-analysis"]');
    await expect(root).toHaveAttribute('data-state', 'denied');
    await expect(page.locator('[data-auth="required"]')).toBeVisible();
    await expect(page.locator('button.login')).toBeVisible();
    // Capability buttons must NOT be reachable while denied.
    await expect(page.locator('[data-capability]')).toHaveCount(0);
  });

  test('transitions to ready after successful login', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('token'));
    await page.goto('/');

    await page.locator('button.login').click();

    const root = page.locator('[data-mfe="data-analysis"]');
    await expect(root).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('[data-capability="query"]')).toBeVisible();
    // A token must now be persisted in localStorage.
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toMatch(/^fake-jwt-/);
  });

  test('logout reverts back to the auth gate', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('token', 'preseeded-test-token'));
    await page.goto('/');

    await expect(page.locator('[data-mfe="data-analysis"]')).toHaveAttribute('data-state', 'ready');

    await page.locator('button.logout').click();

    await expect(page.locator('[data-mfe="data-analysis"]')).toHaveAttribute('data-state', 'denied');
    await expect(page.locator('[data-auth="required"]')).toBeVisible();
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('?auth=required forces the gate even with a valid token', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('token', 'preseeded-test-token'));
    await page.goto('/?auth=required');

    await expect(page.locator('[data-mfe="data-analysis"]')).toHaveAttribute('data-state', 'denied');
    await expect(page.locator('button.login')).toBeVisible();
  });
});
