/**
 * Phase 1.3 E2E — capability invocation.
 *
 * Verifies the runtime contract for invoking a capability:
 *   - Clicking [data-capability="<name>"] runs the capability handler
 *   - .result is rendered with the success payload
 *   - The result is scoped per capability via data-result-for
 *   - Sequential invocations replace prior results
 */

import { test, expect } from '@playwright/test';

test.describe('capability invocation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'preseeded-test-token');
    });
  });

  test('invokes the query capability and renders a success result', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-capability="query"]').click();

    const result = page.locator('.result[data-result-for="query"]');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Success');
    await expect(result).toContainText('42 rows');
  });

  test('returns a different payload for the report capability', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-capability="report"]').click();

    const result = page.locator('.result[data-result-for="report"]');
    await expect(result).toBeVisible();
    await expect(result).toContainText('report.csv');
  });

  test('shows an interim "running" state for slow invocations', async ({ page }) => {
    await page.goto('/?delay=400');

    await page.locator('[data-capability="query"]').click();

    // The invoking state must be observable before the result lands.
    await expect(page.locator('.invoking')).toBeVisible();
    await expect(page.locator('.result[data-result-for="query"]')).toBeVisible({ timeout: 5_000 });
    // After completion, the interim state is replaced.
    await expect(page.locator('.invoking')).toHaveCount(0);
  });

  test('latest invocation replaces the previous result', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-capability="query"]').click();
    await expect(page.locator('.result[data-result-for="query"]')).toBeVisible();

    await page.locator('[data-capability="report"]').click();
    await expect(page.locator('.result[data-result-for="report"]')).toBeVisible();
    // Only one result is rendered at a time.
    await expect(page.locator('.result')).toHaveCount(1);
  });
});
