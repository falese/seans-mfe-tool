/**
 * LayoutManager — daemon-driven slot composition for any host shell (ADR-055).
 *
 * A shell that hosts a LayoutManager is 100% generic and starts empty: it
 * renders nothing until the daemon control plane publishes EXPERIENCE
 * components (PLATFORM-CONTRACT v3.2 / ADR-054). Each experience is routed to
 * a layout slot (`experience.props.slot`, default 'main') and mounted by the
 * adaptor registered for its `contentType`:
 *
 *   module-federation → loads the remote container (React, Angular, anything
 *                       that ships the BaseMFE bootstrap `{ mfe, mfeReady }`)
 *                       and drives load()/render() — framework-independent
 *                       because the lifecycle contract is (ADR-041)
 *   text/html         → MFE-owned markup with data-action delegation
 *   application/json  → generic data view
 *
 * Adaptors are pluggable: register one per contentType to support new
 * delivery mechanisms without touching the manager or the shell.
 *
 * The manager is deliberately framework-free (no React/Angular imports) and
 * DOM-light: hosts and slot elements are typed structurally so the routing
 * logic is unit-testable without a browser.
 */

import type {
  ImperativeMountHandle,
  PresentationHandles,
  RenderedExperience,
  SessionContext,
} from './contracts';
// Sourced from the inlined ./contracts (not @seans-mfe/contracts): the guard is
// a *value*, so importing it from the external package would emit a
// require("@seans-mfe/contracts") the MFE bundler can't resolve once the
// runtime is staged without that package (see ./contracts header).
import { isImperativeMountHandle } from './contracts';
import { DaemonChannel } from './daemon-channel';
import type { DaemonWebSocketClient } from './graphql-ws-client';

// ── Structural element types (testable without a DOM) ────────

export interface SlotElementLike {
  innerHTML: string;
  appendChild(child: unknown): unknown;
  remove(): void;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

export interface LayoutHostLike {
  appendChild(child: unknown): unknown;
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
  provideSlot?(slotId: string, element: SlotElementLike): void;
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

// ── Daemon transport (graphql-transport-ws) ──────────────────

export interface DaemonTransport {
  /** Open the `messages` subscription; deliver each envelope to onMessage. */
  start(onMessage: (envelope: DaemonEnvelope) => void, onStatus?: (s: TransportStatus) => void): void;
  stop(): void;
  /** Fire the sendMessage mutation with a JSON-encoded envelope. */
  send(envelope: Record<string, unknown>): Promise<void>;
}

export type TransportStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * The transport envelope delivered on the daemon's `messages` subscription.
 *
 * This is NOT the logical `Message` (ADR-054). The downward payload is wrapped
 * in a component envelope: `kind: 'COMPONENT_UPDATE'` with `payload.type`
 * (`'EXPERIENCE' | 'RESOLUTION_ERROR'`) discriminating the envelope and
 * `payload.data` carrying the ADR-054 `RenderedExperience`. The `type`
 * discriminator is an envelope tag, not a revived CARD/FORM/NOTIFICATION
 * component type (ADR-054 "Wire envelope vs logical message").
 */
export interface DaemonEnvelope {
  direction?: string;
  kind?: string;
  payload?: {
    id?: string;
    type?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  };
  metadata?: { correlationId?: string; acknowledged?: boolean; error?: string | null };
}

/** Minimal WebSocket surface so tests can inject a fake socket factory. */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((err: unknown) => void) | null;
}

const RECONNECT_BASE_MS = 400;
const RECONNECT_MAX_MS = 5_000;
const RECONNECT_FACTOR = 1.6;

/**
 * Self-contained graphql-transport-ws client for the daemon's `messages`
 * subscription and `sendMessage` mutation, with bounded-backoff reconnect.
 */
export class GraphQLTransportWsDaemonTransport implements DaemonTransport {
  private socket: WebSocketLike | null = null;
  private stopped = false;
  private attempt = 0;
  private acked = false;

  constructor(
    private readonly url: string,
    private readonly createSocket: (url: string, protocol: string) => WebSocketLike
  ) {}

