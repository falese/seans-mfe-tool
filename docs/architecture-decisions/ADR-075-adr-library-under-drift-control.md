---
id: 0075
title: The ADR Library Is Itself Under Drift Control
status: Accepted
date: 2026-07-25
deciders: [sean]
area: Governance / docs / tooling
enforcement: code
tags: [governance, adr, drift, metadata, single-source, tooling]
relates-to: [0065, 0069, 0071, 0074]
supersedes: []
superseded-by: []
implemented-by:
  - packages/dsl/src/adr-schema.ts
  - packages/dsl/src/adr-validation.ts
  - src/commands/adr/validate.ts
  - scripts/check-adr-consistency.ts
verified-by:
  - packages/dsl/src/__tests__/adr-validation.test.ts
  - check:adr
summary: >-
  ADR frontmatter becomes the single source of truth for the decision record; the `docs/spec.md` index and the PDR↔ADR map become generated artifacts under a diff gate; and a rule set in `adr:validate` makes stale cross-references, one-way supersessions, unratified-ADR citations in code, and free-text statuses unrepresentable rather than merely noticeable.
rationale-summary: >-
  The platform gates every other derived artifact — schemas, generated MFE files, federation `shared`, slot placement targets — and the ADR library, the one artifact that governs all of them, was the last thing kept in sync by hand. It drifted exactly as the thesis predicts: twelve cross-references left pointing at renumbered decisions, a `superseded-by` field empty in all 58 files while three real supersessions lived in prose, and two ADRs marked `Proposed` while shipped code cited them by number.
---

## Context

Four gates keep the fleet honest — #295 (generator-owned files), #296
(`package.json` + federation `shared`), ADR-073 (`slots-implemented`,
`slots:validate`), ADR-065 (schemas and API reference). ADR-074 pushed the idea
one step further: where one artifact is a pure restatement of another, generate
it and the disagreement stops being possible.

The ADR library is the artifact all of those gates answer to, and it is the only
one still maintained entirely by hand. A review of all 74 records found the
predictable result:

1. **Twelve cross-references point at renumbered decisions.** The PR #194 reflow
   renamed files but never rewrote references inside ADR bodies. `ADR-005:61`,
   `ADR-006:55`, and `ADR-009:54` cite "ADR-013: Language-Agnostic DSL Contract"; <!-- adr-lint-ignore: reference-gloss-matches -->
   `ADR-025:368` and `ADR-026:355` cite "ADR-013: BaseMFE abstract base" — a <!-- adr-lint-ignore: reference-gloss-matches -->
   decision that is now ADR-041. Each reference resolves to a real file with a
   different meaning, which is worse than a dead link: `CLAUDE.md` directs every
   contributor and agent to consult ADRs before deciding, and these send them to
   the wrong document with no signal that anything is wrong. ADR-041 §Context
   diagnosed this exact defect, repointed the *code comment*, and left the two
   ADR bodies making the same wrong reference untouched — the clearest possible
   evidence that a human noticing is not a mechanism.

2. **`superseded-by` is dead metadata.** All 58 frontmatter files carry `[]`,
   while ADR-060 supersedes part of ADR-056, ADR-068 supersedes ADR-058's flat
   namespace, and ADR-062 supersedes the inline production-deploy codegen — each
   recorded in prose on the superseding side only. A reader arriving at ADR-056
   or ADR-058 from the index gets no hint that part of it is dead.
   `docs/platform-design-review/cross-reference-standards.md` §3 already makes
   bidirectionality normative ("an ADR that supersedes another links both ways").
   Nothing enforced it.

3. **Status contradicts shipped code.** ADR-029 and ADR-030 are `Proposed` in
   both the file and the index, while `packages/runtime/src/timeout-wrapper.ts`
   and `packages/contracts/src/error-classifier.ts` implement them and cite them
   by number in their headers.

4. **Two hand-maintained registers.** `docs/architecture-decisions/README.md`
   names `docs/spec.md#adr-index` canonical for status while every ADR file also
   carries its own. They disagree on ADR-057 and ADR-058 and on qualifiers for
   six more. The status column holds thirteen distinct strings for 74 records,
   so it cannot be aggregated or filtered.

Cross-reference-standards §4 anticipated part of this: Tier 2 calls for
validating "every `ADR-NNN`/`REQ-…` referenced exists in the register". That check
was specified and never built — and on its own it would have caught **none** of
the twelve defects in (1), because every one of those targets exists. Existence
is the wrong question; agreement is the right one.

## Decision

**The ADR library is a generated-and-gated artifact like every other derived
artifact in this repo.**

### 1. Frontmatter is the single source of truth

Each ADR's YAML frontmatter is authoritative for its own metadata. The
`docs/spec.md#adr-index` table and the PDR↔ADR mapping in
`docs/architecture-decisions/README.md` become **generated** from it, emitted
between explicit markers and gated with the `--check` diff idiom ADR-065
established for schemas and the API reference.

