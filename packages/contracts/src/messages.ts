/**
 * Control-plane message protocol — the canonical wire contract between
 * Renderer ⇄ Daemon ⇄ Registry ⇄ MFE (PLATFORM-CONTRACT.md v3.2, ADR-053).
 *
 * This module is the single source of truth for the protocol. The daemon
 * control plane (falese/daemon, `@control-plane/contracts`) re-exports these
 * types; non-TypeScript implementations validate payloads with the runtime
 * guards exported below.
 *
 * Design notes
 * ────────────
 * • The daemon does NOT define component types. What flows down to a renderer
 *   is a `RenderedExperience` — whatever the resolved MFE's `render()`
 *   produced — never a fixed CARD/FORM/NOTIFICATION library.
 * • `contentType` is an open string (same precedent as FrameworkSchema,
 *   ADR-036): unknown delivery mechanisms must be tolerated, not rejected.
 * • ISO-8601 strings for all timestamps so every shape is JSON-serialisable.
 */

import type { HandleKind } from './presentation';
import { randomUUID } from './uuid';

// ── Session / user context ───────────────────────────────────

/** The authenticated principal a session acts as. */
export interface ControlPlaneUser {
  id: string;
  roles?: string[];
  attributes?: Record<string, unknown>;
}

/**
 * Per-session context threaded through every action so the registry can
 * resolve experiences for THIS user, in THIS application, right now.
 * Carried on `ActionRecord.context`; the daemon copies it into the MFE
 * `Context` (user, jwt, requestId) when invoking capabilities.
 */
export interface SessionContext {
  sessionId: string;
  user?: ControlPlaneUser;
  /** Raw JWT, forwarded as the Authorization header on MFE capability calls. */
  jwt?: string;
  /** Host application type: 'web' | 'mobile' | 'desktop' | 'cli' | … (open). */
  application?: string;
  locale?: string;
  attributes?: Record<string, unknown>;
}

// ── Upward flow: actions ─────────────────────────────────────

/**
 * A state change flowing up: Renderer → Daemon → Registry.
 * Covers both user interactions (CLICK, SUBMIT) and MFE-initiated
 * control-plane state updates (`updateControlPlaneState` → STATE_UPDATE
 * with a `stateKey`).
 */
export interface ActionRecord {
  id: string;
  /** Id of the experience (or legacy component) the action targets. */
  componentId: string;
  /** Canonical: CLICK | SUBMIT | STATE_UPDATE. Daemons normalise raw values
   *  (e.g. BUTTON_CLICK → CLICK) before forwarding to the registry. */
  actionType: string;
  data: Record<string, unknown>;
  timestamp: string; // ISO-8601
  /** Set for updateControlPlaneState signals, e.g. 'analysis.complete'. */
  stateKey?: string;
  /** Which MFE emitted the action, when known. */
  mfe?: string;
  /** Who/where this action came from — drives per-user registry resolution. */
  context?: SessionContext;
}

// ── Registry resolution ──────────────────────────────────────

/**
 * The registry's answer to "what should render for this state change?":
 * which MFE, which domain capability, and the props to render it with.
 */
export interface Resolution {
  mfe: string;
  capability: string;
  props: Record<string, unknown>;
}

/**
 * What the registry stores when an MFE registers (via `describe`). Gives the
 * daemon everything it needs to reach the MFE's capability endpoints and
 * gives renderers what they need to mount the presentation layer.
 */