  start(onMessage: (envelope: DaemonEnvelope) => void, onStatus?: (s: TransportStatus) => void): void {
    this.stopped = false;
    const connect = (): void => {
      if (this.stopped) return;
      onStatus?.('connecting');
      const socket = this.createSocket(this.url, 'graphql-transport-ws');
      this.socket = socket;
      this.acked = false;

      socket.onopen = () => socket.send(JSON.stringify({ type: 'connection_init' }));
      socket.onmessage = (event) => {
        let frame: { type?: string; payload?: { data?: { messages?: DaemonEnvelope } } };
        try {
          frame = JSON.parse(event.data) as typeof frame;
        } catch {
          return;
        }
        if (frame.type === 'connection_ack') {
          this.acked = true;
          this.attempt = 0;
          onStatus?.('connected');
          socket.send(JSON.stringify({
            id: 'layout-sub',
            type: 'subscribe',
            payload: { query: 'subscription { messages { direction kind payload metadata { correlationId acknowledged error } } }' },
          }));
        } else if (frame.type === 'next' && frame.payload?.data?.messages) {
          onMessage(frame.payload.data.messages);
        } else if (frame.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      };
      socket.onclose = () => {
        onStatus?.('disconnected');
        if (this.stopped) return;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(RECONNECT_FACTOR, this.attempt++));
        setTimeout(connect, delay);
      };
      socket.onerror = () => { /* onclose drives the reconnect */ };
    };
    connect();
  }

  stop(): void {
    this.stopped = true;
    this.socket?.close();
    this.socket = null;
  }

  async send(envelope: Record<string, unknown>): Promise<void> {
    if (!this.socket || !this.acked) {
      throw new Error('LayoutManager: daemon transport is not connected');
    }
    this.socket.send(JSON.stringify({
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'subscribe',
      payload: {
        query: 'mutation($message: String!) { sendMessage(message: $message) }',
        variables: { message: JSON.stringify(envelope) },
      },
    }));
  }
}

// ── LayoutManager ────────────────────────────────────────────

export interface LayoutManagerConfig {
  /** Where experiences are mounted. The manager creates one child per slot. */
  container: LayoutHostLike;
  transport: DaemonTransport;
  /** Threaded onto every action so the registry resolves per user/app. */
  session?: SessionContext;
  /**
   * The host's framework (e.g. 'react'). Passed to adaptors for handle
   * negotiation (ADR-056). Absent for a framework-free host — every MFE then
   * composes via its guaranteed imperative handle (isolation).
   */
  hostFramework?: string;
  /** contentType → adaptor (the provider registry, keyed by handle kind).
   *  Merged over the built-in defaults. */
  adaptors?: Record<string, ExperienceAdaptor>;
  /** Slot element factory — defaults to document.createElement('section'). */
  createSlotElement?: (slotId: string) => SlotElementLike;
  /**
   * Host-injected provider values delivered to every mounted MFE as
   * `props.hostContext` (ADR-060 value-injection). The island re-provides its
   * own framework context from these.
   */
  providerValues?: Record<string, unknown>;
  /**
   * Render the slot-scoped fallback shown when an experience fails (ADR-060).
   * Defaults to neutral inline markup; override for branded fallbacks.
   */
  renderSlotFallback?: (slot: SlotElementLike, info: SlotErrorInfo) => void;
  /** Status callback for shell chrome (connection indicator etc.). */
  onStatus?: (status: TransportStatus) => void;
  /** Error callback (adaptor mount failures, resolution errors, slot errors). */
  onError?: (message: string) => void;
}

interface ActiveSlot {
  element: SlotElementLike;
  experienceId?: string;
  unmount?: UnmountFn;
  /** This slot's element was contributed by an MFE via provideSlot (ADR-058). */
  provided?: boolean;
  /** Slot ids this slot's MFE provided — released when this slot clears (ADR-058). */
  providedSlotIds?: string[];
  /** Consecutive unrecovered failures escalated to the control plane (ADR-060).
   *  Reset to 0 on a successful mount; capped to avoid re-resolution storms. */
  escalations?: number;
}

/** Cap on consecutive control-plane re-resolution signals per slot (ADR-060). */
const MAX_SLOT_ESCALATIONS = 3;

export class LayoutManager {
  private readonly slots = new Map<string, ActiveSlot>();
  private readonly adaptors: Record<string, ExperienceAdaptor>;
  /** Latest transport status — backs the per-slot channels' `connected` (ADR-057). */
  private currentStatus: TransportStatus = 'connecting';

  constructor(private readonly config: LayoutManagerConfig) {
    this.adaptors = { ...defaultAdaptors(), ...(config.adaptors ?? {}) };
  }

  /** Connect to the daemon. The layout stays empty until experiences arrive. */
  start(): void {
    this.config.transport.start(
      (envelope) => void this.handleEnvelope(envelope),
      (status) => {
        this.currentStatus = status;
        this.config.onStatus?.(status);
      }
    );
  }

  async stop(): Promise<void> {
    this.config.transport.stop();
    for (const [slotId] of this.slots) await this.clearSlot(slotId);
  }

  /** Slot ids currently mounted (mainly for tests and shell debugging). */
  get activeSlots(): string[] {
    return Array.from(this.slots.keys());
  }

