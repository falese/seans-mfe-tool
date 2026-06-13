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
   * The capability rendered when `mount` is called without an explicit one.
   * Multi-capability MFEs expose several (PlayGame, ShowCover, …); this is the
   * fallback when the host does not select one. A per-mount `options.capability`
   * always wins.
   */
  defaultCapability?: string;
  /**
   * Extra base render inputs merged beneath the resolved capability and the
   * per-mount props. Rarely needed; `defaultCapability` covers the common case.
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
    mount: async (element: MountElement, mountOptions = {}) => {
      // The host owns the element; ensure it is addressable for doRender,
      // which still resolves by containerId today (ADR-055 lineage).
      const el = element as { id?: string };
      if (!el.id) el.id = `mfe-mount-${++autoId}`;

      if (options.mfeReady) {
        await options.mfeReady;
      } else if (mfe.load) {
        await mfe.load({ requestId: `handle-load-${el.id}`, timestamp: new Date(), inputs: {} });
      }

      // Per-mount capability wins; fall back to the handle's bound default.
      // `component` is the render-input key doRender reads (== capability name).
      const capability = mountOptions.capability ?? options.defaultCapability;

      await mfe.render({
        requestId: `handle-render-${el.id}`,
        timestamp: new Date(),
        inputs: {
          containerId: el.id,
          ...(options.inputs ?? {}),
          ...(capability !== undefined ? { component: capability, capability } : {}),
          props: mountOptions.props ?? {},
        },
      });

      return async () => {
        await mfe.destroy?.();
      };
    },
  };
}
