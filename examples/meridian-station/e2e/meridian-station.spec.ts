import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Meridian Station smoke suite. Assumes the full stack is running and
 * registered (docker compose up + register-station.sh, or scripts/dev-up.sh
 * — see STATION-DEMO.md). The suite drives the same path a demo does:
 * compose the console, open every domain, watch live data arrive.
 */

const scripts = join(__dirname, '..', 'scripts');
const fire = (script: string, ...args: string[]) =>
  execFileSync(join(scripts, script), args, { stdio: 'ignore' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('control plane: connected')).toBeVisible({ timeout: 15_000 });
  fire('console.sh');
  await expect(page.getByText('Docking Control')).toBeVisible({ timeout: 20_000 });
});

test('console composes with the keyed berth strip', async ({ page }) => {
  await expect(page.getByText('Meridian Station', { exact: false }).first()).toBeVisible();
  // Six keyed slots; the strip fills itself through six control-plane round trips.
  // DeclaredSlot stamps data-declared-slot on every provided region (ADR-072),
  // so the strip is addressed by its declared ids rather than a bespoke attribute.
  await expect(page.locator('[data-declared-slot^="berth."]')).toHaveCount(6);
  await expect(page.locator('[data-declared-slot^="berth."] .tile')).toHaveCount(6, {
    timeout: 60_000,
  });
});

test('docking: one action fills main and status', async ({ page }) => {
  await page.getByText('Docking Control').click();
  await expect(page.getByText('Docking Board')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Traffic Log')).toBeVisible();
  // Two-source join: live ledger money against harbormaster occupancy.
  await expect(page.getByText('₢', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('DISPUTED').first()).toBeVisible();
});

test('cargo: the split document shows its valuation gap', async ({ page }) => {
  await page.getByText('Cargo Operations').click();
  await expect(page.getByText('Cargo Manifest')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('valuation pending — finance')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Hazardous Cargo Aboard')).toBeVisible();
});

test('crew: roster joins StationOS identity with ledger payroll', async ({ page }) => {
  await page.getByText('Crew Services').click();
  await expect(page.getByText('Crew Roster')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Imani Okafor')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Pay Exceptions')).toBeVisible();
});

test('crew: PayStatus is the Rust build, beside the React roster', async ({ page }) => {
  await page.getByText('Crew Services').click();
  // control-plane.yaml places PayStatus `from: meridian-crew-services-wasm`
  // (ADR-103): the status rail is WebAssembly, mounted through the same
  // Module Federation adaptor as the React roster in main.
  const card = page.locator('[data-capability="PayStatus"][data-rendered-by="rust-wasm"]');
  await expect(card).toBeVisible({ timeout: 30_000 });
  // Live rows from the BFF, fetched through the Rust build's own query capability.
  await expect(card.locator('[data-state="ready"]')).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText('HELD').first()).toBeVisible();
  await expect(card.getByText('₢', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Imani Okafor')).toBeVisible();
});

test('concourse: three conventions on one screen', async ({ page }) => {
  await page.getByText('Concourse', { exact: true }).click();
  await expect(page.getByText('Concourse Directory')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Red Dust Noodle Bar')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Inbound supplies/ })).toBeVisible();
});

test('life support: single-source contrast case', async ({ page }) => {
  await page.getByText('Life Support').click();
  await expect(page.getByText('Life Support Telemetry')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('CRITICAL').first()).toBeVisible({ timeout: 15_000 });
});
