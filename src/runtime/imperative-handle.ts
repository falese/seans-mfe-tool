/**
 * createImperativeHandle — the MFE side of the presentation boundary (ADR-056).
 *
 * Wraps an MFE's neutral lifecycle as the guaranteed imperative presentation
 * handle: `mount(element, props) → unmount`. The host-side Framework Provider
 * consumes this handle and owns the element and teardown — the MFE no longer
 * decides *where* it renders, only *how* (inside its own doRender / layer 5).
 *
 * Deliberately framework-free: it touches only the neutral lifecycle methods
 * (load / render / destroy), so it lives in the core and the ADR-056 boundary
 * test stays green. The actual framework mount (createRoot, etc.) happens
 * inside the MFE's doRender, behind this port.
 */
import type { ImperativeMountHandle, MountElement } from '@seans-mfe/contracts';

/**
 * The neutral subset of BaseMFE that an imperative handle drives. Structural,
 * so this module needs neither a concrete MFE class nor a UI framework.
 */
export interface MountableLifecycle {
  load?(context: Record<string, unknown>): Promise<unknown> | unknown;
  render(context: Record<string, unknown>): Promise<unknown> | unknown;
  destroy?(): Promise<void> | void;
}

export interface ImperativeHandleOptions {
  /** Observability / negotiation tag (e.g. 'react', 'angular'). */
  framework?: string;
  /**
   * The remote's bootstrap load() promise, if it kicks load off itself
   * (the generated bootstrap does). When provided, the handle awaits it
   * instead of calling load() again — no redundant load, no state-machine
   * churn. When absent, the handle calls load() on demand if available.
   */
  mfeReady?: Promise<unknown>;
  /**
   * Base render inputs the remote binds at creation, merged beneath the
   * per-mount props — typically `{ component: 'PlayGame' }` so doRender knows
   * which capability to render. The host's `mount(el, props)` props win.
   */
  inputs?: Record<string, unknown>;
}

let autoId = 0;

export function createImperativeHandle(
  mfe: MountableLifecycle,
  options: ImperativeHandleOptions = {}
): ImperativeMountHandle {
  return {
    kind: 'imperative-dom',
    framework: options.framework,
    mount: async (element: MountElement, props?: Record<string, unknown>) => {
      // The host owns the element; ensure it is addressable for doRender,
      // which still resolves by containerId today (ADR-055 lineage).
      const el = element as { id?: string };
      if (!el.id) el.id = `mfe-mount-${++autoId}`;

      if (options.mfeReady) {
        await options.mfeReady;
      } else if (mfe.load) {
        await mfe.load({ requestId: `handle-load-${el.id}`, timestamp: new Date(), inputs: {} });
      }

      await mfe.render({
        requestId: `handle-render-${el.id}`,
        timestamp: new Date(),
        inputs: { containerId: el.id, ...(options.inputs ?? {}), props: props ?? {} },
      });

      return async () => {
        await mfe.destroy?.();
      };
    },
  };
}
