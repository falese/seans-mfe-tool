import { expect, test } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Meridian Station');
  await page.waitForTimeout(3000);
  // berth strip has 6 tiles
  await expect(page.locator('.berth-slot')).toHaveCount(6);
});

test('docking board shows berth b1', async ({ page }) => {
  await page.goto('/');
  await page.click('nav > div > a:nth-child(1)');
  await page.waitForTimeout(3000);
  await expect(page.locator('main table tbody tr:nth-child(1) td:nth-child(3)')).toHaveText('VR-88213');
  await expect(page.locator('text=₢ 8,500.00').first()).toBeVisible();
});