This inverts the current rule ("where a file disagrees with the index, the index
wins"). That rule was a reasonable response to having two copies; the better
response is to stop having two.

### 2. A closed vocabulary, schema-enforced

`status` is one of `Proposed` | `Accepted` | `Implemented` | `Deferred` |
`Superseded` | `Withdrawn`. Implementation state is separate structured data
(`impl: { stage: phased | deferred, refs: [...] }`) rather than free text
appended to the status, so "Accepted (impl deferred, #252)" stops being a string
only a human can read.

`area`, `tags`, `enforcement`, `relates-to`, `supersedes`, and `superseded-by`
become required fields. A Zod schema in `@seans-mfe/dsl` owns the shape, beside
the manifest schema, for the reason ADR-061 gives: the DSL package is where the
platform's parse-time contracts live, and this one is parsed at design time by
CLI tooling with no runtime dependency.

### 3. ADRs declare what implements them and what proves it

Two new fields close the loop between a decision and the code that carries it:

- **`implemented-by`** — repo-relative paths. Checked to exist. This is the
  ADR-041 defect class made unrepresentable: a decision cannot silently lose its
  implementation, and a file move that orphans an ADR fails the gate.
- **`verified-by`** — test names or npm-script gate names that demonstrate the
  decision holds.

Both may be empty; a decision that is pure convention has nothing to point at,
and forcing an invented path would be worse than an honest `[]`.

### 4. Rules, not a linter

The checks are pure functions in `@seans-mfe/dsl` behind a `ValidationRule`
union, with `adr:validate` as the thin I/O shell — the same split ADR-073 used
for `mfe:validate`, for the same reason: the logic is unit-tested in the
platform, and both the command and the CI wrapper call one implementation.

The rule that catches defect class (1) is `reference-gloss-matches`: where an ADR
cites another as `ADR-NNN: <gloss>`, the gloss must share vocabulary with what
that decision is about. **This is explicitly a heuristic** — token overlap, not
comprehension — and its one tuning parameter is the whole design. A gloss of more
than three content words is asserting the target's *title* and is compared only
against it; a shorter one is a passing paraphrase and may match the title, area,
tags, or summary. Comparing everything against the title alone flags legitimate
paraphrases; comparing everything against the full subject masks real defects
(the reference to "Standardized Extensible Lifecycle Hooks" survives on an
incidental `lifecycle` tag). It ships with an inline suppression comment and is a
lint, not a proof, on the same terms ADR-073 §3 set for `slots-implemented`.

Measured on the library as it stands, it reports ten of the twelve known stale
references with no false positives. The two it misses are in ADR-025 and ADR-026,
whose own headers fail `frontmatter-valid`, so their bodies are never scanned —
they surface automatically once the normalization pass fixes those headers.

The rule that catches (3) is `code-cites-ratified-adr`: source that cites
`ADR-NNN` must cite a decision that was actually made. `Proposed` and `Withdrawn`
are the two that fail — nobody has decided, or they decided against. `Deferred`
passes, because a placeholder marked `// Deferred - ADR-007` is pointing at the
decision to defer and is exactly right. Code claiming a `Proposed` decision is
either code that shipped ahead of its ADR or an ADR whose status was never
updated; both are drift, and both surface here.

### 5. One-time normalization, explicitly bounded

`CLAUDE.md` forbids editing existing ADRs mid-implementation. That rule protects
*reasoning* — the argument an ADR recorded at the time it was made — and it is
correct. It is not a reason to preserve a pointer to the wrong document.

This ADR authorizes one migration pass, bounded to: header format (16 ADRs still
using a prose header move to frontmatter), metadata fields, cross-reference
targets, and status reconciliation. **No Context, Decision, or Consequences prose
is rewritten.** Where a pre-reflow reference has no correct modern target, it is
removed and the removal recorded in the README erratum table rather than
repointed at a guess. After this pass the normal rule resumes, now with a gate
that keeps it cheap to obey.

## Boundaries

- **The gate protects only what it walks.** A lesson from #295 worth stating
  plainly here: `check-mfe-drift` compares generator-owned files, and for an MFE
  whose manifest has no `data:` block the BFF files are not emitted at all, so
  `examples/abc-kids/color-mixer/server.ts` can carry a pre-reflow `ADR-046`
  against a template that says `ADR-012` and the gate still reports clean. A
  generate-and-diff gate is exactly as broad as the generator's output set. The
  same caution applies to ADR-074 §1's claim that a generated registration is
  covered "for free".
- **`reference-gloss-matches` is a lint.** See §4. Suppressible, and it will miss
  a stale reference that happens to share a word with its new target.
- **Nothing here ratifies a decision.** The gate reports that ADR-029 and ADR-030
  are cited by code while marked `Proposed`; deciding which side is wrong stays a
  human call.
- **Prose is out of scope.** The gate checks metadata and references. Whether an
  ADR's argument is still *true* is not machine-checkable and is not attempted.

## Consequences

- Index drift stops being detectable and starts being impossible — the direction
  ADR-074 named and the last four gates have been pointing.
- The status column becomes aggregable: "what is Proposed and cited by code" is a
  query rather than a reading exercise.
- ADRs gain a checked backlink to their implementation, so a refactor that moves
  the code it governs surfaces the ADR that needs revisiting.
- Trade-off: every new ADR now carries more required metadata, and a
  `_TEMPLATE.md` plus the gate's error messages are what keep that from being
  friction. The same trade ADR-067 accepted for `providesSlots`.
- Trade-off: the migration pass touches 74 files at once. It is mechanical and
  each edit maps to a failing rule, but it is a large diff to review, which is
  why the gate lands first and red — the diff's job is to turn it green.

## References

- ADR-065 — the generate-and-diff idiom, and "a generated artifact with no
  generate-and-diff gate is a stale artifact eventually". This applies it to the
  register itself.
- ADR-069 / ADR-071 — single-sourcing a fact that two consumers restate. <!-- adr-lint-ignore: reference-gloss-matches -->
- ADR-074 — drift made unrepresentable rather than detected; the Boundaries
  section above qualifies its §1 coverage claim.
- ADR-073 — the pure-rules + thin-command split this reuses, and the <!-- adr-lint-ignore: reference-gloss-matches -->
  documented-heuristic precedent for `reference-gloss-matches`.
- `docs/platform-design-review/cross-reference-standards.md` §3–§4 — the
  normative standard this implements: bidirectional supersession links and the
  Tier 2 reference check.
