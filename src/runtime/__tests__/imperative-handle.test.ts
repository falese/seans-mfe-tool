/**
 * createImperativeHandle (ADR-056) — the MFE-side port, framework-neutral:
 * it drives only the neutral lifecycle and hands the host a mount/unmount.
 */
import { createImperativeHandle, type MountableLifecycle } from '../imperative-handle';

function fakeMfe() {
  const calls: unknown[][] = [];
  const mfe: MountableLifecycle & { calls: unknown[][] } = {
    calls,
    async load(ctx) { calls.push(['load', ctx]); },
    async render(ctx) {
      const inputs = (ctx as { inputs: { containerId: string; props: unknown } }).inputs;
      calls.push(['render', inputs.containerId, inputs.props]);
    },
    async destroy() { calls.push(['destroy']); },
  };
  return mfe;
}

describe('createImperativeHandle', () => {
  it('produces an imperative-dom handle tagged with framework', () => {
    const handle = createImperativeHandle(fakeMfe(), { framework: 'react' });
    expect(handle.kind).toBe('imperative-dom');
    expect(handle.framework).toBe('react');
    expect(typeof handle.mount).toBe('function');
  });

  it('assigns an id to an element without one, renders into it, unmounts via destroy', async () => {
    const mfe = fakeMfe();
    const el: { id?: string; appendChild: () => void } = { appendChild: () => undefined };
    const unmount = await createImperativeHandle(mfe, { mfeReady: Promise.resolve() }).mount(el, { level: 2 });

    expect(el.id).toMatch(/^mfe-mount-/);
    expect(mfe.calls).toContainEqual(['render', el.id, { level: 2 }]);
    expect(mfe.calls.some((c) => c[0] === 'load')).toBe(false); // mfeReady ⇒ no redundant load

    await unmount();
    expect(mfe.calls).toContainEqual(['destroy']);
  });

  it('preserves an existing element id', async () => {
    const mfe = fakeMfe();
    await createImperativeHandle(mfe, { mfeReady: Promise.resolve() }).mount(
      { id: 'slot-7', appendChild: () => undefined }
    );
    expect(mfe.calls).toContainEqual(['render', 'slot-7', {}]);
  });

  it('awaits mfeReady before rendering and does not call load itself', async () => {
    const order: string[] = [];
    const ready = Promise.resolve().then(() => { order.push('ready'); });
    const mfe: MountableLifecycle = {
      async load() { order.push('load'); },
      async render() { order.push('render'); },
    };
    await createImperativeHandle(mfe, { mfeReady: ready }).mount({ id: 'x', appendChild: () => undefined });
    expect(order).toEqual(['ready', 'render']);
  });

  it('merges bound base inputs (e.g. component) beneath per-mount props', async () => {
    const seen: Record<string, unknown>[] = [];
    const mfe: MountableLifecycle = {
      async render(ctx) { seen.push((ctx as { inputs: Record<string, unknown> }).inputs); },
    };
    await createImperativeHandle(mfe, {
      mfeReady: Promise.resolve(),
      inputs: { component: 'PlayGame' },
    }).mount({ id: 'slot', appendChild: () => undefined }, { difficulty: 3 });

    expect(seen[0]).toEqual({ containerId: 'slot', component: 'PlayGame', props: { difficulty: 3 } });
  });

  it('loads on demand when no mfeReady is given', async () => {
    const mfe = fakeMfe();
    await createImperativeHandle(mfe).mount({ id: 'y', appendChild: () => undefined });
    expect(mfe.calls.some((c) => c[0] === 'load')).toBe(true);
    expect(mfe.calls.some((c) => c[0] === 'render')).toBe(true);
  });
});
