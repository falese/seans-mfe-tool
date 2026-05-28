---
id: 0004
title: Plugin-first federated ecosystem (not monorepo-first)
status: Accepted
date: 2026-05-21
deciders: [sean]
supersedes: []
superseded-by: []
tags: [ecosystem, plugins, federation, packaging]
summary: Independent tools (CLI, daemon, coder) ship as oclif plugins depending on shared contract packages, with the CLI as the integration hub; monorepo consolidation is a later, reversible phase rather than a prerequisite.
---

# PDR-004: Plugin-first federated ecosystem (not monorepo-first)

## Problem space

The platform is more than one tool. The CLI (`seans-mfe-tool`), the daemon
(`Falese/daemon`, a long-running control-plane process), and the coder (`Falese/coder`)
each have a different release cadence, runtime, and owner. The instinct when unifying
them is to merge into one monorepo first. But forcing the merge up front:

- **Breaks independent deployment** — the long-running daemon and the short-lived CLI
  cannot share a release train without coupling unrelated risk.
- **Blocks shipping on agreement** — every team has to converge on one lint / TS / test
  baseline *before any new feature lands*.
- **Couples the npm publish surface** of the shared contract packages to a migration
  that has not happened yet.

The pain is felt by every team that wants to ship this quarter and is told to wait for a
consolidation that serves a future quarter.

## Decision

**Plugin-first.** The shared contract lives in published packages (`@seans-mfe/contracts`,
`@seans-mfe/oclif-base`). The daemon and coder ship as **oclif plugins** that depend on
those packages; the CLI is the **integration hub** that hosts them. Agents reach the
whole ecosystem through `seans-mfe-tool mcp serve`, which **federates tools** from local
commands, installed plugins, and remote MCP servers. Monorepo consolidation is a later
phase with explicit prerequisites — and it stays reversible because plugins integrate
through published contracts, not shared source.

## Why this over alternatives

- **Monorepo-first (rejected for now).** Real benefits (atomic refactors, one build
  graph) but pays them by blocking all three teams on a single baseline and breaking
  independent deploy cadence. Deferred to Phase 2 of `MERGE-PLAN.md`, gated on contract
  stability ≥30 days.
- **Fully independent repos with no shared contract (rejected).** No merge pain, but no
  unification either — every integration is bespoke and the "platform" is a convention,
  not a guarantee.

## Success signals

- `@falese/daemon-plugin` passes `plugins link` + the `--json` envelope test, and
  `@falese/coder-plugin` passes the MCP federation test — both against the published
  contracts, without a monorepo.
- A new tool joins the ecosystem by publishing a plugin against `@seans-mfe/contracts`,
  with no change to the CLI.
- The merge to a monorepo, when it happens, is a packaging change — not a contract
  change — because integration was always through published contracts.

## Consequences / trade-offs

- **Positive:** Teams ship on their own cadence today; unification is incremental and
  reversible. The contract packages, not a shared tree, are the integration surface.
- **Positive:** Namespacing is explicit — `@seans-mfe/*` for shared platform packages,
  `@falese/*` for third-party plugins — so ownership is legible from the package name.
- **Negative:** Cross-tool refactors are harder than in a monorepo (version bumps and
  publishes instead of one commit). Accepted until Phase 1 success criteria are met.
- **Negative:** Requires real release discipline now (semver, CHANGELOGs, green CI per
  repo) — the same discipline that is later the *prerequisite* for the merge.

## Implemented by

- ADRs: **ADR-022** (plugin-first architecture — `falese/daemon` and `falese/coder` as
  oclif plugins depending on `@seans-mfe/contracts`, monorepo merge deferred), ADR-021
  (package namespace strategy — `@seans-mfe/*` shared, `@falese/*` plugins), ADR-015
  (oclif as the CLI framework that makes the plugin model work), ADR-019 (MCP
  child-process isolation — how a federated tool surface stays concurrency-safe).
- Docs: `MERGE-PLAN.md` (the phased, reversible path and Phase 1 success criteria),
  `PLUGIN-CONTRACT.md`.
- Code: `packages/contracts/`, `packages/oclif-base/`, `examples/plugin-skeleton/`,
  `src/mcp/` (federated tool registry), `pnpm-workspace.yaml`, `turbo.json`.
- Related: PDR-002 (framework plugins ride on this same substrate via ADR-036),
  PDR-003 (MCP federation is how agents consume the ecosystem), PDR-006 (the packaging
  substrate the ecosystem scales on).
