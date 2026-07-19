/**
 * Experience adaptors for the LayoutManager (ADR-055): one adaptor per
 * `contentType` mounts a daemon-published experience into a layout slot.
 * Adaptors are pluggable — register one per contentType to support new
 * delivery mechanisms without touching the manager or the shell:
 *
 *   module-federation → loads the remote container (React, Angular, anything
 *                       that ships the BaseMFE bootstrap `{ mfe, mfeReady }`)
 *                       and drives load()/render() — framework-independent
 *                       because the lifecycle contract is (ADR-041)
 *   text/html         → MFE-owned markup with data-action delegation
 *   application/json  → generic data view
 */

import type {
  ImperativeMountHandle,
  PresentationHandles,
  RenderedExperience,
  SessionContext,
} from '@seans-mfe/contracts';
// isImperativeMountHandle is a *value*, so this emits a
// require("@seans-mfe/contracts") in the compiled runtime. That resolves in
// every consumer: the CLI image (workspace node_modules) and generated MFEs
// (contracts is staged as a file: dep of dist/runtime — #236, ADR-054/056).
import { isImperativeMountHandle } from '@seans-mfe/contracts';
import type { DaemonWebSocketClient } from './graphql-ws-client';

// ── Structural element types (testable without a DOM) ────────

export interface SlotElementLike {
  innerHTML: string;
  appendChild(child: unknown): unknown;
  remove(): void;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

// ── Adaptors ─────────────────────────────────────────────────

export type UnmountFn = () => void | Promise<void>;

export interface AdaptorHelpers {
  /** Send an action back up the control plane for this experience. */
  sendAction(actionType: string, data: Record<string, unknown>): Promise<void>;
  /**
   * A virtual daemon channel for this slot (ADR-057): the host's single socket,
   * scoped to this slot. Injected into a composed MFE's `deps.wsClient` so its
   * `updateControlPlaneState` platform capability rides the shared connection.
   */
  channel?: DaemonWebSocketClient;
  /**
   * Contribute a named slot to the host layout (ADR-058): the MFE renders a
   * region and registers its element so the host routes later experiences
   * (`props.slot === slotId`) into it. The layout itself becomes an MFE.
   */
  provideSlot?(slotId: string, element: SlotElementLike | null): void;
  /** The session this experience was rendered for, when known. */
  session?: SessionContext;
  /**
   * The host's framework (e.g. 'react'), when known. Threaded for ADR-056
   * handle negotiation: a provider will pick the MFE's native handle when the
   * host framework matches. The in-tree native path is DEFERRED (ADR-056), so
   * today every adaptor composes via the guaranteed imperative floor regardless
   * of this value — it is carried, not yet acted on.
   */
  hostFramework?: string;
  /**
   * Host-injected provider values (theme, locale, auth claims, router state, …)
   * that cross the waist as DATA (ADR-060 value-injection). The MFE island
   * re-provides its own context from these — context reaches the MFE without a
   * shared reconciler, so isolation, polyglot, and multi-version React all hold.
   */
  providerValues?: Record<string, unknown>;
  /**
   * Report an unrecovered error from inside the mounted island (ADR-060). The
   * MFE's framework error boundary / lifecycle `error` phase routes here via its
   * `emit` capability. The host renders a slot-scoped fallback and escalates to
   * the control plane; it is slot-isolated and never cascades to siblings.
   */
  reportError(error: unknown, info?: { phase?: string }): void;
}

/** Describes a slot-scoped failure (ADR-060) for fallback + escalation. */
export interface SlotErrorInfo {
  slot: string;
  mfe: string;
  capability: string;
  reason: string;
  phase?: string;
}

export interface ExperienceAdaptor {
  mount(
    experience: RenderedExperience,
    slot: SlotElementLike,
    helpers: AdaptorHelpers
  ): Promise<UnmountFn | void>;
}

// ── Slot fallback (ADR-060) ──────────────────────────────────

/**
 * Default slot-scoped fallback: neutral markup, no framework. Rendered into the
 * failed slot only, so a crashing MFE degrades to a message in its own region
 * instead of cascading. Hosts override via `renderSlotFallback`.
 */
export function defaultRenderSlotFallback(slot: SlotElementLike, info: SlotErrorInfo): void {
  slot.innerHTML =
    `<div role="alert" class="layout-slot__error" data-slot-error="${info.slot}">` +
    `This experience is temporarily unavailable.</div>`;
}

// ── Built-in adaptors ────────────────────────────────────────

/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
export function defaultCreateSlotElement(slotId: string): SlotElementLike {
  const element = document.createElement('section');
  element.className = `layout-slot layout-slot--${slotId}`;
  return element as unknown as SlotElementLike;
}

/** text/html — MFE-owned markup. Elements with data-action send actions. */
/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
export const htmlAdaptor: ExperienceAdaptor = {
  async mount(experience, slot, helpers) {
    slot.innerHTML = String(experience.output ?? '');
    slot.addEventListener('click', (event) => {
      const target = (event as { target?: { closest?: (sel: string) => { dataset: Record<string, string> } | null } }).target;
      const actionEl = target?.closest?.('[data-action]');
      if (!actionEl) return;
      const { action, ...payload } = actionEl.dataset;
      if (action) void helpers.sendAction(action, payload);
    });
    return () => { slot.innerHTML = ''; };
  },
};

/** application/json — generic data view for data-only experiences. */
/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
export const jsonAdaptor: ExperienceAdaptor = {
  async mount(experience, slot) {
    const pre = document.createElement('pre');
    pre.className = 'layout-slot__json';
    pre.textContent = JSON.stringify(experience.output, null, 2);
    slot.appendChild(pre);
    return () => { slot.innerHTML = ''; };
  },
};

// Module Federation runtime globals — present when the shell is built with
// rspack/webpack; guarded at runtime so other hosts degrade gracefully.
declare const __webpack_init_sharing__: ((scope: string) => Promise<void>) | undefined;
declare const __webpack_share_scopes__: { default: unknown } | undefined;

interface MfBootstrapModule {
  mfe: {
    load(context: Record<string, unknown>): Promise<unknown>;
    render(context: Record<string, unknown>): Promise<unknown>;
    unmount?(containerId: string): void;
    destroy?(): Promise<void> | void;
    /** ADR-057: host injects a per-slot daemon channel for updateControlPlaneState. */
    attachControlPlane?(wsClient: DaemonWebSocketClient): void;
  };
  mfeReady?: Promise<unknown>;
}

/** What a remote module may export (ADR-056). Preferred: a presentation
 *  handle bundle or an imperative mount handle. Legacy: the bootstrap pair. */
interface RemoteModuleExports {
  handles?: PresentationHandles;
  mount?: ImperativeMountHandle;
  mfe?: MfBootstrapModule['mfe'];
  mfeReady?: Promise<unknown>;
  default?: RemoteModuleExports;
}

interface MfContainer {
  init(shareScope: unknown): Promise<void>;
  get(module: string): Promise<() => RemoteModuleExports>;
}

/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
async function loadRemoteContainer(remoteEntryUrl: string, scope: string): Promise<MfContainer> {
  const globalScope = globalThis as unknown as Record<string, MfContainer | undefined>;
  if (!globalScope[scope]) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = remoteEntryUrl;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load remoteEntry from ${remoteEntryUrl}`));
      document.head.appendChild(script);
    });
  }
  const container = globalScope[scope];
  if (!container) throw new Error(`Remote container "${scope}" not found after loading ${remoteEntryUrl}`);
  if (typeof __webpack_init_sharing__ === 'function') {
    await __webpack_init_sharing__('default');
  }
  const shareScope = typeof __webpack_share_scopes__ === 'object' && __webpack_share_scopes__
    ? __webpack_share_scopes__.default
    : {};
  await container.init(shareScope);
  return container;
}

/**
 * module-federation — the imperative-island provider (ADR-056). Loads the
 * remote container, then composes via the MFE's **presentation handle**: it
 * consumes the sealed port (`handle.mount(element, props) → unmount`) and
 * owns the slot element and teardown. The MFE no longer decides where it
 * renders. Framework-independent: any remote (React, Angular) that exposes
 * the imperative handle mounts here as an isolated island.
 *
 * Resolution order for what the remote exposes:
 *   1. `handles` (PresentationHandles) — consume `handles.imperative`
 *   2. `mount` (ImperativeMountHandle) — consume it directly
 *   3. legacy `{ mfe, mfeReady }` bootstrap — adapted in place (migration)
 *
 * (The optional native-component handle is consumed by the React in-tree
 * provider, a deferred follow-up — not by this island provider.)
 */
/**
 * One mount at a time per remote scope. Concurrent placements of the SAME
 * remote (the console's keyed berth strip fires one action per berth, six
 * BerthTile experiences arrive together) all render through one shared MFE
 * instance, and the BaseMFE lifecycle gate (ADR-042: render only from
 * 'ready') rejects overlap with "expected ready, got rendering". The
 * per-ADDRESS queues (ADR-066) can't help — each keyed slot is its own
 * address — so the per-INSTANCE critical section lives here. A failed mount
 * must not poison the queue for the next placement.
 */
const scopeMountQueues = new Map<string, Promise<unknown>>();

function enqueueScopeMount<T>(scope: string, task: () => Promise<T>): Promise<T> {
  const tail = scopeMountQueues.get(scope) ?? Promise.resolve();
  const run = tail.then(task, task);
  scopeMountQueues.set(scope, run.then(() => undefined, () => undefined));
  return run;
}

/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
export const moduleFederationAdaptor: ExperienceAdaptor = {
  mount(experience, slot, helpers) {
    const output = experience.output as {
      remoteEntryUrl?: string; scope?: string; module?: string;
      component?: string; props?: Record<string, unknown>;
    };
    if (!output?.remoteEntryUrl || !output.scope || !output.module) {
      return Promise.reject(
        new Error('module-federation experience output requires remoteEntryUrl, scope, and module')
      );
    }
    return enqueueScopeMount(output.scope, () => mountModuleFederation(experience, slot, helpers, output));
  },
};

/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
async function mountModuleFederation(
  experience: RenderedExperience,
  slot: SlotElementLike,
  helpers: AdaptorHelpers,
  output: {
    remoteEntryUrl?: string; scope?: string; module?: string;
    component?: string; props?: Record<string, unknown>;
  }
): Promise<UnmountFn | void> {
    const mountPoint = document.createElement('div');
    mountPoint.id = `layout-mfe-${experience.id}`;
    slot.appendChild(mountPoint);

    const container = await loadRemoteContainer(output.remoteEntryUrl, output.scope);
    const factory = await container.get(output.module);
    const raw = factory();
    const exports: RemoteModuleExports =
      raw.handles || raw.mount || raw.mfe ? raw : raw.default ?? raw;

    // ADR-057: give the composed MFE the host's socket (scoped to this slot) so
    // its updateControlPlaneState platform capability can drive the control
    // plane without opening its own connection.
    if (helpers.channel && typeof exports.mfe?.attachControlPlane === 'function') {
      exports.mfe.attachControlPlane(helpers.channel);
    }

    // provideSlot rides the render props (ADR-058): a layout MFE calls it to
    // contribute its regions as host slots. Offered to every MFE; games ignore it.
    // hostContext rides the render props too (ADR-060 value-injection): the island
    // re-provides its own framework context (theme/locale/auth) from these values.
    const props = {
      ...(output.props ?? {}),
      ...(experience.props ?? {}),
      ...(helpers.providerValues ? { hostContext: helpers.providerValues } : {}),
      ...(helpers.provideSlot ? { provideSlot: helpers.provideSlot } : {}),
    };
    // The registry resolved which capability this experience renders.
    const capability = output.component ?? experience.capability;

    // 1 & 2: the MFE exposes a presentation handle — consume the sealed port,
    // selecting the resolved capability (multi-capability MFEs).
    const handle = exports.handles?.imperative ?? exports.mount;
    if (isImperativeMountHandle(handle)) {
      return handle.mount(mountPoint, { capability, props });
    }

    // 3: legacy bootstrap — adapt the lifecycle in place during migration.
    if (exports.mfe) {
      await exports.mfeReady;
      await exports.mfe.render({
        requestId: `layout-render-${experience.id}`,
        timestamp: new Date(),
        user: helpers.session?.user,
        jwt: helpers.session?.jwt,
        inputs: { component: output.component ?? experience.capability, containerId: mountPoint.id, props },
      });
      return async () => {
        if (exports.mfe?.unmount) {
          exports.mfe.unmount(mountPoint.id);
        } else {
          await exports.mfe?.destroy?.();
        }
        slot.innerHTML = '';
      };
    }

    throw new Error(
      `Remote module "${output.module}" exposes neither a presentation handle ` +
        `(handles/mount, ADR-056) nor a legacy bootstrap ({ mfe, mfeReady })`
    );
}

export function defaultAdaptors(): Record<string, ExperienceAdaptor> {
  return {
    'text/html': htmlAdaptor,
    'application/json': jsonAdaptor,
    'module-federation': moduleFederationAdaptor,
  };
}
