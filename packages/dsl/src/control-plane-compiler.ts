/**
 * Compiles a project's composition document into the registry payload (ADR-083).
 *
 * Pure: no I/O, no process access. The caller reads the document and the
 * manifests; this decides what the registry should be told. Same core/command
 * split as the slot checks in `slot-validation.ts`.
 *
 * Two jobs:
 *
 *   1. **Derive** the `registration` half from each manifest (ADR-074). Nine
 *      fields, none of which an author should ever retype.
 *   2. **Resolve** the authored routes — expand `forEach`, find the MFE that
 *      serves each capability, and check the things that used to fail silently
 *      at runtime.
 *
 * Output is the shape the registry already accepts, unchanged. That is
 * deliberate (ADR-083 "Boundaries"): it makes the migration off hand-written
 * `rules.json` provable rather than asserted.
 */

import { createSlotAddressRegistry, type SlotProviderDeclarations } from '@seans-mfe/contracts';
import type { DSLManifest } from './schema';
import {
  PLACEHOLDER,
  type CompiledRegistration,
  type CompiledRoute,
  type CompiledRuleDocument,
  type ControlPlaneDocument,
  type ControlPlaneRoute,
  type Placement,
} from './control-plane-schema';

/** Why a document was rejected. Each maps to one failure that used to reach runtime. */
export type ControlPlaneRule =
  | 'namespace-escape'
  | 'unknown-capability'
  | 'ambiguous-capability'
  | 'unknown-mfe'
  | 'unbound-placeholder'
  | 'undeclared-slot';

export interface ControlPlaneFinding {
  rule: ControlPlaneRule;
  /** The state key the offending route produces, for locating it in the source. */
  stateKey: string;
  message: string;
  /** Advisory findings must not fail a build; everything structural does. */
  fatal: boolean;
}

export interface CompileInput {
  document: ControlPlaneDocument;
  /** Parsed manifests for the fleet, in `document.mfes` order. */
  manifests: readonly DSLManifest[];
}

export interface CompileResult {
  /** One entry per MFE, in fleet order, whether or not it has routes. */
  payload: CompiledRuleDocument[];
  findings: ControlPlaneFinding[];
}

// ── derivation (ADR-074) ────────────────────────────────────────────────────

/**
 * The content type the registry uses to decide how to load the experience.
 *
 * Both supported bundlers produce Module Federation containers, so this is a
 * single value today. It is derived rather than hardcoded at the call site so
 * a third framework plugin (ADR-036) has one place to change.
 */
function deriveContentType(_manifest: DSLManifest): string {
  return 'module-federation';
}

/**
 * The nine registration fields, from the manifest (ADR-074).
 *
 * `capabilities` is the *platform* contract — `load`, `render`, … — lowercased,
 * because that is what the registry matches against. Domain capabilities are
 * addressed by route instead, so listing them here would say nothing.
 */
export function deriveRegistration(manifest: DSLManifest): CompiledRegistration {
  const platformCapabilities = (manifest.capabilities ?? []).flatMap((entry) =>
    Object.entries(entry)
      .filter(([, config]) => config?.type === 'platform')
      .map(([name]) => name.toLowerCase())
  );

  const registration: CompiledRegistration = {
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    baseUrl: manifest.endpoint,
    capabilities: platformCapabilities,
    contentType: deriveContentType(manifest),
    remoteEntryUrl: manifest.remoteEntry,
    moduleFederation: {
      scope: manifest.name.replace(/-/g, '_'),
      // Fixed by #272 and recorded by ADR-074; the template exposes exactly this.
      module: './App',
    },
  };

  if (manifest.providesSlots && manifest.providesSlots.length > 0) {
    registration.providesSlots = manifest.providesSlots.map((slot) =>
      slot.description === undefined ? { id: slot.id } : { id: slot.id, description: slot.description }
    );
  }

  return registration;
}

// ── expansion ───────────────────────────────────────────────────────────────

/** Every combination of the `forEach` bindings, in declaration order. */
function expandBindings(forEach: Record<string, string[]> | undefined): Record<string, string>[] {
  if (!forEach) return [{}];

  return Object.entries(forEach).reduce<Record<string, string>[]>(
    (combinations, [key, values]) =>
      combinations.flatMap((combination) =>
        values.map((value) => ({ ...combination, [key]: value }))
      ),
    [{}]
  );
}

/** Substitute `{name}` from the bindings. Unbound placeholders are left in place for the caller to report. */
function substitute(input: string, bindings: Record<string, string>): string {
  return input.replace(PLACEHOLDER, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(bindings, name) ? bindings[name] : match
  );
}

/** Substitute through a props object, string values only — numbers and booleans pass through. */
function substituteProps(
  props: Record<string, unknown> | undefined,
  bindings: Record<string, string>
): Record<string, unknown> | undefined {
  if (!props) return undefined;
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === 'string' ? substitute(value, bindings) : value,
    ])
  );
}

/** Any `{placeholder}` the bindings did not resolve. */
function unbound(...values: (string | undefined)[]): string[] {
  const found = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(PLACEHOLDER)) found.add(match[0]);
  }
  return [...found];
}

// ── compilation ─────────────────────────────────────────────────────────────

/**
 * Resolve which MFE serves a capability.
 *
 * Unqualified is the common case and reads best; `from` exists for the case
 * the manifests cannot disambiguate — abc-kids' fourteen games all declare
 * `PlayGame`, so there the provider is genuinely part of the decision.
 */
