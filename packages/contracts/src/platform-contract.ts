/**
 * The platform contract — the single source, per ADR-080.
 *
 * Two things define what it means to be an MFE on this platform:
 *
 *   1. the ten platform capabilities every MFE exposes (ADR-041), and
 *   2. the six-state lifecycle machine those capabilities move through
 *      (ADR-042).
 *
 * Both were previously re-declared at every site that needed them — the DSL's
 * `PLATFORM_CAPABILITIES`, the runtime's `CAPABILITY_DESCRIPTORS` and
 * `PLATFORM_CAPABILITY_NAMES`, codegen's `platformCapabilities` map, and four
 * inline arrays in the EJS templates. They had already split: four of those
 * sites listed nine capabilities because `updateControlPlaneState` was added
 * to some and not others. This module is the one definition they all read.
 *
 * `docs/PLATFORM-CONTRACT.md` is the prose statement of the same contract;
 * the capability order here follows its reference table.
 *
 * Pure data plus three predicates, and it must stay that way:
 * `@falese/smt-contracts` is zero-dependency by invariant (ADR-061), which is
 * what lets the DSL (zod), the runtime (staged into generated MFEs), and
 * codegen (a build-time package) all depend on it without pulling each other
 * in. Nothing here imports anything.
 */

// =============================================================================
// Lifecycle State Machine (ADR-042)
// =============================================================================

/**
 * The six lifecycle states, in progression order. An MFE starts at
 * `uninitialized` and may end at `destroyed`; `error` is recoverable via
 * `load()`, `destroyed` is not recoverable at all.
 */
export const MFE_LIFECYCLE_STATES = Object.freeze([
  'uninitialized', // created; load() has not been called
  'loading', // load() in progress
  'ready', // loaded and idle — available for render(), query(), …
  'rendering', // render() in progress
  'error', // a capability failed; retry load() or destroy
  'destroyed', // terminal — no further transitions
] as const);

/** One MFE lifecycle state. */
export type MfeLifecycleState = (typeof MFE_LIFECYCLE_STATES)[number];

/** The state every MFE is constructed in. */
export const MFE_LIFECYCLE_INITIAL_STATE: MfeLifecycleState = 'uninitialized';

/** The terminal state. Nothing leaves it — see MFE_LIFECYCLE_TRANSITIONS. */
export const MFE_LIFECYCLE_TERMINAL_STATE: MfeLifecycleState = 'destroyed';

/**
 * The legal edges of the machine: `from → to[]`. A transition not listed here
 * is a programming error and throws at the boundary rather than corrupting
 * MFE state silently (ADR-042).
 */
export const MFE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<MfeLifecycleState, readonly MfeLifecycleState[]>
> = Object.freeze({
  uninitialized: Object.freeze(['loading'] as const),
  loading: Object.freeze(['ready', 'error'] as const),
  ready: Object.freeze(['loading', 'rendering', 'destroyed'] as const),
  rendering: Object.freeze(['ready', 'error'] as const),
  error: Object.freeze(['loading', 'destroyed'] as const),
  destroyed: Object.freeze([] as const),
});

/** Narrow an arbitrary string to a lifecycle state. */
export function isMfeLifecycleState(value: string): value is MfeLifecycleState {
  return (MFE_LIFECYCLE_STATES as readonly string[]).includes(value);
}

/** Whether `from → to` is an edge of the machine. */
export function isValidLifecycleTransition(
  from: MfeLifecycleState,
  to: MfeLifecycleState
): boolean {
  return MFE_LIFECYCLE_TRANSITIONS[from].includes(to);
}

// =============================================================================
// The Ten Platform Capabilities (ADR-041)
// =============================================================================

/**
 * The ten platform capabilities, ordered as in the
 * `docs/PLATFORM-CONTRACT.md` reference table. Anything a manifest declares
 * that is not in this list is a *domain* capability.
 */
