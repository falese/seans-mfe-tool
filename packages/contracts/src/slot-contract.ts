/**
 * Slot contract logic (ADR-067) — framework-free, DOM-free, published once.
 *
 * Lives in `@falese/smt-contracts` as of ADR-073, not in the runtime package.
 * Design-time tooling (the `mfe:validate` / `slots:validate` CLI commands, and
 * third-party rule authoring) has to match slot ids too, and runtime is private
 * and heavyweight — the CLI cannot reach it. Re-implementing the matcher for
 * design time would recreate exactly the two-sources drift ADR-069 removed, so
 * the matcher moved to the package both sides already reach. Contracts already
 * owns the grammar and `ValidationError`, and this module is pure regex plus a
 * factory, so the ADR-061 zero-dependency invariant holds.
 * `packages/runtime/src/slot-contract.ts` re-exports it, keeping the
 * `@falese/smt-runtime` specifier that every generated MFE imports.
 *
 * The three-layer split: the *manifest* declares slot identity (data), this
 * module owns matching and the declare-before-register guard (logic), and
 * framework packages add thin registration sugar (e.g. a React component
 * whose ref callback calls `register()`). Generated MFEs mirror their
 * manifest's `providesSlots` into `createSlotContract(...)` and carry no
 * slot logic of their own — a matcher fix ships here, not in N regenerated
 * copies.
 *
 * Identity rules come from ADR-066: ids are assigned names; a `{param}`
 * segment is the domain key of a repeated slot and matches exactly one
 * runtime segment. Ordinal-form ids cannot be declared (the DSL schema
 * rejects them), so they can never match here either.
 */

import { SLOT_PARAM_VALUE_SOURCE, isSlotParamSegment } from './slot-grammar';
import { ValidationError } from './errors/index';

/** One slot declaration, as it appears in the manifest's `providesSlots`. */
export interface ProvidedSlotDeclaration {
  id: string;
  description?: string;
}

/** Host registration callback (ADR-058), structural over the element type. */
export type ProvideSlotFn<E> = (slotId: string, element: E | null) => void;

/**
 * Compose the stable host address for an MFE-provided local slot id.
 *
 * Path composition is host-owned (ADR-068): a local id containing "/" could
 * mint an address outside the provider's own prefix (provider `a` +
 * `b/main` colliding with provider `a/b` + `main`), so it is rejected here —
 * the one seam every registration crosses, including contract-bypassing
 * callers that never ran the manifest guard.
 */
export function toProvidedSlotAddress(providerMfeId: string, declaredSlotId: string): string {
  if (!providerMfeId) {
    throw new ValidationError(
      'Provider MFE id is required to compose a provided slot address (ADR-068)',
      'providerMfeId',
      'non-empty'
    );
  }
  if (!declaredSlotId || declaredSlotId.includes('/')) {
    throw new ValidationError(
      `Slot id "${declaredSlotId}" must not contain "/" and must be non-empty — ` +
        `path composition is host-owned (ADR-068); register the local name only`,
      'slotId',
      'local-name-only'
    );
  }
  return `${providerMfeId}/${declaredSlotId}`;
}

export interface SlotContract {
  /** The manifest declarations this contract was built from. */
  readonly declarations: readonly ProvidedSlotDeclaration[];
  /** True when `id` matches a declared literal or keyed pattern. */
  matches(id: string): boolean;
  /** Throw a ValidationError unless `id` is declared. */
  assertDeclared(id: string): void;
  /**
   * Guarded registration: asserts the id is declared, then hands the element
   * to the host. A null element releases the runtime registration; without a
   * host callback (standalone/dev mode) registration is a no-op. The assertion
   * still runs, so an undeclared id fails fast even before composition.
   */
  register<E>(provideSlot: ProvideSlotFn<E> | undefined, id: string, element: E | null): void;
}

/** Compile one declared id into a matcher: literals escaped, `{param}` → one
 *  segment value. Grammar single-sourced in @falese/smt-contracts (ADR-069). */
