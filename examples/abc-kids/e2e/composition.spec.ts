import { test, expect, Page, APIRequestContext } from '@playwright/test';

/**
 * Composition smoke (#345): the platform's central claim, executed.
 *
 * The shell is a daemon-driven LayoutManager host (ADR-055). It knows nothing
 * about which MFEs exist, and renders nothing until the control plane publishes
 * an experience. So each test does what a real session does: open the shell,
 * wait for the control plane, send a state action through the daemon, and
 * assert the registry's answer mounts. That is the same path as
 * scripts/play.sh.
 *
 * Needs the stack from .github/workflows/composition.yml: registry, daemon,
 * API, home, flappy, hockey, multiplication-quiz and the shell, with
 * control-plane/rules.json registered (scripts/register-games.sh).
 */

const DAEMON = 'http://localhost:3004/graphql';

const REMOTES = [
  { id: 'home', entry: 'http://localhost:3015/remoteEntry.js' },
  { id: 'flappy', entry: 'http://localhost:3001/remoteEntry.js' },
  { id: 'hockey', entry: 'http://localhost:3002/remoteEntry.js' },
  { id: 'multiplication-quiz', entry: 'http://localhost:3003/remoteEntry.js' },
];

/** Send a STATE_UPDATE through the daemon, exactly as scripts/play.sh does. */
async function sendState(request: APIRequestContext, stateKey: string): Promise<void> {
  const id = `${stateKey}-${Date.now()}`;
  const message = {
    direction: 'ACTION',
    kind: 'ACTION',
    payload: {
      id,
      componentId: 'app',
      actionType: 'STATE_UPDATE',
      stateKey,
      data: {},
      timestamp: new Date().toISOString(),
      context: { sessionId: 'composition-smoke', application: 'web' },
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

/** Open the shell and wait until it is connected to the control plane. */
async function openShell(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('control plane: connected')).toBeVisible({ timeout: 30_000 });
}

const slot = (page: Page, address: string) => page.locator(`[data-layout-slot="${address}"]`);

/** The home, then flappy into the home's main slot: the launcher flow. */
async function composeFlappy(page: Page, request: APIRequestContext): Promise<void> {
  await openShell(page);
  await sendState(request, 'abc.root');
  await expect(slot(page, 'root')).toHaveAttribute('data-slot-state', 'ready', { timeout: 30_000 });
  await sendState(request, 'abc.play.flappy');
  await expect(slot(page, 'abc-kids-home/main')).toHaveAttribute('data-slot-state', 'ready', {
    timeout: 30_000,
  });
}

test.describe('Composition smoke (#345)', () => {
  for (const remote of REMOTES) {
    test(`${remote.id} serves its federation container`, async ({ request }) => {
      const res = await request.get(remote.entry);
      expect(res.status()).toBe(200);
      expect((await res.text()).length).toBeGreaterThan(0);
    });
  }

  test('the shell connects to the control plane and waits to be composed', async ({ page }) => {
    await openShell(page);
    await expect(page.getByText('Waiting for the control plane to compose this application…')).toBeVisible();
  });

  test('a state action mounts the home, then a game into the slot the home provides', async ({ page, request }) => {
    await composeFlappy(page, request);
    const main = slot(page, 'abc-kids-home/main');
    // Children, not just a ready flag: an empty slot is the white screen.
    expect(await main.locator('*').count()).toBeGreaterThan(0);
    await expect(main.locator('.mfe-error-boundary[role="alert"]')).toHaveCount(0);
    await expect(page.locator('[data-slot-state="error"]')).toHaveCount(0);
  });

  test('a remote component that throws shows the fallback, not an empty host (#247)', async ({ page, request }) => {
    await composeFlappy(page, request);

    // The remote the LayoutManager just loaded, through its own federation
    // container: the same bundle, runtime and ErrorBoundary a real mount
    // uses. The component is the only stand-in — one that throws on render.
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