export interface MfeRegistration {
  name: string;
  version: string;
  /** DSL manifest `type`: tool | agent | feature | service | remote | shell | bff. */
  type: string;
  /** Base URL where the daemon reaches the capability endpoints (/render, …). */
  baseUrl: string;
  capabilities: string[];
  /** Default render delivery mechanism, e.g. 'module-federation'. */
  contentType?: string;
  /** For module-federation MFEs: where the renderer fetches remoteEntry. */
  remoteEntryUrl?: string;
  /**
   * For client-side MFEs delivered via module federation: how a layout
   * manager loads and mounts the remote (ADR-055). When present together
   * with `remoteEntryUrl` and `contentType: 'module-federation'`, the daemon
   * synthesizes the RenderedExperience from the registration instead of
   * calling HTTP capability endpoints — the BaseMFE lifecycle runs in the
   * host shell, not server-side.
   */
  moduleFederation?: { scope: string; module: string; component?: string };
  /**
   * Framework the MFE is built with (e.g. 'react', 'angular'). Observability
   * plus native-handle negotiation (ADR-056). Open string (ADR-036).
   */
  framework?: string;
  /**
   * Presentation handle kinds this MFE exposes (ADR-056). Lets a host-side
   * provider negotiate the composition strategy before loading the remote —
   * `imperative-dom` is the guaranteed floor; native kinds are opt-in.
   */
  handleKinds?: HandleKind[];
  manifest?: Record<string, unknown>;
}

// ── Downward flow: rendered experiences ──────────────────────

/** Canonical delivery mechanisms. `contentType` remains an open string. */
export const EXPERIENCE_CONTENT_TYPES = {
  html: 'text/html',
  json: 'application/json',
  moduleFederation: 'module-federation',
} as const;

/**
 * What an MFE's `render()` returned, relayed by the daemon to renderers.
 * The MFE owns the shape of `output` — HTML string, component reference,
 * or structured data — discriminated by `contentType`.
 */
export interface RenderedExperience {
  id: string;
  /** Which MFE produced this experience. */
  mfe: string;
  /** Which domain capability was rendered. */
  capability: string;
  /** MFE-owned output: HTML string, component ref, data payload, … */
  output: unknown;
  /** 'text/html' | 'application/json' | 'module-federation' | … (open). */
  contentType: string;
  /** The resolution props this experience was rendered with. */
  props?: Record<string, unknown>;
  createdAt: string; // ISO-8601
}

/**
 * The `output` shape for `contentType: 'module-federation'` experiences
 * (ADR-055). Gives a layout manager everything needed to load the remote and
 * drive its BaseMFE lifecycle — framework-independent: React and Angular
 * remotes share the same bootstrap contract (`{ mfe, mfeReady }`).
 */
export interface ModuleFederationExperienceOutput {
  /** Where the renderer fetches the remote container, e.g. http://host:3001/remoteEntry.js */
  remoteEntryUrl: string;
  /** Global container name, e.g. 'abc_kids_flappy'. */
  scope: string;
  /** Exposed module to import, e.g. './App' (must export `{ mfe, mfeReady }`). */
  module: string;
  /** Component name passed to mfe.render() inputs. */
  component?: string;
  /** Extra props merged into the render inputs. */
  props?: Record<string, unknown>;
}

/** True when `value` is a module-federation experience output. */
export function isModuleFederationOutput(
  value: unknown
): value is ModuleFederationExperienceOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).remoteEntryUrl === 'string' &&
    typeof (value as Record<string, unknown>).scope === 'string' &&
    typeof (value as Record<string, unknown>).module === 'string'
  );
}

/**
 * The daemon's per-experience state entry: the experience plus every action
 * submitted against it. Payload of a STATE_SNAPSHOT message.
 */
export interface ExperienceState {
  experience: RenderedExperience;
  actions: ActionRecord[];
  lastUpdated: string; // ISO-8601
}

// ── Message envelope ─────────────────────────────────────────

/**
 * Direction of data flow:
 *   COMPONENT = down (Registry → Daemon → Renderer)
 *   ACTION    = up   (Renderer/MFE → Daemon → Registry)
 */
export type MessageDirection = 'COMPONENT' | 'ACTION';

/**
 * Purpose of a message:
 *   COMPONENT_UPDATE — a new/changed RenderedExperience pushed to renderers
 *   STATE_SNAPSHOT   — full ExperienceState for one experience
 *   ACTION_ECHO      — immediate daemon ack of a received action
 *   ACTION           — raw upward action (set by the renderer or MFE)
 *   ACTION_FORWARD   — daemon → registry forwarded action
 */