  private async handleEnvelope(envelope: DaemonEnvelope): Promise<void> {
    if (envelope.kind !== 'COMPONENT_UPDATE' || !envelope.payload) return;
    const component = envelope.payload;

    if (component.type === 'RESOLUTION_ERROR') {
      const data = (component.data ?? {}) as { mfe?: string; capability?: string; reason?: string };
      this.config.onError?.(`MFE resolution failed: ${data.mfe ?? '?'}.${data.capability ?? '?'}: ${data.reason ?? 'unknown'}`);
      return;
    }
    if (component.type !== 'EXPERIENCE' || !component.data) return;

    const experience = component.data as unknown as RenderedExperience;
    await this.mountExperience(experience);
  }

  private async mountExperience(experience: RenderedExperience): Promise<void> {
    const slotId = typeof experience.props?.slot === 'string' ? experience.props.slot : 'main';
    const adaptor = this.adaptors[experience.contentType];
    if (!adaptor) {
      this.config.onError?.(`No adaptor registered for contentType "${experience.contentType}"`);
      return;
    }

    await this.clearSlot(slotId);
    const slot = this.ensureSlot(slotId);
    slot.experienceId = experience.id;
    // Generic Suspense floor: mark the slot pending until the lifecycle settles
    // (ADR-060). Host chrome can render a skeleton on [data-slot-state=pending].
    slot.element.setAttribute('data-slot-state', 'pending');

    const helpers: AdaptorHelpers = {
      session: this.config.session,
      hostFramework: this.config.hostFramework,
      // Host context crosses the waist as DATA (ADR-060 value-injection); the
      // island re-provides its own framework context from these values.
      providerValues: this.config.providerValues,
      sendAction: (actionType, data) => this.sendAction(experience.id, actionType, data),
      // Neutral sink for post-mount island errors (ADR-060); the MFE routes here
      // via its emit/error phase. Slot-isolated: fallback here, never cascade.
      reportError: (error, info) => void this.handleSlotError(slotId, experience, error, info?.phase),
      // One virtual channel per slot over the host's single socket (ADR-057).
      channel: new DaemonChannel(
        this.config.transport,
        slotId,
        () => this.currentStatus === 'connected'
      ),
      // The MFE may contribute named slots to the host layout (ADR-058); track
      // them on this slot so they are released when this experience clears.
      provideSlot: (childId, element) => {
        this.registerProvidedSlot(childId, element);
        (slot.providedSlotIds ??= []).push(childId);
      },
    };

    try {
      const unmount = await adaptor.mount(experience, slot.element, helpers);
      if (unmount) slot.unmount = unmount;
      slot.element.setAttribute('data-slot-state', 'ready');
      slot.escalations = 0; // a healthy mount re-arms escalation for this slot
    } catch (error) {
      await this.handleSlotError(slotId, experience, error, 'mount');
    }
  }

  /**
   * Slot-scoped failure handling (ADR-060). Tears down only this slot's mount,
   * renders a neutral fallback into it (no cascade — siblings untouched), and
   * escalates to the control plane (the "bigger door") so the registry can
   * re-resolve the slot to an alternate MFE. Escalation is capped per slot.
   */
  private async handleSlotError(
    slotId: string,
    experience: RenderedExperience,
    error: unknown,
    phase?: string
  ): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);
    const info: SlotErrorInfo = { slot: slotId, mfe: experience.mfe, capability: experience.capability, reason, phase };

    const slot = this.slots.get(slotId);
    if (slot) {
      try {
        await slot.unmount?.();
      } catch {
        /* best-effort teardown of the failed island */
      }
      slot.unmount = undefined;
      slot.element.innerHTML = '';
      (this.config.renderSlotFallback ?? defaultRenderSlotFallback)(slot.element, info);
      slot.element.setAttribute('data-slot-state', 'error');
      slot.escalations = (slot.escalations ?? 0) + 1;
    }

    this.config.onError?.(
      `Slot "${slotId}" failed: ${info.mfe}.${info.capability}` +
      (phase ? ` (${phase})` : '') + `: ${reason}`
    );

