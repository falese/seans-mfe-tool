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
} from '@seans-mfe/contracts';
import { isImperativeMountHandle } from '@seans-mfe/contracts';

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
  /** The session this experience was rendered for, when known. */
  session?: SessionContext;
  /**
   * The host's framework (e.g. 'react'), when known. Used by handle
   * negotiation (ADR-056): a module-federation provider picks the MFE's
   * native handle when the host framework matches, else the imperative floor.
   */
  hostFramework?: string;
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

export interface DaemonEnvelope {
  direction?: string;
  kind?: string;
  payload?: {
    id?: string;
    type?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  };
  metadata?: { correlationId?: string; error?: string | null };
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
  /** Status callback for shell chrome (connection indicator etc.). */
  onStatus?: (status: TransportStatus) => void;
  /** Error callback (adaptor mount failures, resolution errors). */
  onError?: (message: string) => void;
}

interface ActiveSlot {
  element: SlotElementLike;
  experienceId?: string;
  unmount?: UnmountFn;
}

export class LayoutManager {
  private readonly slots = new Map<string, ActiveSlot>();
  private readonly adaptors: Record<string, ExperienceAdaptor>;

  constructor(private readonly config: LayoutManagerConfig) {
    this.adaptors = { ...defaultAdaptors(), ...(config.adaptors ?? {}) };
  }

  /** Connect to the daemon. The layout stays empty until experiences arrive. */
  start(): void {
    this.config.transport.start(
      (envelope) => void this.handleEnvelope(envelope),
      this.config.onStatus
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

    const helpers: AdaptorHelpers = {
      session: this.config.session,
      hostFramework: this.config.hostFramework,
      sendAction: (actionType, data) => this.sendAction(experience.id, actionType, data),
    };

    try {
      const unmount = await adaptor.mount(experience, slot.element, helpers);
      if (unmount) slot.unmount = unmount;
    } catch (error) {
      this.config.onError?.(
        `Failed to mount ${experience.mfe}.${experience.capability} in slot "${slotId}": ` +
        (error instanceof Error ? error.message : String(error))
      );
    }
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

  private async clearSlot(slotId: string): Promise<void> {
    const slot = this.slots.get(slotId);
    if (!slot) return;
    try {
      await slot.unmount?.();
    } finally {
      slot.unmount = undefined;
      slot.experienceId = undefined;
      slot.element.innerHTML = '';
    }
  }
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
    const props = { ...(output.props ?? {}), ...(experience.props ?? {}) };
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
