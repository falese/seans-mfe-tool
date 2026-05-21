/**
 * Phase 1.3 E2E — error handling.
 *
 * Verifies the error-boundary contract:
 *   - A thrown capability handler renders .error-fallback
 *   - data-state="error" is set on the MFE root
 *   - The retry button transitions the MFE back into a ready state
 *   - Explicit error injection works the same way as a runtime throw
 */

import { test, expect } from '@playwright/test';

test.describe('error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('token', 'preseeded-test-token'));
  });

  test('renders the error fallback when a capability throws', async ({ page }) => {
    await page.goto('/?fail=true');

    await page.locator('[data-capability="query"]').click();

    const root = page.locator('[data-mfe="data-analysis"]');
    await expect(root).toHaveAttribute('data-state', 'error');
    const fallback = page.locator('.error-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('Forced failure in capability "query"');
    // No success result should be rendered.
    await expect(page.locator('.result')).toHaveCount(0);
  });

  test('explicit error injection short-circuits to the fallback', async ({ page }) => {
    await page.goto('/');

    await page.locator('button.invoke-error').click();

    await expect(page.locator('[data-mfe="data-analysis"]')).toHaveAttribute('data-state', 'error');
    await expect(page.locator('.error-fallback')).toContainText('Capability handler threw');
  });

  test('retry transitions back into a ready state', async ({ page }) => {
    await page.goto('/?fail=true');
    await page.locator('[data-capability="query"]').click();
    await expect(page.locator('.error-fallback')).toBeVisible();

    await page.locator('button.retry').click();

    const root = page.locator('[data-mfe="data-analysis"]');
    await expect(root).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('.error-fallback')).toHaveCount(0);
    await expect(page.locator('[data-capability="query"]')).toBeVisible();
  });

  test('subsequent successful invocations clear the prior error', async ({ page }) => {
    await page.goto('/?fail=true');
    await page.locator('[data-capability="query"]').click();
    await expect(page.locator('.error-fallback')).toBeVisible();

    // Retry now that ?fail is cleared by the retry handler.
    await page.locator('button.retry').click();
    await page.locator('[data-capability="query"]').click();

    await expect(page.locator('.result[data-result-for="query"]')).toBeVisible();
    await expect(page.locator('.error-fallback')).toHaveCount(0);
  });
});
