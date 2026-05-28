# PDR / ADR backlog

Tracked follow-ups from the PDR + ADR-register effort. None of these are committed
work; they are candidates to promote when there is reason to.

## Candidate PDRs (not yet written)

| Candidate | Why it might matter | Likely linked ADRs |
| --------- | ------------------- | ------------------ |
| Observability-by-default | The lifecycle engine emits telemetry at every checkpoint with no manual instrumentation; this is a product stance (you cannot ship an un-observable MFE) worth its own record. | ADR-002, ADR-028–032, ADR-039 |
| BFF-from-manifest (data section *is* the Mesh config) | The manifest's `data:` section generates the GraphQL BFF; "no separate BFF config" is a product decision distinct from PDR-001. | ADR-012, ADR-027 |
| Generated-vs-developer ownership boundary | The `// GENERATED` / `// DEVELOPER-OWNED` marker model is the contract that makes safe regeneration possible; currently only described inside ADR-033. | ADR-033 |
| TDD-always + structured logging as product invariants | ADR-037 (TDD-always) and ADR-039 (no `console.log`) are framed as engineering discipline; they have a product-level rationale (auditability, fitness-of-evidence for the agent-driven workflow) worth lifting. | ADR-037, ADR-039 |

## ADR follow-ups

- **PR #153 (draft).** Its original ADRs (068–071) were invalidated by the ADR library
  remediation (PR #194), which renumbered everything 001–040. When PR #153 is ready,
  its ADR files need fresh numbers from the next free slot in
  [`docs/spec.md#adr-index`](../spec.md#adr-index), and its PR title and body need to
  drop the stale "ADR-068–071" wording. After merge, promote PDR-005 to **Accepted**
  and fill in its `Implemented by` ADR references.
- **PDR-005 promotion.** Held until PR #153 lands.

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
