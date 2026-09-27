import { test, expect, Page, APIRequestContext } from '@playwright/test';

/**
 * Cross-application composition (#345): the platform's central claim, run.
 *
 * Meridian Station places an MFE it did not build. abc-kids' flappy is built
 * and deployed by that project; meridian's control-plane.yaml only references
 * it, and on a context change (`meridian.off-shift`) the console's work area
 * swaps from station operations to the other application's game. The shell
 * knows nothing about either (ADR-055). Composition is registry data.
 *
 * Needs the minimal stack from .github/workflows/composition.yml: registry,
 * daemon, shell, meridian-console and abc-kids-flappy, with
 * control-plane/rules.json registered (scripts/register-station.sh). The full
 * demo suite, meridian-station.spec.ts, also needs the station APIs.
 */

const DAEMON = 'http://localhost:4504/graphql';

/** Send a STATE_UPDATE through the daemon, exactly as scripts/send-action.sh does. */
async function sendState(request: APIRequestContext, stateKey: string): Promise<void> {
  const id = `${stateKey.replace(/\./g, '-')}-${Date.now()}`;
  const message = {
    direction: 'ACTION',
    kind: 'ACTION',
    payload: {
      id,
      componentId: 'shell',
      actionType: 'STATE_UPDATE',
      stateKey,
      data: {},
      timestamp: new Date().toISOString(),
      context: { sessionId: 'cross-app-composition', application: 'web' },
    },
    metadata: { correlationId: id, acknowledged: false, error: null },
  };
  const res = await request.post(DAEMON, {
    data: {
      query: 'mutation($m:String!){sendMessage(message:$m)}',
      variables: { m: JSON.stringify(message) },
    },
  });
  expect(res.ok()).toBe(true);
}

const slot = (page: Page, address: string) => page.locator(`[data-layout-slot="${address}"]`);

/** Open the shell, compose the console, then send the context change. */
async function goOffShift(page: Page, request: APIRequestContext): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('control plane: connected')).toBeVisible({ timeout: 30_000 });
  await sendState(request, 'meridian.root');
  await expect(slot(page, 'root')).toHaveAttribute('data-slot-state', 'ready', { timeout: 30_000 });
  await sendState(request, 'meridian.off-shift');
  await expect(slot(page, 'meridian-console/main')).toHaveAttribute('data-slot-state', 'ready', {
    timeout: 30_000,
  });
}

test.describe('Cross-application composition (#345)', () => {
  test('both applications serve their federation containers', async ({ request }) => {
    for (const entry of ['http://localhost:5001/remoteEntry.js', 'http://localhost:3001/remoteEntry.js']) {
      const res = await request.get(entry);
      expect(res.status(), entry).toBe(200);
    }
  });

  test('meridian.root composes the station console', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByText('control plane: connected')).toBeVisible({ timeout: 30_000 });
    await sendState(request, 'meridian.root');
    await expect(slot(page, 'root')).toHaveAttribute('data-slot-state', 'ready', { timeout: 30_000 });
    // The domain list comes from the rule's props, so it renders without the APIs.
    await expect(page.getByText('Docking Control')).toBeVisible();
  });

  test("a context change mounts another application's MFE into the console", async ({ page, request }) => {
    await goOffShift(page, request);
    const main = slot(page, 'meridian-console/main');
    // Children, not just a ready flag: an empty slot is the white screen.
    expect(await main.locator('*').count()).toBeGreaterThan(0);
    await expect(main.locator('.mfe-error-boundary[role="alert"]')).toHaveCount(0);
    // The slots this composition owns. The console also fires
    // meridian.berth.b1..b6 on mount, which resolve to docking-control — not
    // in this minimal stack — so those six berth slots end in `error` by
    // design and are not what this test is about.
    await expect(slot(page, 'root')).toHaveAttribute('data-slot-state', 'ready');
    await expect(main).toHaveAttribute('data-slot-state', 'ready');
    // It is abc-kids' own deployment: the container the LayoutManager loaded
    // is flappy's, from flappy's origin, not anything meridian built.
    const loaded = await page.evaluate(() => typeof (window as unknown as Record<string, unknown>)['abc_kids_flappy']);
    expect(loaded).toBe('object');
  });

  test('a remote component that throws shows the fallback, not an empty host (#247)', async ({ page, request }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(`console.error: ${m.text().slice(0, 300)}`);
    });
    await goOffShift(page, request);

    // Through the foreign remote's own federation container: its bundle, its
    // runtime copy, its ErrorBoundary. Only the component is a stand-in.
    const outcome = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const container = w['abc_kids_flappy'] as
        | { get(module: string): Promise<() => { mfe?: Record<string, unknown> }> }
        | undefined;
      if (!container) return { error: 'no abc_kids_flappy container on window' };
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
    const fallback = page.locator('#composition-probe .mfe-error-boundary[role="alert"]');
    try {
      await expect(fallback).toBeVisible();
    } catch (error) {
      // Say what the probe rendered and what the page reported, so a failure
      // here names its cause instead of only "element not found".
      const rendered = await page.locator('#composition-probe').innerHTML();
      throw new Error(
        `No fallback rendered.\nprobe innerHTML: ${JSON.stringify(rendered.slice(0, 500))}\n` +
          `page errors:\n  ${pageErrors.join('\n  ') || '(none)'}\n${(error as Error).message}`
      );
    }
  });
});
