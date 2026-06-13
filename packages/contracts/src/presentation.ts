/**
 * Presentation handle — the framework-neutral half of the thin waist (ADR-056).
 *
 * This is what crosses the boundary on the presentation axis: a host-side
 * Framework Provider *consumes* it; the MFE side (BaseMFE via its
 * framework-specialized abstract) *exposes* it. The core defines only the
 * shape of the port — never how any framework mounts. Framework knowledge is
 * quarantined in providers; this module imports nothing framework-specific
 * and assumes no DOM lib (the mount target is structural).
 *
 * Two kinds of handle, mapping to the isolation-vs-integration choice:
 *   • imperative-dom  — the GUARANTEED floor every client MFE exposes. The
 *     host hands it an element; it mounts an isolated island and returns its
 *     own teardown. Always available, always polyglot.
 *   • native component — OPTIONAL. A framework-tagged, otherwise-opaque
 *     artifact a matching-framework provider may compose in-tree (single
 *     root, shared context), accepting framework-singleton coupling.
 */

/** How an MFE can be presented across the waist. Open string (ADR-036). */
export type HandleKind = 'imperative-dom' | 'react-component' | 'web-component' | string;

/** Teardown returned by an imperative mount; idempotent by contract. */
export type ImperativeUnmount = () => void | Promise<void>;

/**
 * The host-owned element an imperative handle mounts into. Structural so the
 * neutral contract needs no DOM lib; the provider and the MFE's mount
 * implementation cast to their concrete element type (e.g. HTMLElement).
 */
export interface MountElement {
  appendChild(child: unknown): unknown;
}

/** Imperative mount: element + props in, teardown out. */
export type ImperativeMount = (
  element: MountElement,
  props?: Record<string, unknown>
) => ImperativeUnmount | Promise<ImperativeUnmount>;

/**
 * The universal, guaranteed port. Every client MFE exposes exactly one.
 * `framework` is observability/negotiation metadata only — the host never
 * needs it to invoke `mount` (that is the whole point of the floor).
 */
export interface ImperativeMountHandle {
  kind: 'imperative-dom';
  framework?: string;
  mount: ImperativeMount;
}

/**
 * An opt-in, framework-native artifact. `component` is opaque to the core —
 * only a Framework Provider for `framework` knows its shape (e.g. a React
 * component). Tagging, never inspection, is what keeps the core neutral.
 */
export interface NativeComponentHandle {
  /** Anything but 'imperative-dom', e.g. 'react-component'. */
  kind: Exclude<HandleKind, 'imperative-dom'>;
  framework: string;
  component: unknown;
}

export type PresentationHandle = ImperativeMountHandle | NativeComponentHandle;

/**
 * The bundle an MFE exposes across the waist. The imperative floor is
 * mandatory; native handles are optional integration upgrades.
 */
export interface PresentationHandles {
  imperative: ImperativeMountHandle;
  native?: NativeComponentHandle[];
}

// ── Guards ───────────────────────────────────────────────────

export function isImperativeMountHandle(value: unknown): value is ImperativeMountHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'imperative-dom' &&
    typeof (value as { mount?: unknown }).mount === 'function'
  );
}

export function isNativeComponentHandle(value: unknown): value is NativeComponentHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind !== 'imperative-dom' &&
    typeof (value as { framework?: unknown }).framework === 'string' &&
    'component' in (value as object)
  );
}

/**
 * Validate a handle bundle at a service/runtime boundary (usable from plain
 * JS providers). Throws if the guaranteed imperative floor is missing —
 * an MFE without it cannot be composed polyglot.
 */
export function assertPresentationHandles(value: unknown): asserts value is PresentationHandles {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('PresentationHandles: expected an object');
  }
  const v = value as Record<string, unknown>;
  if (!isImperativeMountHandle(v.imperative)) {
    throw new TypeError(
      'PresentationHandles: a callable imperative-dom mount handle is required (the polyglot floor)'
    );
  }
  if (v.native !== undefined && !Array.isArray(v.native)) {
    throw new TypeError('PresentationHandles: `native` must be an array of NativeComponentHandle');
  }
}

/**
 * The boundary negotiation primitive: pick the best handle for a host.
 * Returns a matching-framework native handle when one exists (integration),
 * otherwise the imperative floor (isolation). Pure and framework-neutral —
 * the single place the host/MFE framework match is decided.
 */
export function selectHandle(
  handles: PresentationHandles,
  hostFramework?: string
): PresentationHandle {
  if (hostFramework && handles.native) {
    const match = handles.native.find((h) => h.framework === hostFramework);
    if (match) return match;
  }
  return handles.imperative;
}
