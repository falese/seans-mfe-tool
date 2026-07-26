# PDR / ADR backlog

Tracked follow-ups from the PDR + ADR-register effort. None of these are committed
work; they are candidates to promote when there is reason to.

## Candidate PDRs (not yet written)

| Candidate | Why it might matter | Likely linked ADRs |
| --------- | ------------------- | ------------------ |
| Observability-by-default | The lifecycle engine emits telemetry at every checkpoint with no manual instrumentation; this is a product stance (you cannot ship an un-observable MFE) worth its own record. | ADR-002, ADR-028–032, ADR-039 |
| BFF-from-manifest (data section *is* the Mesh config) | The manifest's `data:` section generates the GraphQL BFF; "no separate BFF config" is a product decision distinct from PDR-001. | ADR-012, ADR-027 |
| ~~Generated-vs-developer ownership boundary~~ | **Withdrawn (ADR-077 §1).** The marker model was never built and is not going to be: ownership is the `overwrite` flag on the generation plan, enforced by regenerate-and-diff gates rather than by header comments. | ADR-077, ADR-074 |
| TDD-always + structured logging as product invariants | ADR-037 (TDD-always) and ADR-039 (no `console.log`) are framed as engineering discipline; they have a product-level rationale (auditability, fitness-of-evidence for the agent-driven workflow) worth lifting. | ADR-037, ADR-039 |

## ADR follow-ups

- ~~**PR #153 (draft).**~~ Closed as a stale draft, not merged
  (`docs/RESTRUCTURE-PLAN.md` §2.1). The `shell:init` work it attempted is rewritten
  into `platform:init` under ADR-078.
- **PDR-005 promotion.** The old condition — "held until PR #153 lands" — became
  unreachable when #153 was closed, which is why PDR-005 sat at `Proposed` while
  twenty-odd ADRs implemented it. **New condition:** promote to `Accepted` once
  `platform:init` (ADR-078) can scaffold a composing shell plus control plane, and
  fill in its `Implemented by` with ADR-054/055/057/059/060 and ADR-066–073, which
  already carry it.

## What is no longer pending (resolved by PR #194)

- The historical ADRs 001–061 that used to be "referenced but unwritten" have been
  backfilled or absorbed into the sequential 001–040 set. The standalone-file gap is
  closed; [`docs/spec.md#adr-index`](../spec.md#adr-index) is the canonical index.
- The pre-remediation 068/069 numbering collision (PR #161 vs PR #153) is moot — PR
  #161 merged as **ADR-034**, and PR #153's renumber is captured under "ADR follow-ups".

## Out of scope this pass (tracked elsewhere)

- The architecture sub-docs referenced in `docs/architecture-current-state.md`
  (`architecture-codegen.md`, `architecture-dsl.md`, `architecture-bff.md`,
  `architecture-api-generator.md`) — already noted in
  [`../PROJECT-STATUS.md`](../PROJECT-STATUS.md).
- Formalizing REQ-RUNTIME-001–012 as discrete requirement files (currently issue-only,
  #47–59).
</content>