function toMatcher(declaredId: string): RegExp {
  const source = declaredId
    .split('.')
    .map((segment) =>
      isSlotParamSegment(segment)
        ? SLOT_PARAM_VALUE_SOURCE
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('\\.');
  return new RegExp('^' + source + '$');
}

export function createSlotContract(declarations: readonly ProvidedSlotDeclaration[]): SlotContract {
  const matchers = declarations.map((declaration) => toMatcher(declaration.id));

  const matches = (id: string): boolean => matchers.some((matcher) => matcher.test(id));

  const assertDeclared = (id: string): void => {
    if (matches(id)) return;
    throw new ValidationError(
      `Slot "${id}" is not declared in this MFE's manifest providesSlots ` +
        `(declared: ${declarations.map((d) => `"${d.id}"`).join(', ') || 'none'}). ` +
        `Declare it in the manifest and regenerate — the manifest is the contract ` +
        `registry rules validate against (ADR-067).`,
      'slotId',
      'declared-in-manifest'
    );
  };

  return {
    declarations,
    matches,
    assertDeclared,
    register<E>(provideSlot: ProvideSlotFn<E> | undefined, id: string, element: E | null): void {
      assertDeclared(id);
      provideSlot?.(id, element);
    },
  };
}

// ── Cross-MFE placement targets (ADR-073) ───────────────────────────────────
// `SlotContract` answers "may THIS MFE register this local id?". A registry
// rule asks a different question: "does the qualified address this rule targets
// exist anywhere in the fleet?" — the check ADR-067 §4 promised and nothing
// implemented. It runs over the same matchers, so a rule can never be validated
// against a grammar the runtime does not honour.

/** Why a placement target was rejected. */
export type SlotTargetRejection =
  /** The provider is registered and does not declare this id — a rename or typo. */
  | 'undeclared-slot'
  /** No manifest for this provider was supplied. Advisory: order is not guaranteed. */
  | 'unknown-provider'
  /** The address is syntactically unusable (empty provider or slot segment). */
  | 'malformed-address';

/**
 * Discriminated on `status` rather than a boolean: this repo compiles without
 * `strictNullChecks`, and TypeScript does not narrow a boolean-literal
 * discriminant in that mode, so `{ ok: true } | { ok: false; ... }` would force
 * every consumer into a cast.
 */
export type SlotTargetResult =
  | { status: 'ok' }
  | { status: 'rejected'; reason: SlotTargetRejection; message: string };

/** One provider's contribution to the fleet-wide address space. */
export interface SlotProviderDeclarations {
  /** The stable MFE id that prefixes this provider's addresses (ADR-068). */
  mfeId: string;
  declarations: readonly ProvidedSlotDeclaration[];
}

export interface SlotAddressRegistry {
  /** Validate one `props.slot` placement target. */
  validateTarget(address: string): SlotTargetResult;
}

/**
 * Build the fleet's address space from the providers' manifests.
 *
 * Unqualified addresses (`root`, the LayoutManager's default `main`) are
 * host-owned: no MFE manifest declares them and none can, so they are accepted
 * without a contract to check against (ADR-067 boundary).
 */
export function createSlotAddressRegistry(
  providers: readonly SlotProviderDeclarations[]
): SlotAddressRegistry {
  const contracts = new Map<string, SlotContract>(
    providers.map((provider) => [provider.mfeId, createSlotContract(provider.declarations)])
  );

  return {
    validateTarget(address: string): SlotTargetResult {
      const separator = address.lastIndexOf('/');
      if (separator === -1) {
        // Host-owned region — the shell's own configuration is its declaration
        // surface, so there is nothing here to validate against.
        return { status: 'ok' };
      }

      const providerMfeId = address.slice(0, separator);
      const localSlotId = address.slice(separator + 1);
      if (!providerMfeId || !localSlotId) {
        return {
          status: 'rejected',
          reason: 'malformed-address',
          message:
            `Placement target "${address}" is malformed — expected ` +
            `"<provider-mfe-id>/<declared-slot-id>" (ADR-068) or an unqualified host-owned id.`,
        };
      }

      const contract = contracts.get(providerMfeId);
      if (!contract) {
        return {
          status: 'rejected',
          reason: 'unknown-provider',
          message:
            `Placement target "${address}" names provider "${providerMfeId}", whose manifest ` +
            `was not supplied. Advisory only: registration order is not guaranteed and a fleet ` +
            `may be validated one MFE at a time.`,
        };
      }

      if (contract.matches(localSlotId)) return { status: 'ok' };

      const declared = contract.declarations.map((d) => `"${d.id}"`).join(', ') || 'none';
      return {
        status: 'rejected',
        reason: 'undeclared-slot',
        message:
          `Placement target "${address}" is not declared by "${providerMfeId}" ` +
          `(declares: ${declared}). Add it to that MFE's manifest providesSlots and ` +
          `regenerate, or fix the rule — the manifest is the contract (ADR-067).`,
      };
    },
  };
}
