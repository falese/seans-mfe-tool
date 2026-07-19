# Product Decision Records (PDRs)

A PDR records a **product-level** decision: *what we are building and why it is the right bet for the problem*. PDRs capture the problem space, who feels the pain, the bet we are making, and how we will know it worked.

PDRs sit above ADRs and requirements:

| Layer | Question it answers | Location | Example |
| ----- | ------------------- | -------- | ------- |
| **PDR** | *What do we build, and why is it worth building?* (product / strategy) | `docs/product-decisions/` | "Generate MFEs from a manifest instead of hand-writing them" |
| **ADR** | *How do we build it?* (architecture / technical) | `docs/architecture-decisions/` | "Lifecycle re-entrancy guard in BaseMFE" |
| **REQ** | *What exactly must it do to be accepted?* (acceptance detail) | `docs/requirements/` | "REQ-057: BaseMFE boilerplate codegen" |

A single PDR is typically implemented by several ADRs, which are in turn detailed by several REQs. See `docs/requirements/TRACEABILITY.md` for the full chain.

## How PDRs differ from ADRs in practice

- An ADR is reversible by a follow-up ADR and lives close to the code. A PDR is a **strategic bet** — reversing it usually means re-architecting, not just refactoring.
- ADRs answer reviewers. PDRs answer the question "why does this project exist and where is it going" — the framing a teammate needs before any of the ADRs make sense.
- When the problem space itself shifts, write a new PDR. When the implementation approach shifts, write a new ADR.

## Register

| PDR | Title | Status | Implemented by |
| --- | ----- | ------ | -------------- |
| [PDR-001](./PDR-001-generate-dont-handwrite.md) | Generate MFEs from a manifest; don't hand-write them | Accepted | REQ-057, codegen, `BaseMFE`; ADR-001/002/003/004/005, ADR-013, ADR-026, ADR-040 |
| [PDR-002](./PDR-002-language-neutral-platform-contract.md) | One language- and framework-neutral platform contract | Accepted | ADR-034, ADR-036, polyglot stubs |
| [PDR-003](./PDR-003-ai-native-tooling.md) | AI-native, agent-operable tooling | Accepted | ADR-033, ADR-016/017/018, ADR-019, ADR-030 |
| [PDR-004](./PDR-004-plugin-first-ecosystem.md) | Plugin-first federated ecosystem (not monorepo-first) | Accepted | ADR-022, ADR-021, ADR-015, `MERGE-PLAN.md` |
| [PDR-005](./PDR-005-runtime-composition.md) | Runtime composition via shell + daemon control plane + registry | Proposed | PR #153 (draft); ADRs pending merge |
| [PDR-006](./PDR-006-ecosystem-scaling-thesis.md) | Ecosystem scaling thesis | Proposed | Composes PDR-001–005; see `CLAUDE.md` "What this project is" |
| [PDR-007](./PDR-007-model-messy-reality.md) | Reference apps model messy reality | Accepted | Overlapping, inconsistent APIs are the point; born from the Meridian Station build (#276) |

## Conventions

- File name: `PDR-NNN-slug.md` (mirrors `REQ-NNN-slug.md` and `ADR-NNN-slug.md`).
- Front matter and section structure: see [`_TEMPLATE.md`](./_TEMPLATE.md).
- Numbers are unique and never reused. Superseding PDRs link forward and backward via `supersedes` / `superseded-by`.
- Deferred / candidate PDRs live in [`BACKLOG.md`](./BACKLOG.md) until promoted.
