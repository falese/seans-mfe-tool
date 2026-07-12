# ADR-069 — Slot grammar single-sourced in contracts

- **Status:** Accepted
- **Date:** 2026-07-12
- **Relates to:** ADR-061 (contracts zero-dependency invariant), ADR-066 (assigned-name identity rules), ADR-067 (manifest-declared slot contract)
- **Tracked in:** #265

## Context

The slot-id grammar — what a declared `providesSlots` id segment may look
like (assigned-name literals, `{param}` placeholders, the runtime value
charset) — was written twice: once as `SLOT_ID_SEGMENT` in
`packages/dsl/src/schema.ts` (design-time validation) and once inside
`toMatcher` in `packages/runtime/src/slot-contract.ts` (runtime matching).
The two regexes had to agree but shared no source; a change to one and not
the other would silently split what can be declared from what can match.
PR #266 review flagged the drift risk; a cross-package behavioral pin test
was added as a stopgap, but the grammar still had two sources of truth.

Single-sourcing requires a dependency direction. The candidates:

- `dsl → runtime`: wrong direction — runtime is a private, heavyweight
  package staged into generated MFEs.
- `runtime → dsl`: drags zod/fs-extra/js-yaml into the published runtime.
- A new micro-package: a package to version, publish, and wire for ~20
  lines of regex.
- `@seans-mfe/contracts`: the shared-contract package both sides can reach.
  Runtime already imports it (`ValidationError` in slot-contract). The
  grammar module is pure regex constants plus one predicate, so the ADR-061
  zero-dependency invariant holds.

## Decision

**The slot-id grammar lives once in `@seans-mfe/contracts`
(`src/slot-grammar.ts`) and both consumers import it.**

- `slot-grammar.ts` exports the segment-shape sources
  (`SLOT_PARAM_SEGMENT_SOURCE`, `SLOT_LITERAL_SEGMENT_SOURCE`), the runtime
  value charset (`SLOT_PARAM_VALUE_SOURCE`), the compiled `SLOT_ID_SEGMENT`,
  and `isSlotParamSegment()`. The module is dependency-free — the contracts
  zero-dependency invariant (ADR-061) is preserved.
- `packages/dsl` gains its first workspace dependency,
  `"@seans-mfe/contracts": "file:../contracts"` — the same shape as the
  existing `codegen → dsl` edge. Turbo's `build.dependsOn: ["^build"]`
  orders the builds; tsconfig paths and the jest module map already resolve
  the specifier.
- The runtime matcher compiles declarations from `isSlotParamSegment` and
  `SLOT_PARAM_VALUE_SOURCE` instead of its own literals.
- The cross-package pin (`slot-grammar-contract.test.ts` in the runtime
  package) is kept: the two consumers *compose* the grammar differently
  (whole-id validation vs matcher compilation), and the pin catches drift in
  those compositions even over one grammar.

## Consequences

- A grammar change (charsets, param-name rules) is one edit in one module,
  visible to both design time and run time simultaneously.
- `@seans-mfe/dsl` now depends on `@seans-mfe/contracts`; when contracts is
  published (docs/MERGE-PLAN.md Phase 1), dsl's `file:` reference must move
  to the published version alongside codegen's existing `file:../dsl`.
- Third-party tooling that needs to validate slot ids (registry rules,
  linters) can import the grammar from contracts instead of copying a regex.
