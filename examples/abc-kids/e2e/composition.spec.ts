import { test, expect, Page } from '@playwright/test';

/**
 * Composition smoke (#345): what only a running fleet can show.
 *
 * abc-kids.spec.ts drives the games through the shell. This file pins the
 * platform claims underneath that: every remote serves a container, the shell
 * resolves and mounts one over the network, and a remote whose component
 * throws is contained by the runtime's ErrorBoundary rather than leaving an
 * empty host — the white screen ADR-044 exists to prevent (#247).
 */

const REMOTES = [
  { id: 'flappy', entry: 'http://localhost:3001/remoteEntry.js' },
  { id: 'hockey', entry: 'http://localhost:3002/remoteEntry.js' },
  { id: 'multiplication-quiz', entry: 'http://localhost:3003/remoteEntry.js' },
];

async function openFlappy(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's Play! 🎮" }).click();
  await page.getByText('Flappy Bird').click();
  await expect(page.locator('[role="progressbar"]')).toBeHidden({ timeout: 20_000 });
}

test.describe('Composition smoke (#345)', () => {
  for (const remote of REMOTES) {
    test(`${remote.id} serves its federation container`, async ({ request }) => {
      const res = await request.get(remote.entry);
      expect(res.status()).toBe(200);
      expect((await res.text()).length).toBeGreaterThan(0);
    });
  }

  test('the shell mounts a remote over the network into a non-empty host', async ({ page }) => {
    await openFlappy(page);
    const host = page.locator('#mfe-game-flappy');
    await expect(host).toBeVisible();
    // Children, not just a visible box: an empty host is the white screen.
    expect(await host.locator('*').count()).toBeGreaterThan(0);
    await expect(host.locator('.mfe-error-boundary[role="alert"]')).toHaveCount(0);
  });

  test('a remote component that throws shows the fallback, not an empty host (#247)', async ({ page }) => {
    await openFlappy(page);

    // The remote the shell just loaded, through its own federation container:
    // the same bundle, runtime and ErrorBoundary a real mount uses. The
    // component is the only stand-in — one that throws on render.
    const outcome = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const container = w['abc_kids_flappy'] as
        | { get(module: string): Promise<() => { mfe?: Record<string, unknown> }> }
        | undefined;
      if (!container) {
        return { error: 'no abc_kids_flappy container on window', globals: Object.keys(w).filter((k) => /flappy/i.test(k)) };
      }
      const mfe = (await container.get('./App'))().mfe as
        | { mountComponent(c: unknown, p: object, id: string): Promise<unknown> }
        | undefined;
      if (!mfe) return { error: './App exposes no mfe' };

      const probe = document.createElement('div');
      probe.id = 'composition-probe';
      document.body.appendChild(probe);
      const Throws = (): never => {
        throw new Error('composition-probe: forced render throw');
      };
      await mfe.mountComponent(Throws, {}, 'composition-probe');
      return { ok: true };
    });

    expect(outcome).toEqual({ ok: true });
    await expect(page.locator('#composition-probe .mfe-error-boundary[role="alert"]')).toBeVisible();
  });
});