export const PLATFORM_CAPABILITIES = Object.freeze([
  'describe',
  'load',
  'render',
  'refresh',
  'emit',
  'query',
  'schema',
  'authorizeAccess',
  'health',
  'updateControlPlaneState',
] as const);

/** One platform capability name, in the camelCase spelling used in code. */
export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

/**
 * Everything the platform knows about one capability, in one place: how it is
 * spelled in a manifest, what it is called in code, what it returns, what the
 * daemon calls over HTTP, and how it moves the lifecycle machine.
 */
export interface PlatformCapabilitySpec {
  /** Canonical camelCase name — the orchestrator method on `BaseMFE`. */
  readonly name: PlatformCapability;
  /**
   * PascalCase spelling used as a capability entry key in `mfe-manifest.yaml`.
   * Manifests are accepted in either spelling; see
   * PLATFORM_CAPABILITY_MANIFEST_KEYS.
   */
  readonly manifestKey: string;
  /**
   * The `do*()` method a concrete MFE implements. `BaseMFE` orchestrates
   * (guards, phases, telemetry) and delegates the domain work here — which is
   * also why these names are forbidden as lifecycle handler references.
   */
  readonly wrapperMethod: string;
  /** Return type of the orchestrator, as a TypeScript type name. */
  readonly resultType: string;
  /** HTTP verb the daemon or registry uses to invoke it. */
  readonly httpMethod: 'GET' | 'POST';
  /** Path it is served on. */
  readonly endpoint: string;
  /** Human-readable purpose — sourced from docs/PLATFORM-CONTRACT.md. */
  readonly description: string;
  /**
   * States the capability may be invoked from. Empty means any state,
   * including `destroyed` — only `emit` is that permissive.
   */
  readonly preStates: readonly MfeLifecycleState[];
  /** State entered before execution, e.g. `load` → `loading`. */
  readonly enterState?: MfeLifecycleState;
  /** State entered on success. */
  readonly exitState?: MfeLifecycleState;
  /** State entered on failure. */
  readonly errorState?: MfeLifecycleState;
}

/** Any state except `destroyed` — read-only capabilities run everywhere else. */
const ANY_LIVE_STATE = Object.freeze([
  'uninitialized',
  'loading',
  'ready',
  'rendering',
  'error',
] as const);

const READY_ONLY = Object.freeze(['ready'] as const);

export const PLATFORM_CAPABILITY_SPECS: Readonly<
  Record<PlatformCapability, PlatformCapabilitySpec>