function resolveProvider(
  placement: Placement,
  bindings: Record<string, string>,
  byName: Map<string, DSLManifest>,
  byCapability: Map<string, string[]>,
  stateKey: string
): { name: string } | { finding: ControlPlaneFinding } {
  const capability = substitute(placement.capability, bindings);

  if (placement.from) {
    const from = substitute(placement.from, bindings);
    const manifest = byName.get(from);
    if (!manifest) {
      return {
        finding: {
          rule: 'unknown-mfe',
          stateKey,
          fatal: true,
          message: `Route "${stateKey}" places from "${from}", which is not an MFE in this fleet. Add it to \`mfes\` or fix the name.`,
        },
      };
    }
    const declared = (manifest.capabilities ?? []).some((entry) =>
      Object.prototype.hasOwnProperty.call(entry, capability)
    );
    if (!declared) {
      return {
        finding: {
          rule: 'unknown-capability',
          stateKey,
          fatal: true,
          message: `Route "${stateKey}" places "${capability}" from "${from}", which does not declare it.`,
        },
      };
    }
    return { name: from };
  }

  const candidates = byCapability.get(capability) ?? [];
  if (candidates.length === 0) {
    return {
      finding: {
        rule: 'unknown-capability',
        stateKey,
        fatal: true,
        message: `Route "${stateKey}" places "${capability}", which no MFE in this fleet declares.`,
      },
    };
  }
  if (candidates.length > 1) {
    return {
      finding: {
        rule: 'ambiguous-capability',
        stateKey,
        fatal: true,
        message: `Route "${stateKey}" places "${capability}", declared by ${candidates.length} MFEs (${candidates.join(', ')}). Name one with \`from\`.`,
      },
    };
  }
  return { name: candidates[0] };
}

/**
 * Compile a composition document plus its fleet's manifests into the registry
 * payload, reporting everything that would otherwise surface at runtime.
 */
export function compileControlPlane(input: CompileInput): CompileResult {
  const { document, manifests } = input;
  const findings: ControlPlaneFinding[] = [];

  const byName = new Map(manifests.map((manifest) => [manifest.name, manifest]));

  const byCapability = new Map<string, string[]>();
  for (const manifest of manifests) {
    for (const entry of manifest.capabilities ?? []) {
      for (const capability of Object.keys(entry)) {
        byCapability.set(capability, [...(byCapability.get(capability) ?? []), manifest.name]);
      }
    }
  }

  const providers: SlotProviderDeclarations[] = manifests
    .filter((manifest) => manifest.providesSlots && manifest.providesSlots.length > 0)
    .map((manifest) => ({
      mfeId: manifest.name,
      declarations: manifest.providesSlots!.map((slot) => ({ id: slot.id })),
    }));
  const addresses = createSlotAddressRegistry(providers);

  // One bucket per MFE, in fleet order — a fleet member with no routes still
  // has to be registered or the shell cannot load it at all.
  const routesByMfe = new Map<string, CompiledRoute[]>(
    manifests.map((manifest) => [manifest.name, []])
  );

  const prefix = `${document.namespace}.`;

  for (const route of document.routes ?? []) {
    for (const bindings of expandBindings(route.forEach)) {
      const stateKey = substitute(route.when, bindings);

      const loose = unbound(stateKey);
      if (loose.length > 0) {
        findings.push({
          rule: 'unbound-placeholder',
          stateKey,
          fatal: true,
          message: `Route "${route.when}" leaves ${loose.join(', ')} unbound — add it to \`forEach\` or remove the placeholder.`,
        });
        continue;
      }

      if (!stateKey.startsWith(prefix)) {
        findings.push({
          rule: 'namespace-escape',
          stateKey,
          fatal: true,
          message: `State key "${stateKey}" escapes this project's namespace — it must start with "${prefix}" (ADR-083 §1).`,
        });
        continue;
      }

      compilePlacements(route, bindings, stateKey);
    }
  }

  function compilePlacements(
    route: ControlPlaneRoute,
    bindings: Record<string, string>,
    stateKey: string
  ): void {
    for (const placement of route.place) {
      const slot = placement.into ? substitute(placement.into, bindings) : undefined;
      const props = substituteProps(placement.props, bindings);

      const loose = unbound(slot, placement.from ? substitute(placement.from, bindings) : undefined);
      if (loose.length > 0) {
        findings.push({
          rule: 'unbound-placeholder',
          stateKey,
          fatal: true,
          message: `Route "${stateKey}" leaves ${loose.join(', ')} unbound in its placement — add it to \`forEach\` or remove the placeholder.`,
        });
        continue;
      }

      const provider = resolveProvider(placement, bindings, byName, byCapability, stateKey);
      if ('finding' in provider) {
        findings.push(provider.finding);
        continue;
      }

      if (slot) {
        const result = addresses.validateTarget(slot);
        if (result.status === 'rejected') {
          findings.push({
            rule: 'undeclared-slot',
            stateKey,
            // An unknown provider is advisory for the same reason slots:validate
            // treats it so: the fleet under compilation may not be the whole
            // fleet at runtime.
            fatal: result.reason !== 'unknown-provider',
            message: `Route "${stateKey}" targets "${slot}": ${result.message}`,
          });
          if (result.reason !== 'unknown-provider') continue;
        }
      }

      const mergedProps = { ...(slot ? { slot } : {}), ...(props ?? {}) };
      const resolve: CompiledRoute['resolve'] = {
        capability: substitute(placement.capability, bindings),
      };
      if (Object.keys(mergedProps).length > 0) resolve.props = mergedProps;

      routesByMfe.get(provider.name)!.push({ when: { stateKey }, resolve });
    }
  }

  const payload: CompiledRuleDocument[] = manifests.map((manifest) => ({
    registration: deriveRegistration(manifest),
    routes: routesByMfe.get(manifest.name) ?? [],
  }));

  return { payload, findings };
}
