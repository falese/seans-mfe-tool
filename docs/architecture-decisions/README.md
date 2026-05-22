# Architecture Decision Records — Register

This is the **canonical, navigable index** of ADRs. It is the source of truth for *which
ADRs exist, their status, and their number*. The long-form historical narrative lives in
[`architecture-decisions.md`](./architecture-decisions.md); this register supersedes it
**for navigation and numbering**.

> An ADR records *how* we build something. For *why we build it at all* (the product
> bet), see [`docs/product-decisions/`](../product-decisions/). A PDR is typically
> implemented by several ADRs.

## ⚠️ Numbering reconciliation (action required in open PRs)

Two open PRs independently claimed overlapping ADR numbers. Resolved numbering:

| Decision | Claimed in PR | Canonical number |
| -------- | ------------- | ---------------- |
| Two-headed giant developer model | (merged) | **ADR-068** — keep |
| Pluggable bundler / framework | PR #161 | **ADR-069** — keep |
| `shell:init` command | PR #153 (as 068) | **ADR-070** |
| Four-tier daemon-native control plane | PR #153 (as 069) | **ADR-071** |
| GraphQL/WS daemon transport protocol | PR #153 (as 070) | **ADR-072** |
| Component-type / MFE remote naming | PR #153 (as 071) | **ADR-073** |

**ADR-068 and ADR-069 are already taken** (merged ADR-068; PR #161 owns ADR-069). PR
#153 must renumber its four ADR files to **070–073** before merge, and update internal
cross-references (its PR title references "ADR-068–071"). This register reflects the
resolved numbers; the files in PR #153 do not yet. *(This is the PR owner's edit — not
made on the PDR/ADR-register branch.)*

## Active ADRs (file exists on `main`)

| ADR | Title | Status | File |
| --- | ----- | ------ | ---- |
| ADR-022 | Lifecycle re-entrancy guard in BaseMFE | Accepted | [ADR-022](./ADR-022-lifecycle-reentrancy-guard.md) |
| ADR-058 | Platform handler library | Accepted | [ADR-058](./ADR-058-platform-handler-library.md) |
| ADR-059 | Platform handler interface | Accepted | [ADR-059](./ADR-059-platform-handler-interface.md) |
| ADR-060 | Load capability (atomic) | Accepted | [ADR-060](./ADR-060-load-capability-atomic.md) |
| ADR-062 | Mesh v0.100 plugins | Accepted | [ADR-062](./ADR-062-mesh-v0100-plugins.md) |
| ADR-063 | Parallel handler execution | Proposed | [ADR-063](./ADR-063-parallel-execution.md) |
| ADR-064 | Timeout protection | Proposed | [ADR-064](./ADR-064-timeout-protection.md) |
| ADR-065 | Error classification | Proposed | [ADR-065](./ADR-065-error-classification.md) |
| ADR-066 | Conditional execution | Proposed | [ADR-066](./ADR-066-conditional-execution.md) |
| ADR-067 | Inter-hook communication | Proposed | [ADR-067](./ADR-067-inter-hook-communication.md) |
| ADR-068 | Two-headed giant — AI-native + human-legible DX | Accepted | [ADR-068](./ADR-068-two-headed-giant-developer-model.md) |

## In-flight ADRs (in open PRs, not yet on `main`)

| ADR | Title | PR | Branch |
| --- | ----- | -- | ------ |
| ADR-069 | Pluggable bundler / framework | [#161](https://github.com/falese/seans-mfe-tool/pull/161) | `claude/webpack-federated-module-class-dDMzf` |
| ADR-070 | `shell:init` command | [#153](https://github.com/falese/seans-mfe-tool/pull/153) | `copilot/orchestration-service-generation-shell` |
| ADR-071 | Four-tier daemon-native control plane | [#153](https://github.com/falese/seans-mfe-tool/pull/153) | `copilot/orchestration-service-generation-shell` |
| ADR-072 | GraphQL/WS daemon transport protocol | [#153](https://github.com/falese/seans-mfe-tool/pull/153) | `copilot/orchestration-service-generation-shell` |
| ADR-073 | Component-type / MFE remote naming | [#153](https://github.com/falese/seans-mfe-tool/pull/153) | `copilot/orchestration-service-generation-shell` |

## Historical / referenced-only (no standalone file)

ADRs **001–021, 023–057, and 061** are referenced in the narrative
[`architecture-decisions.md`](./architecture-decisions.md) and in
[`docs/requirements/TRACEABILITY.md`](../requirements/TRACEABILITY.md) (e.g. ADR-016/017
orchestration, ADR-036/037 lifecycle semantics, ADR-046 Mesh-from-DSL, ADR-047/048
DSL-first remote) but were never written as standalone files. They are **design-phase /
historical** decisions, considered superseded-or-absorbed by the active set above. They
are intentionally **not** backfilled in this pass; candidates worth promoting to
standalone files are tracked in
[`../product-decisions/BACKLOG.md`](../product-decisions/BACKLOG.md).

## PDR ↔ ADR mapping

| PDR | ADRs that implement it |
| --- | ---------------------- |
| PDR-001 — Generate, don't hand-write | ADR-022, ADR-060 |
| PDR-002 — Language-/framework-neutral contract | ADR-069 |
| PDR-003 — AI-native tooling | ADR-068, ADR-065 |
| PDR-004 — Plugin-first ecosystem | (packaging decisions; see `MERGE-PLAN.md`) |
| PDR-005 — Runtime composition | ADR-070, ADR-071, ADR-072, ADR-073 |
| PDR-006 — Ecosystem scaling thesis | composes PDR-001–005 |

## Conventions

- File name: `ADR-NNN-slug.md`. Numbers are unique and never reused.
- New ADRs take the next free number in this register — **check here before claiming a
  number** to avoid the 068/069 collision repeating.
- New ADR front matter follows [`ADR-068`](./ADR-068-two-headed-giant-developer-model.md)
  (id, title, status, date, deciders, tags, supersedes, superseded-by).
