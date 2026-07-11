/**
 * LayoutManager — daemon-driven slot composition for any host shell (ADR-055).
 *
 * A shell that hosts a LayoutManager is 100% generic and starts empty: it
 * renders nothing until the daemon control plane publishes EXPERIENCE
 * components (PLATFORM-CONTRACT v3.2 / ADR-054). Each experience is routed to
 * a layout slot (`experience.props.slot`, default 'main') and mounted by the
 * adaptor registered for its `contentType` (see layout-adaptors.ts); the
 * daemon connection rides the graphql-transport-ws client in
 * layout-transport.ts.
 *
 * The manager is deliberately framework-free (no React/Angular imports) and
 * DOM-light: hosts and slot elements are typed structurally so the routing
 * logic is unit-testable without a browser.
 */

import { buildMessage } from '@seans-mfe/contracts';
import type { ActionRecord, RenderedExperience, SessionContext } from '@seans-mfe/contracts';
import { DaemonChannel } from './daemon-channel';
import { uuidv4 } from './util/uuid';
import type { DaemonEnvelope, DaemonTransport, TransportStatus } from './layout-transport';
import {
  defaultAdaptors,
  defaultCreateSlotElement,
  defaultRenderSlotFallback,
} from './layout-adaptors';
import { toProvidedSlotAddress } from './slot-contract';
import type {
  AdaptorHelpers,
  ExperienceAdaptor,
  SlotElementLike,
  SlotErrorInfo,
  UnmountFn,
} from './layout-adaptors';

// Compatibility re-exports: these lived in this module before the transport/
// adaptor split; existing imports from './layout-manager' keep working.
export { GraphQLTransportWsDaemonTransport } from './layout-transport';
export type { DaemonEnvelope, DaemonTransport, TransportStatus, WebSocketLike } from './layout-transport';
export { htmlAdaptor, jsonAdaptor, moduleFederationAdaptor } from './layout-adaptors';
export type {
  AdaptorHelpers,
  ExperienceAdaptor,
  SlotElementLike,
  SlotErrorInfo,
  UnmountFn,
} from './layout-adaptors';

// ── Structural host type (testable without a DOM) ────────────

export interface LayoutHostLike {
  appendChild(child: unknown): unknown;
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
  /** Runtime owner token for a provided slot; prevents stale lifecycle cleanup. */
  providerExperienceId?: string;
  /** Scoped addresses this slot's MFE provided — released when this slot clears. */
  providedSlotAddresses?: string[];
  /** Binding state; mirrors the element's data-slot-state. A replayed
   *  experience only skips re-binding when the slot is not in error (ADR-066). */
  state?: 'pending' | 'ready' | 'error';
  /** Consecutive unrecovered failures escalated to the control plane (ADR-060).
   *  Reset to 0 on a successful mount; capped to avoid re-resolution storms. */
  escalations?: number;
}

/** Cap on consecutive control-plane re-resolution signals per slot (ADR-060). */
const MAX_SLOT_ESCALATIONS = 3;

export class LayoutManager {
  private readonly slots = new Map<string, ActiveSlot>();
  /**
   * Desired composition map (ADR-066): what the registry wants at each
   * address, independent of what is currently bound. Binding is deferred —
   * an experience targeting a slot that is provided later re-binds when the
   * provision arrives, so placement never depends on message ordering.
   */
  private readonly desired = new Map<string, RenderedExperience>();
  /** Serializes provide/release callbacks per qualified address. */
  private readonly providedSlotOperations = new Map<string, Promise<void>>();
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
    if (!this.adaptors[experience.contentType]) {
      this.config.onError?.(`No adaptor registered for contentType "${experience.contentType}"`);
      return;
    }

    // Desired-state placement (ADR-066): record the registry's intent for this
    // address before binding, so slot-provision timing can never lose it.
    this.desired.set(slotId, experience);

    // Idempotent replay (ADR-066): the same experience already bound at this
    // address converges without a remount — unless it failed, where a replay
    // is the retry.
    const bound = this.slots.get(slotId);
    if (bound?.experienceId === experience.id && bound.state !== 'error') return;

