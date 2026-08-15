/**
 * The project-scoped control-plane composition document (ADR-083).
 *
 * This is what a deploying project authors instead of hand-writing the
 * registry's `rules.json`. It carries the half of composition that is a human
 * decision — which capability appears in which slot, on which state change —
 * and nothing that is derivable from an `mfe-manifest.yaml`.
 *
 * The `registration` half is absent by design: ADR-074 measured all nine of its
 * fields as pure restatements of the manifest, so the compiler derives them
 * (`control-plane-compiler.ts`) rather than asking an author to retype a
 * federation scope.
 *
 * Ownership follows ADR-078: the project owns its composition, the platform
 * owns the engine that evaluates it.
 */

import { z } from 'zod';

/**
 * `{name}` placeholders, as used by `forEach` expansion.
 *
 * Deliberately the same brace syntax as the keyed-slot grammar (ADR-066's
 * `berth.{id}`), because in practice a keyed slot and the loop that fills it
 * are written together and reusing the syntax keeps them looking related.
 */
export const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/** A namespace segment: letters, digits, `-` and `_`, starting with a letter. */
const NAMESPACE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * One placement: a capability, and where it goes.
 *
 * `from` is optional because the compiler resolves capability → owning MFE
 * through the fleet's manifests. It becomes *required* when more than one MFE
 * declares the capability — abc-kids' fourteen games all declare `PlayGame` —
 * and the compiler reports the ambiguity with the candidate list rather than
 * picking one.
 */
export const PlacementSchema = z.object({
  /** The MFE that serves this capability. Required only to break ambiguity. */
  from: z.string().min(1).optional(),

  /** The capability to resolve. Must be declared by exactly one MFE, or qualified with `from`. */
  capability: z.string().min(1, 'capability is required'),

  /**
   * The slot address to place it in, e.g. `meridian-console/main`.
   *
   * Optional: a route with no address gets the LayoutManager's default, which
   * is host-owned and not any MFE's to declare (the same rule `slots:validate`
   * applies when it skips a route with no `props.slot`).
   */
  into: z.string().min(1).optional(),

  /** Extra props passed through to the resolved capability verbatim. */
  props: z.record(z.string(), z.unknown()).optional(),
});
export type Placement = z.infer<typeof PlacementSchema>;

/**
 * One route: when this state key fires, place these capabilities.
 *
 * A single route may place several capabilities — meridian's
 * `meridian.open.docking` puts the board in `main` and the traffic log in
 * `status` from one click — which is why `place` is a list rather than a
 * single resolve.
 */
export const ControlPlaneRouteSchema = z.object({
  /** The control-plane state key that triggers this route. Must sit under the document's namespace. */
  when: z.string().min(1, 'when is required'),

  /**
   * Expand this route once per combination of bindings.
   *
   * `{id}` in `when`, `into`, `from` and string props is substituted. Expansion
   * is total: a placeholder with no binding here is an error, because an
   * unexpanded `{id}` in a slot address is exactly the placement ADR-066 parks
   * and waits on — silently, forever.
   */
  forEach: z.record(z.string(), z.array(z.string().min(1)).min(1)).optional(),

  /** What to place, and where. */
  place: z.array(PlacementSchema).min(1, 'a route must place at least one capability'),

  /** Free-text note for humans; ignored by the compiler. */
  description: z.string().optional(),
});
export type ControlPlaneRoute = z.infer<typeof ControlPlaneRouteSchema>;

/** The whole document. */
export const ControlPlaneDocumentSchema = z.object({
  /** The deploying project this composition belongs to. */
  project: z.string().min(1, 'project is required'),

  /**
   * The state-key namespace this project owns.
   *
   * Declared, never inferred from `project` — ADR-083 §1. Every compiled state
   * key must sit under it, which is the collision two projects sharing one
   * registry cannot otherwise detect.
   */
  namespace: z
    .string()
    .min(1, 'namespace is required')
    .regex(NAMESPACE, 'namespace must start with a letter and contain only letters, digits, - and _'),

  /**
   * The MFE directories making up this fleet, relative to the document.
   *
   * These supply the manifests the compiler derives registrations from and
   * resolves capabilities against.
   */
  mfes: z.array(z.string().min(1)).min(1, 'at least one MFE is required'),

  /** Placement decisions. */
  routes: z.array(ControlPlaneRouteSchema).default([]),
});
export type ControlPlaneDocument = z.infer<typeof ControlPlaneDocumentSchema>;

// ── The compiled payload (what the registry already accepts) ────────────────
//
// Unchanged from what `rules.json` holds today — that is what makes the
// migration verifiable (ADR-083 "Boundaries").

/** The nine derived registration fields (ADR-074). */
export interface CompiledRegistration {
  name: string;
  version: string;
  type: string;
  baseUrl?: string;
  capabilities: string[];
  contentType: string;
  remoteEntryUrl?: string;
  moduleFederation: { scope: string; module: string };
  providesSlots?: { id: string; description?: string }[];
}

/** One compiled route, in the registry's own shape. */
export interface CompiledRoute {
  when: { stateKey: string };
  resolve: { capability: string; props?: Record<string, unknown> };
}

/** One `{registration, routes}` document, as POSTed to the registry. */
export interface CompiledRuleDocument {
  registration: CompiledRegistration;
  routes: CompiledRoute[];
}
