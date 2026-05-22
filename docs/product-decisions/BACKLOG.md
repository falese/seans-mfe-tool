# PDR / ADR backlog

Tracked follow-ups from the PDR + ADR-register reverse-engineering pass. None of these
are committed work; they are candidates to promote when there is reason to.

## Candidate PDRs (not yet written)

| Candidate | Why it might matter | Likely linked ADRs |
| --------- | ------------------- | ------------------ |
| Observability-by-default | The lifecycle engine emits telemetry at every checkpoint with no manual instrumentation; this is a product stance (you cannot ship an un-observable MFE) worth its own record. | ADR-063–067 |
| BFF-from-manifest (data section *is* the Mesh config) | The manifest's `data:` section generates the GraphQL BFF; "no separate BFF config" is a product decision distinct from PDR-001. | ADR-046 (historical), ADR-062 |
| Generated-vs-developer ownership boundary | The `// GENERATED` / `// DEVELOPER-OWNED` marker model is the contract that makes safe regeneration possible; currently only described inside ADR-068. | ADR-068 |

## ADR follow-ups

- **Renumber PR #153 ADRs to 070–073** (see the reconciliation note in
  [`../architecture-decisions/README.md`](../architecture-decisions/README.md)). PR
  owner's edit; not done on this branch.
- **Promote PR #161 / #153 ADRs to "Active"** in the register on merge.

## Historical ADRs worth promoting to standalone files (only if revisited)

Referenced in the narrative `architecture-decisions.md` but never written as files. Worth
a standalone file **only if** the decision is reopened or a newcomer needs the rationale
in isolation:

- ADR-016 / ADR-017 — core orchestration
- ADR-036 / ADR-037 — lifecycle hook semantics (`mandatory` / `contained`)
- ADR-046 — GraphQL Mesh config embedded in the DSL
- ADR-047 / ADR-048 — DSL-first remote generation

## Out of scope this pass (tracked elsewhere)

- Backfilling the missing architecture sub-docs (`architecture-codegen.md`,
  `architecture-dsl.md`, `architecture-bff.md`, `architecture-api-generator.md`) —
  already noted in [`../PROJECT-STATUS.md`](../PROJECT-STATUS.md).
- Formalizing REQ-RUNTIME-001–012 as discrete requirement files (currently issue-only,
  #47–59).
