---
id: 0090
title: The drift auditor emits a typed HardenedCheck or SemanticFinding — the same typed-artifact contract as generation, turned on governance
status: Proposed
date: 2026-09-03
deciders: [sean]
area: Kernel / drift-auditor
enforcement: convention
tags: [kernel, governance, drift, ai, retrieval, typed-artifact, hardening]
relates-to: [82, 84, 85, 88, 89]
supersedes: []
superseded-by: []
implements-pdr: [10]
implemented-by: []
verified-by: []
tracked-by: []
summary: >-
  The kernel's drift auditor reads wide over decision records and the code that carries them and
  emits a typed artifact — a HardenedCheck (a usage-detectable, mechanizable check, the
  PLATFORM_MIGRATIONS shape) or a SemanticFinding (a real but not-yet-mechanizable finding). The
  typed schema is the model's output contract: it is at once the result format, an
  anti-hallucination narrow-waist, and a precision filter, because a finding that cannot be written
  as one of the two variants is either not real or not actionable. This is ADR-084's typed-artifact
  boundary turned from generation onto governance; detection is retrieval + judgment over durable
  ADR-keyed provenance, not a fine-tune, and the audit self-liquidates as findings harden into the
  deterministic floor.
rationale-summary: >-
  The platform already proved once (ADR-084) that constraining a model's output to a small typed
  artifact, with a deterministic oracle behind it, is what makes stochastic output safe to act on;
  governance drift is the same problem shape, so it gets the same answer rather than a bespoke one. A
  typed output is also the honest precision filter for an auditor: forcing every finding into a
  HardenedCheck or a SemanticFinding discards the vague, unfalsifiable observations that a free-text
  auditor would emit and a reviewer would learn to ignore. Retrieval over the git history of
  implemented-by fixes keeps it grounded and current at a sample size too small to fine-tune.
long-form: true
---

# ADR-090: The drift auditor emits a typed HardenedCheck or SemanticFinding — the same typed-artifact contract as generation, turned on governance

## Context

ADR-082 built the platform's first governance mechanism: a breaking change to code the generator
seeds but does not own is declared as a typed `PlatformMigration` entry — a matcher, a fix, a
`failsAt` version — and `mfe:validate` fires it against the affected artifact. It works, but the
entries are hand-authored: a human notices the drift, writes the typed check, and the mechanism
only ever reports drift someone already thought to encode.

PDR-010 observes that this is the *governance* instance of the same contract ADR-084 fixed for
*generation*: a model reads wide, emits a typed artifact, and a deterministic floor executes it. In
generation the artifact is a manifest and the floor is `validateFull`. In governance the artifact is
a check and the floor is `mfe:validate`. The piece PDR-010's kernel adds is the model that *finds*
the drift and *proposes the typed entry* — closing the loop ADR-082 left open at "a human notices."

The question this ADR settles is what that model is allowed to emit. Left unconstrained, a drift
auditor produces free-text observations — plausible, unfalsifiable, and quickly ignored. The output
has to be a typed artifact for the same reason generation's is.

## Decision

### 1. The auditor emits one of exactly two typed variants

The auditor's output is `HardenedCheck | SemanticFinding`, never prose:

- **`HardenedCheck`** — a finding expressible as a usage-detectable, mechanizable check: the
  `PLATFORM_MIGRATIONS` shape (matcher + fix + version), verified by the host's `HardenedCheck` port
  (ADR-089). This is drift that can be *hardened into the deterministic floor* and thereafter caught
  without the model.
- **`SemanticFinding`** — a finding that is real but cannot yet be reduced to a mechanical check
  (an ADR whose prose the code contradicts in a way no matcher captures). It is reported for a human,
  and never silently promoted to a gate.

### 2. The typed schema is the model's output contract — three jobs at once

Constraining output to these two variants is the whole design, and it does three things
simultaneously:

- **Result format** — the shape the rest of the kernel consumes.
- **Anti-hallucination narrow-waist** — output that cannot be expressed as either variant is not
  emitted, so the model cannot invent a finding shape.
- **Precision filter** — a finding that fits *neither* variant is, by construction, either not real
  or not actionable. Forcing the choice is what discards the vague observations a free-text auditor
  would produce.

### 3. Detection is retrieval + judgment over durable, ADR-keyed provenance — not a fine-tune

The auditor is a retrieval index — ADR clauses × `implemented-by` code × ADR-keyed provenance —
feeding a judgment harness that emits the typed artifact. Provenance is **durable ADR-keyed
artifacts only**: commit bodies, PR descriptions, and issue threads that cite an ADR by number — not
raw transcripts. The evaluation is git-mined: reconstruct the pre-fix state from the history of an
`implemented-by` fix and confirm the auditor emits a `HardenedCheck` that fires on the affected
artifact. History labels the evaluation; nothing is fine-tuned, because the sample is tiny and the
corpus must stay current.

### 4. Audit-first, self-liquidating; never an all-clear

The auditor runs audit-first and reports **"N ranked suspected drifts," never "clean."** As
`HardenedCheck`s harden into the deterministic floor, the surface the auditor must judge shrinks —
the fuzzy layer self-liquidates into deterministic gates over time.

## Boundaries

- **The auditor never produces the floor.** It emits *candidate* checks; a `HardenedCheck` becomes a
  gate only after a human accepts it and it lands as plain, independently-tested code. This is
  PDR-010's Trusting-Trust guardrail: the deterministic gates that audit the kernel must never be
  authored by the fuzzy layer, or a kernel bug could blind its own self-audit. The self-host target
  is the audit, never the floor.
- **A `SemanticFinding` is not a weaker `HardenedCheck`.** It is not auto-promoted, not used to fail
  a build, and not a backdoor for the model to gate on prose. It is a flag for a human, full stop.
- **This is drift detection, not general governance.** The first and only capability is detecting
  drift between a decision and the code that carries it (PDR-010). Broader governance is out of scope.
- **No universality work.** The provenance shape and the two variants are tuned to SMT's own records;
  generalizing to a foreign domain waits for a real third consumer (ADR-089 draws the same line).

## Consequences

- **Better:** the loop ADR-082 left open at "a human notices" closes — the auditor proposes the typed
  entry — while the typed-output contract keeps the proposals precise enough to act on, and the
  self-liquidation means today's fuzzy judgment becomes tomorrow's deterministic gate.
- **Worse / the cost accepted:** a retrieval-plus-judgment auditor is stochastic, so its recall is
  bounded by the provenance it can retrieve and its precision by triage; it will miss real drift and
  surface false suspects, which is why it emits *ranked suspects* for a human and never an all-clear.
  Refusing to fine-tune trades peak accuracy for staying grounded and current at this sample size —
  a deliberate trade, revisited only if the corpus grows by an order of magnitude.

## References

- ADR-084 — generation targets the manifest, the same typed-artifact boundary this turns onto
  governance.
- ADR-082's migration entry — a `HardenedCheck` hardens into it.
- ADR-089 defines the `HardenedCheck` port this auditor's output lands on.
- ADR-085 — the external local model service that could host the auditor's judgment step.
- ADR-088 — the first-party coder plugin seam this reuses.
- PDR-010 — the kernel thesis, whose two instances (generation and governance) this unifies.