export type MessageKind =
  | 'COMPONENT_UPDATE'
  | 'STATE_SNAPSHOT'
  | 'ACTION_ECHO'
  | 'ACTION'
  | 'ACTION_FORWARD';

export interface MessageMetadata {
  /** UUID shared by the originating request and every downstream message. */
  correlationId: string;
  /** True once the daemon has processed (not just received) the message. */
  acknowledged: boolean;
  /** Non-null when the daemon or registry rejected or failed to process. */
  error: string | null;
}

/**
 * The wire envelope for every message on the daemon's `messages` GraphQL
 * subscription. `payload` by `kind`:
 *   COMPONENT_UPDATE → RenderedExperience
 *   STATE_SNAPSHOT   → ExperienceState
 *   ACTION_ECHO / ACTION / ACTION_FORWARD → ActionRecord
 */
export interface Message {
  direction: MessageDirection;
  kind: MessageKind;
  payload: RenderedExperience | ActionRecord | ExperienceState;
  metadata: MessageMetadata;
}

// ── MFE-facing result ────────────────────────────────────────

/**
 * What `BaseMFE.updateControlPlaneState()` resolves with. Maps to the
 * ACTION_ECHO metadata the daemon publishes; `resolution` is populated when
 * the registry produced a new resolution synchronously (usually it arrives
 * asynchronously as a COMPONENT_UPDATE instead).
 */
export interface ControlPlaneStateResult {
  acknowledged: boolean;
  correlationId: string;
  error: string | null;
  resolution?: Resolution | null;
}

// ── Configuration ────────────────────────────────────────────

/**
 * Configuration accepted by every daemon implementation. Reconnect constants
 * are exposed so tests can inject small values.
 */
export interface DaemonConfig {
  /** WebSocket URL to the registry. Default: ws://registry:4000/graphql. */
  registryUrl?: string;
  /** Port the daemon's own GraphQL/WebSocket server listens on. Default: 3001. */
  port?: number;
  /** Starting delay (ms) for the first reconnect attempt. Default: 400. */
  reconnectBaseMs?: number;
  /** Maximum reconnect delay (ms). Default: 5000. */
  reconnectMaxMs?: number;
  /** Exponential growth rate per failed attempt. Default: 1.6. */
  reconnectFactor?: number;
  /** Timeout (ms) for a forwarded action mutation. Default: 4000. */
  forwardTimeoutMs?: number;
}

// ── Runtime guards & builders ────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** True when `value` is a registry resolution `{mfe, capability, props}`. */
export function isResolution(value: unknown): value is Resolution {
  return (
    isRecord(value) &&
    typeof value.mfe === 'string' &&
    typeof value.capability === 'string' &&
    isRecord(value.props)
  );
}

/** True when `value` is an MFE-produced `RenderedExperience`. */
export function isRenderedExperience(value: unknown): value is RenderedExperience {
  return (
    isRecord(value) &&
    typeof value.mfe === 'string' &&
    typeof value.capability === 'string' &&
    typeof value.contentType === 'string' &&
    'output' in value
  );
}

/** True when `value` is an upward `ActionRecord`. */
export function isActionRecord(value: unknown): value is ActionRecord {
  return (
    isRecord(value) &&
    typeof value.componentId === 'string' &&
    typeof value.actionType === 'string' &&
    isRecord(value.data)
  );
}

/**
 * Construct a protocol envelope with consistent defaults
 * (acknowledged=false, error=null, generated correlationId).
 */
export function buildMessage(parts: {
  direction: MessageDirection;
  kind: MessageKind;
  payload: Message['payload'];
  correlationId?: string;
  acknowledged?: boolean;
  error?: string | null;
}): Message {
  return {
    direction: parts.direction,
    kind: parts.kind,
    payload: parts.payload,
    metadata: {
      correlationId: parts.correlationId ?? randomUUID(),
      acknowledged: parts.acknowledged ?? false,
      error: parts.error ?? null,
    },
  };
}
