/**
 * Design-time slot validation (ADR-073).
 *
 * ADR-067 §4 promised that a placement target could be checked against the
 * manifest before runtime — "typos and renames fail at rule-save or CI, not in
 * production". Nothing implemented it. These are the two checks that make the
 * promise real, in the two places drift actually happens:
 *
 *   1. inside an MFE — a slot declared in the manifest that no component ever
 *      registers, which becomes a placement that parks forever (ADR-066
 *      convergence waits indefinitely, by design);
 *   2. across the fleet — a registry rule aimed at an address no provider
 *      declares.
 *
 * Both are pure functions over already-read inputs: the CLI supplies the IO, so
 * the logic is unit-testable without a filesystem and reusable by any tooling.
 * Matching goes through `createSlotAddressRegistry` in `@seans-mfe/contracts`,
 * so design time and run time can never disagree about what an id means.
 */
import {
  createSlotAddressRegistry,
  isSlotParamSegment,
  type ProvidedSlotDeclaration,
  type SlotProviderDeclarations,
  type SlotTargetRejection,
} from '@seans-mfe/contracts';

// ── 1. Declared-but-unreferenced (intra-MFE) ────────────────────────────────

/** One source file the scan considers. */
export interface SourceFile {
  path: string;
  text: string;
}

export interface UnreferencedSlotFinding {
  slotId: string;
  reason: 'declared-but-unreferenced';
  message: string;
}

/**
 * The literal text a reference to `declaredId` must contain.
 *
 * A keyed id is built by interpolation at runtime (`` `berth.${berthId}` ``),
 * so only the literal prefix before the first `{param}` segment can be searched
 * for honestly. `berth.{id}` therefore looks for `berth.`.
 */
function referenceNeedle(declaredId: string): string {
  const segments = declaredId.split('.');
  const firstParam = segments.findIndex(isSlotParamSegment);
  if (firstParam === -1) return declaredId;
  return segments.slice(0, firstParam).concat('').join('.');
}

/**
 * Report declared slots that no source file mentions.
 *
 * **This is a lint, not a proof.** It catches dead declarations, typos, and
 * slots removed from a component but left in the manifest. It cannot see
 * conditional registration, and an id assembled from non-literal parts will
 * evade it. Proving the opposite — that every declared slot is really
 * registered — would mean rendering every capability with props the platform
 * cannot invent.
 */
export function findUnreferencedSlots(
  declarations: readonly ProvidedSlotDeclaration[],
  sources: readonly SourceFile[]
): UnreferencedSlotFinding[] {
  const findings: UnreferencedSlotFinding[] = [];

  for (const declaration of declarations) {
    const needle = referenceNeedle(declaration.id);
    // A literal id must not be satisfied by a longer identifier that merely
    // contains it (`mainMenu` is not a reference to `main`), so require a
    // non-identifier character on both sides. A keyed prefix already ends in
    // '.', which is itself a boundary.
    const boundary = needle.endsWith('.')
      ? new RegExp(`[^A-Za-z0-9_$]${escapeRegExp(needle)}`)
      : new RegExp(`[^A-Za-z0-9_$-]${escapeRegExp(needle)}[^A-Za-z0-9_$-]`);

    if (sources.some((source) => boundary.test(source.text))) continue;

    findings.push({
      slotId: declaration.id,
      reason: 'declared-but-unreferenced',
      message:
        `Slot "${declaration.id}" is declared in providesSlots but no source file references ` +
        `${needle.endsWith('.') ? `"${needle}"` : `"${declaration.id}"`}. ` +
        `A placement targeting it would wait forever (ADR-066 parks until the slot registers). ` +
        `Register it with DeclaredSlot (ADR-072), or remove it from the manifest.`,
    });
  }

  return findings;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 2. Placement targets (cross-MFE) ────────────────────────────────────────

/** One `{registration, routes}` payload as POSTed to the registry. */
export interface PlacementRuleDocument {
  registration?: { name?: string };
  routes?: readonly {
    resolve?: { capability?: string; props?: Record<string, unknown> };
  }[];
}

export interface PlacementFinding {
  /** The MFE whose rule targets the address. */
  mfe: string;
  capability: string;
  slot: string;
  reason: SlotTargetRejection;
  /** Advisory findings (unknown provider) must not fail a build. */
  fatal: boolean;
  message: string;
}

/**
 * Validate every `resolve.props.slot` in the supplied rule documents against
 * the fleet's declared address space.
 *
 * A route with no `props.slot` is skipped: the LayoutManager applies its own
 * default, which is host-owned and not any MFE's to declare.
 */
export function validatePlacementRules(
  documents: readonly PlacementRuleDocument[],
  providers: readonly SlotProviderDeclarations[]
): PlacementFinding[] {
  const registry = createSlotAddressRegistry(providers);
  const findings: PlacementFinding[] = [];

  for (const document of documents) {
    const mfe = document.registration?.name ?? '<unnamed>';
    for (const route of document.routes ?? []) {
      const slot = route.resolve?.props?.slot;
      if (typeof slot !== 'string' || slot.length === 0) continue;

      const result = registry.validateTarget(slot);
      if (result.status === 'ok') continue;

      findings.push({
        mfe,
        capability: route.resolve?.capability ?? '<unnamed>',
        slot,
        reason: result.reason,
        // Registration order is not guaranteed and a fleet may be validated one
        // MFE at a time, so a provider we simply have no manifest for is a
        // warning; an id a known provider does not declare is a real defect.
        fatal: result.reason !== 'unknown-provider',
        message: result.message,
      });
    }
  }

  return findings;
}
