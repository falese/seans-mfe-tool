/**
 * Slot placement validation for the demo registry (ADR-073 §5).
 *
 * ADR-067 §4 called the manifest "the registry-side validation target": a rule
 * aimed at a slot nobody declares should be rejected when it is saved, not
 * discovered in production. It never was — props passed through opaquely, and
 * an unbindable placement is silent at runtime because ADR-066 parks it and
 * waits for a slot that never arrives.
 *
 * The matcher below mirrors createSlotContract in @seans-mfe/contracts. It is a
 * copy, not a call: this registry is a standalone dockerized service and
 * @seans-mfe/contracts is not published yet (docs/MERGE-PLAN.md Phase 1).
 * Switch to the package when it is. The behavioural pin lives in
 * slot-target.test.js — the same idiom ADR-069 used for the grammar.
 */

/** `{param}` matches exactly one segment: the value charset excludes '.' and '/'. */
const SLOT_PARAM_VALUE_SOURCE = '[A-Za-z0-9_-]+';
const isSlotParamSegment = (segment) => /^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(segment);

function toSlotMatcher(declaredId) {
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

/**
 * Validate one placement target against the providers registered so far.
 *
 * Returns null when acceptable. An unqualified address (`root`, the
 * LayoutManager default `main`) is host-owned — no MFE manifest declares it, so
 * there is nothing to check. A provider we have not seen yet is advisory:
 * registration order is not guaranteed, and rejecting would make the outcome
 * depend on the order operators happen to POST in.
 */
export function validateSlotTarget(address, providedSlotsByMfe) {
  const separator = address.lastIndexOf('/');
  if (separator === -1) return null;

  const providerMfeId = address.slice(0, separator);
  const localSlotId = address.slice(separator + 1);
  if (!providerMfeId || !localSlotId) {
    return { fatal: true, reason: 'malformed-address',
      message: `slot "${address}" is malformed — expected "<provider-mfe-id>/<declared-slot-id>" (ADR-068)` };
  }

  const declarations = providedSlotsByMfe.get(providerMfeId);
  if (!declarations) {
    return { fatal: false, reason: 'unknown-provider',
      message: `slot "${address}" names provider "${providerMfeId}", not registered yet — accepted, order is not guaranteed` };
  }

  if (declarations.some((declared) => toSlotMatcher(declared).test(localSlotId))) return null;

  return { fatal: true, reason: 'undeclared-slot',
    message: `slot "${address}" is not declared by "${providerMfeId}" (declares: ${declarations.map((d) => `"${d}"`).join(', ') || 'none'})` };
}