> = Object.freeze({
  describe: Object.freeze({
    name: 'describe',
    manifestKey: 'Describe',
    wrapperMethod: 'doDescribe',
    resultType: 'DescribeResult',
    httpMethod: 'GET',
    endpoint: '/describe',
    description: 'Self-registration — returns the MFE manifest and capabilities.',
    preStates: ANY_LIVE_STATE,
  }),
  load: Object.freeze({
    name: 'load',
    manifestKey: 'Load',
    wrapperMethod: 'doLoad',
    resultType: 'LoadResult',
    httpMethod: 'POST',
    endpoint: '/load',
    description: 'Initialization — connect, warm caches, validate config.',
    preStates: Object.freeze(['uninitialized', 'ready', 'error'] as const),
    enterState: 'loading',
    exitState: 'ready',
    errorState: 'error',
  }),
  render: Object.freeze({
    name: 'render',
    manifestKey: 'Render',
    wrapperMethod: 'doRender',
    resultType: 'RenderResult',
    httpMethod: 'POST',
    endpoint: '/render',
    description: 'The MFE produces its own experience for a resolved capability.',
    preStates: READY_ONLY,
    enterState: 'rendering',
    exitState: 'ready',
    errorState: 'error',
  }),
  refresh: Object.freeze({
    name: 'refresh',
    manifestKey: 'Refresh',
    wrapperMethod: 'doRefresh',
    resultType: 'void',
    httpMethod: 'POST',
    endpoint: '/refresh',
    description: 'Data reload in place when state changes but this MFE stays selected.',
    preStates: READY_ONLY,
  }),
  emit: Object.freeze({
    name: 'emit',
    manifestKey: 'Emit',
    wrapperMethod: 'doEmit',
    resultType: 'EmitResult',
    httpMethod: 'POST',
    endpoint: '/emit',
    description: 'Telemetry publication. Does not trigger registry re-evaluation.',
    // Telemetry must survive teardown: an MFE reports what happened even as it
    // is being destroyed, so emit alone is legal from every state.
    preStates: Object.freeze([] as const),
  }),
  query: Object.freeze({
    name: 'query',
    manifestKey: 'Query',
    wrapperMethod: 'doQuery',
    resultType: 'QueryResult',
    httpMethod: 'POST',
    endpoint: '/query',
    description: 'Execute a GraphQL query against this MFE without rendering.',
    preStates: READY_ONLY,
  }),
  schema: Object.freeze({
    name: 'schema',
    manifestKey: 'Schema',
    wrapperMethod: 'doSchema',
    resultType: 'SchemaResult',
    httpMethod: 'GET',
    endpoint: '/schema',
    description: 'GraphQL SDL introspection for registry schema federation.',
    preStates: READY_ONLY,
  }),
  authorizeAccess: Object.freeze({
    name: 'authorizeAccess',
    manifestKey: 'AuthorizeAccess',
    wrapperMethod: 'doAuthorizeAccess',
    resultType: 'boolean',
    httpMethod: 'POST',
    endpoint: '/authorize',
    description: 'JWT validation — the gate check the daemon runs before render().',
    preStates: READY_ONLY,
  }),
  health: Object.freeze({
    name: 'health',
    manifestKey: 'Health',
    wrapperMethod: 'doHealth',
    resultType: 'HealthResult',
    httpMethod: 'GET',
    endpoint: '/health',
    description: 'Liveness and dependency checks for registry polling.',
    preStates: ANY_LIVE_STATE,
  }),
  updateControlPlaneState: Object.freeze({
    name: 'updateControlPlaneState',
    manifestKey: 'UpdateControlPlaneState',
    wrapperMethod: 'doUpdateControlPlaneState',
    resultType: 'ControlPlaneStateResult',
    httpMethod: 'POST',
    endpoint: '/state',
    description: 'MFE-initiated push of domain state for registry re-evaluation.',
    // Legal mid-render: an MFE may push state while its own render is running.
    preStates: Object.freeze(['ready', 'rendering'] as const),
  }),
});

/**
 * The `do*()` wrapper methods. A lifecycle hook may not reference one of these
 * as its handler — that would re-enter the orchestrator it is running inside.
 */
export const PLATFORM_WRAPPER_METHODS: readonly string[] = Object.freeze(
  PLATFORM_CAPABILITIES.map((name) => PLATFORM_CAPABILITY_SPECS[name].wrapperMethod)
);

/**
 * Every spelling a manifest may use as a platform capability entry key — both
 * the camelCase name and the PascalCase manifest key. Consumers that classify
 * manifest entries as platform vs domain match against this, not against
 * PLATFORM_CAPABILITIES alone.
 */
export const PLATFORM_CAPABILITY_MANIFEST_KEYS: readonly string[] = Object.freeze([
  ...PLATFORM_CAPABILITIES,
  ...PLATFORM_CAPABILITIES.map((name) => PLATFORM_CAPABILITY_SPECS[name].manifestKey),
]);

/** Narrow an arbitrary string to the camelCase name of a platform capability. */
export function isPlatformCapability(value: string): value is PlatformCapability {
  return (PLATFORM_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Whether a manifest capability entry key names a platform capability in
 * either spelling. False means the entry is a domain capability.
 */
export function isPlatformCapabilityManifestKey(value: string): boolean {
  return PLATFORM_CAPABILITY_MANIFEST_KEYS.includes(value);
}