    await this.bindExperience(slotId, experience);
  }

  /** Bind an experience to whatever element currently backs `slotId`. */
  private async bindExperience(slotId: string, experience: RenderedExperience): Promise<void> {
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
    slot.state = 'pending';
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
        const address = toProvidedSlotAddress(experience.mfe, childId);
        if (element === null) {
          void this.releaseProvidedSlot(address, experience.id);
          return;
        }
        this.registerProvidedSlot(address, element, experience.id);
        const providedAddresses = (slot.providedSlotAddresses ??= []);
        if (!providedAddresses.includes(address)) providedAddresses.push(address);
      },
    };

    try {
      const unmount = await adaptor.mount(experience, slot.element, helpers);
      if (unmount) slot.unmount = unmount;
      slot.state = 'ready';
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
      // Tear the failed island down before rendering the fallback so a stale
      // unmount can't wipe it. Only yield when there is actually something to
      // unmount — a mount that threw never assigned one, and awaiting a no-op
      // would defer the fallback/escalation a microtask past a mount that
      // succeeds (ADR-060: a failing slot degrades in the same tick budget).
      if (slot.unmount) {
        try {
          await slot.unmount();
        } catch {
          /* best-effort teardown of the failed island */
        }
        slot.unmount = undefined;
      }
      slot.element.innerHTML = '';
      (this.config.renderSlotFallback ?? defaultRenderSlotFallback)(slot.element, info);
      slot.state = 'error';
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
    await this.buildAndSendAction(
      componentId,
      'SLOT_ERROR',
      { slot: info.slot, mfe: info.mfe, capability: info.capability, reason: info.reason, phase: info.phase },
      { stateKey: 'slot.error', error: info.reason }
    );
  }

  /** Send an action up the control plane, carrying the session context. */
  async sendAction(componentId: string, actionType: string, data: Record<string, unknown>): Promise<void> {
    await this.buildAndSendAction(componentId, actionType, data);
  }

  /**
   * Shared upward path: build an ActionRecord (session context attached when
   * the shell has one), wrap it in the ADR-054 envelope via the contracts
   * builder, and hand it to the transport.
   */
  private async buildAndSendAction(
    componentId: string,
    actionType: string,
    data: Record<string, unknown>,
    extra?: { stateKey?: string; error?: string }
  ): Promise<void> {
    const action: ActionRecord = {
      id: uuidv4(),
      componentId,
      actionType,
      data,
      timestamp: new Date().toISOString(),
      ...(extra?.stateKey ? { stateKey: extra.stateKey } : {}),
      ...(this.config.session ? { context: this.config.session } : {}),
    };
    const envelope = buildMessage({
      direction: 'ACTION',
      kind: 'ACTION',
      payload: action,
      correlationId: action.id,
      error: extra?.error,
    });
    await this.config.transport.send(envelope as unknown as Record<string, unknown>);
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
   * not create or append one; we just route into it. Different provider MFEs
   * have different qualified addresses; callbacks for the same address are
   * serialized so the latest registration wins even when teardown is async.
   *
   * Provision is a change of where the address is bound, never a teardown of
   * what the registry placed there (ADR-066): an experience already occupying
   * this address — including one mounted into an auto-created placeholder
   * before the provider arrived — re-binds into the new element.
   */
  private registerProvidedSlot(
    address: string,
    element: SlotElementLike,
    providerExperienceId: string
  ): void {
    void this.enqueueProvidedSlotOperation(address, async () => {
      const previous = this.slots.get(address);
      if (
        previous?.provided &&
        previous.providerExperienceId === providerExperienceId &&
        previous.element === element
      ) {
        return;
      }

      if (previous) {
        if (previous.provided && previous.providerExperienceId) {
          await this.releaseProvidedSlotNow(address, previous.providerExperienceId);
        } else {
          await this.clearSlot(address);
          previous.element.remove();
        }
      }
      element.setAttribute('data-layout-slot', address);
      this.slots.set(address, { element, provided: true, providerExperienceId });
      await this.signalSlotTopology(providerExperienceId, 'SLOT_PROVIDED', address);
      if (this.slots.get(address)?.providerExperienceId !== providerExperienceId) return;
      const desired = this.desired.get(address);
      if (desired) await this.bindExperience(address, desired);
    });
  }

  /** Release one provided address only while the requesting instance owns it. */
  private releaseProvidedSlot(
    address: string,
    providerExperienceId: string
  ): Promise<void> {
    return this.enqueueProvidedSlotOperation(
      address,
      () => this.releaseProvidedSlotNow(address, providerExperienceId)
    );
  }

  private async releaseProvidedSlotNow(
    address: string,
    providerExperienceId: string
  ): Promise<void> {
    const child = this.slots.get(address);
    if (!child || child.providerExperienceId !== providerExperienceId) return;

    try {
      if (child.unmount) await child.unmount();
    } catch {
      /* best-effort release */
    }

    if (this.slots.get(address) !== child) return;
    this.slots.delete(address);
    await this.signalSlotTopology(providerExperienceId, 'SLOT_RELEASED', address);
  }

  private enqueueProvidedSlotOperation(
    address: string,
    operation: () => Promise<void>
  ): Promise<void> {
    const previous = this.providedSlotOperations.get(address) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.providedSlotOperations.set(address, current);
    const cleanup = (): void => {
      if (this.providedSlotOperations.get(address) === current) {
        this.providedSlotOperations.delete(address);
      }
    };
    void current.then(cleanup, cleanup);
    return current;
  }

  /**
   * Announce slot topology up the control plane (ADR-066): advisory only —
   * the registry may use it for topology-aware rules and debugging, but
   * placement correctness never depends on it, so delivery is best-effort.
   */
  private async signalSlotTopology(
    componentId: string,
    actionType: 'SLOT_PROVIDED' | 'SLOT_RELEASED',
    slotId: string
  ): Promise<void> {
    try {
      await this.buildAndSendAction(componentId, actionType, { slot: slotId }, { stateKey: 'slot.topology' });
    } catch {
      /* advisory signal on a disconnected transport — drop it */
    }
  }

  private async clearSlot(slotId: string): Promise<void> {
    const slot = this.slots.get(slotId);
    if (!slot) return;

    // Release any slots this experience contributed (ADR-058) before tearing it
    // down, so the host stops routing into elements that are about to vanish.
    // Desired state for released addresses is kept: it re-binds when a new
    // provider registers the id (ADR-066).
    if (slot.providedSlotAddresses) {
      const providerExperienceId = slot.experienceId;
      for (const address of slot.providedSlotAddresses) {
        if (providerExperienceId) await this.releaseProvidedSlot(address, providerExperienceId);
      }
      slot.providedSlotAddresses = undefined;
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
