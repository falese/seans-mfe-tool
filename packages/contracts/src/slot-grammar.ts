/**
 * Slot-id grammar (ADR-066/067) — the single source, per ADR-069.
 *
 * A declared slot id is dot-separated segments; each segment is either a
 * `{param}` placeholder (the domain key of a repeated slot) or an
 * assigned-name literal that must contain a letter — purely numeric segments
 * describe a position, and addresses are assigned names, never measured
 * ordinals (ADR-066).
 *
 * Consumed by both ends of the contract: `@seans-mfe/dsl` validates
 * `providesSlots` declarations against `SLOT_ID_SEGMENT` at design time, and
 * the runtime matcher (`@seans-mfe-tool/runtime` slot-contract) compiles
 * declarations with `isSlotParamSegment` / `SLOT_PARAM_VALUE_SOURCE` at run
 * time. Keeping both on one definition means a grammar change is one edit —
 * never a silent split between what can be declared and what can match. The
 * cross-package pin (`slot-grammar-contract.test.ts` in the runtime package)
 * regression-tests the agreement.
 *
 * This module is pure data (regex sources + one predicate) and must stay
 * dependency-free: `@seans-mfe/contracts` is zero-dependency by invariant
 * (ADR-061).
 */

/** A `{param}` placeholder segment, e.g. `{gameId}` in `games.{gameId}`. */
export const SLOT_PARAM_SEGMENT_SOURCE = '\\{[A-Za-z][A-Za-z0-9_]*\\}';

/** An assigned-name literal segment: must contain a letter (ADR-066). */
export const SLOT_LITERAL_SEGMENT_SOURCE = '[A-Za-z0-9_-]*[A-Za-z][A-Za-z0-9_-]*';

/**
 * One runtime value instantiating a `{param}` segment. Deliberately excludes
 * `.` (would change the segment count) and `/` (path composition is
 * host-owned, ADR-068).
 */
export const SLOT_PARAM_VALUE_SOURCE = '[A-Za-z0-9_-]+';

/** One dot-separated declared segment: a `{param}` placeholder or a literal. */
export const SLOT_ID_SEGMENT = new RegExp(
  `^(${SLOT_PARAM_SEGMENT_SOURCE}|${SLOT_LITERAL_SEGMENT_SOURCE})$`
);

const SLOT_PARAM_SEGMENT = new RegExp(`^${SLOT_PARAM_SEGMENT_SOURCE}$`);

/** True when a declared segment is a `{param}` placeholder. */
export function isSlotParamSegment(segment: string): boolean {
  return SLOT_PARAM_SEGMENT.test(segment);
}
