// Inlined from @seans-mfe/contracts — avoids external package resolution in
// Docker builds where packages/contracts/dist/ is not present.
//
// The runtime is staged into a generated MFE's node_modules as compiled JS
// (dist/runtime), without @seans-mfe/contracts alongside it (that package is
// not yet npm-published). Any *value* import of @seans-mfe/contracts from a
// barrel-reachable runtime module therefore emits a `require("@seans-mfe/
// contracts")` the MFE bundler cannot resolve. To stay self-contained, the
// barrel-reachable modules (layout-manager, imperative-handle) source the
// shapes and guards they need from here instead.
//
// These mirror @seans-mfe/contracts (ADR-054/056) and must stay STRUCTURALLY
// compatible with it until @seans-mfe/contracts is published and declared a
// real dependency of @seans-mfe-tool/runtime.

export interface MessageMetadata {
  correlationId: string;
  acknowledged: boolean;
  error: string | null;
}

export interface ActionRecord {
  id: string;
  componentId: string;
  actionType: string;
  data: Record<string, unknown>;
  timestamp: string;
  /** Set for updateControlPlaneState signals; registry routes match on it (ADR-057). */
  stateKey?: string;
  /** Which MFE emitted the action, when known. */
  mfe?: string;
  /** Who/where this action came from — drives per-user registry resolution. */
  context?: SessionContext;
}

/**
 * Direction of flow (ADR-054):
 *   COMPONENT = down (Registry → Daemon → Renderer)
 *   ACTION    = up   (Renderer/MFE → Daemon → Registry)
 */
export type MessageDirection = 'COMPONENT' | 'ACTION';

/**
 * Purpose of a message (ADR-054). The drifted `ECHO|SNAPSHOT|RESOLVE` union
 * this mirror once carried was the sketch ADR-054 retired — keep this in lockstep
 * with `@seans-mfe/contracts/messages`.
 */
export type MessageKind =
  | 'COMPONENT_UPDATE'
  | 'STATE_SNAPSHOT'
  | 'ACTION_ECHO'
  | 'ACTION'
  | 'ACTION_FORWARD';

/** Daemon per-experience state; payload of a STATE_SNAPSHOT message (ADR-054). */
export interface ExperienceState {
  experience: RenderedExperience;
  actions: ActionRecord[];
  lastUpdated: string; // ISO-8601
}

/**
 * The canonical logical message envelope (ADR-054). `payload` by `kind`:
 *   COMPONENT_UPDATE → RenderedExperience
 *   STATE_SNAPSHOT   → ExperienceState
 *   ACTION_ECHO / ACTION / ACTION_FORWARD → ActionRecord
 *
 * NB: the daemon's `messages` GraphQL subscription wraps the downward payload in
 * a transport envelope (`{ id, type, data }`, type ∈ EXPERIENCE|RESOLUTION_ERROR)
 * — see `DaemonEnvelope` in layout-manager.ts and ADR-054 "Wire envelope".
 */
export interface Message {
  direction: MessageDirection;
  kind: MessageKind;
  payload: RenderedExperience | ActionRecord | ExperienceState;
  metadata: MessageMetadata;
}

// ── Presentation boundary (ADR-056) ──────────────────────────
// Mirror of @seans-mfe/contracts/presentation.

export type HandleKind = 'imperative-dom' | 'react-component' | 'web-component' | string;

export type ImperativeUnmount = () => void | Promise<void>;

export interface MountElement {
  appendChild(child: unknown): unknown;
}

export interface MountOptions {
  capability?: string;
  props?: Record<string, unknown>;
}

export type ImperativeMount = (
  element: MountElement,
  options?: MountOptions
) => ImperativeUnmount | Promise<ImperativeUnmount>;

export interface ImperativeMountHandle {
  kind: 'imperative-dom';
  framework?: string;
  mount: ImperativeMount;
}

export interface NativeComponentHandle {
  kind: Exclude<HandleKind, 'imperative-dom'>;
  framework: string;
  component: unknown;
}

export type PresentationHandle = ImperativeMountHandle | NativeComponentHandle;

export interface PresentationHandles {
  imperative: ImperativeMountHandle;
  native?: NativeComponentHandle[];
}

export function isImperativeMountHandle(value: unknown): value is ImperativeMountHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'imperative-dom' &&
    typeof (value as { mount?: unknown }).mount === 'function'
  );
}

// ── Control-plane session + experience (ADR-054) ─────────────
// Mirror of the subset of @seans-mfe/contracts/messages the LayoutManager uses.

export interface ControlPlaneUser {
  id: string;
  roles?: string[];
  attributes?: Record<string, unknown>;
}

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