    // Bigger door: let the registry re-resolve this slot, bounded so a slot that
    // keeps failing settles on its fallback instead of storming the daemon.
    if (!slot || (slot.escalations ?? 0) <= MAX_SLOT_ESCALATIONS) {
      await this.signalSlotError(experience.id, info);
    }
  }

  /** Emit a SLOT_ERROR action up the control plane for re-resolution (ADR-060). */
  private async signalSlotError(componentId: string, info: SlotErrorInfo): Promise<void> {
    const action: Record<string, unknown> = {
      id: `slot-err-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      componentId,
      actionType: 'SLOT_ERROR',
      stateKey: 'slot.error',
      data: { slot: info.slot, mfe: info.mfe, capability: info.capability, reason: info.reason, phase: info.phase },
      timestamp: new Date().toISOString(),
    };
    if (this.config.session) action.context = this.config.session;
    await this.config.transport.send({
      direction: 'ACTION',
      kind: 'ACTION',
      payload: action,
      metadata: { correlationId: String(action.id), acknowledged: false, error: info.reason },
    });
  }

  /** Send an action up the control plane, carrying the session context. */
  async sendAction(componentId: string, actionType: string, data: Record<string, unknown>): Promise<void> {
    const action: Record<string, unknown> = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      componentId,
      actionType,
      data,
      timestamp: new Date().toISOString(),
    };
    if (this.config.session) action.context = this.config.session;
    await this.config.transport.send({
      direction: 'ACTION',
      kind: 'ACTION',
      payload: action,
      metadata: { correlationId: String(action.id), acknowledged: false, error: null },
    });
  }

  private ensureSlot(slotId: string): ActiveSlot {
    const existing = this.slots.get(slotId);
    if (existing) return existing;
    const element = (this.config.createSlotElement ?? defaultCreateSlotElement)(slotId);
    element.setAttribute('data-layout-slot', slotId);
    this.config.container.appendChild(element);
    const slot: ActiveSlot = { element };
    this.slots.set(slotId, slot);
    return slot;
  }

  /**
   * Register an MFE-contributed element as a host slot (ADR-058). The element
   * already lives in the providing MFE's DOM, so — unlike ensureSlot — we do
   * not create or append one; we just route into it. Last writer wins.
   */
  private registerProvidedSlot(slotId: string, element: SlotElementLike): void {
    void this.clearSlot(slotId);
    this.slots.set(slotId, { element, provided: true });
  }

  private async clearSlot(slotId: string): Promise<void> {
    const slot = this.slots.get(slotId);
    if (!slot) return;

    // Release any slots this experience contributed (ADR-058) before tearing it
    // down, so the host stops routing into elements that are about to vanish.
    if (slot.providedSlotIds) {
      for (const childId of slot.providedSlotIds) {
        const child = this.slots.get(childId);
        if (child) {
          try {
            await child.unmount?.();
          } catch {
            /* best-effort release */
          }
          this.slots.delete(childId);
        }
      }
      slot.providedSlotIds = undefined;
    }

    try {
      await slot.unmount?.();
    } finally {
      slot.unmount = undefined;
      slot.experienceId = undefined;
      // A provided element belongs to its MFE's DOM; clearing its contents is
      // enough (and the entry is deleted by the provider's release above).
      slot.element.innerHTML = '';
    }
  }
}

// ── Slot fallback (ADR-060) ──────────────────────────────────

/**
 * Default slot-scoped fallback: neutral markup, no framework. Rendered into the
 * failed slot only, so a crashing MFE degrades to a message in its own region
 * instead of cascading. Hosts override via `renderSlotFallback`.
 */
function defaultRenderSlotFallback(slot: SlotElementLike, info: SlotErrorInfo): void {
  slot.innerHTML =
    `<div role="alert" class="layout-slot__error" data-slot-error="${info.slot}">` +
    `This experience is temporarily unavailable.</div>`;
}

// ── Built-in adaptors ────────────────────────────────────────

/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
function defaultCreateSlotElement(slotId: string): SlotElementLike {
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
/* istanbul ignore next -- browser-only DOM glue; integration-covered by the shell's jsdom suite (App.test.tsx), untestable under jest's node environment */
export const moduleFederationAdaptor: ExperienceAdaptor = {
  async mount(experience, slot, helpers) {
    const output = experience.output as {
      remoteEntryUrl?: string; scope?: string; module?: string;
      component?: string; props?: Record<string, unknown>;
    };
    if (!output?.remoteEntryUrl || !output.scope || !output.module) {
      throw new Error('module-federation experience output requires remoteEntryUrl, scope, and module');
    }

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
        await exports.mfe?.destroy?.();
        slot.innerHTML = '';
      };
    }

    throw new Error(
      `Remote module "${output.module}" exposes neither a presentation handle ` +
        `(handles/mount, ADR-056) nor a legacy bootstrap ({ mfe, mfeReady })`
    );
  },
};

function defaultAdaptors(): Record<string, ExperienceAdaptor> {
  return {
    'text/html': htmlAdaptor,
    'application/json': jsonAdaptor,
    'module-federation': moduleFederationAdaptor,
  };
}
