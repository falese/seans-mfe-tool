---
id: 0022
title: Plugin-first architecture — falese/daemon and falese/coder as oclif plugins
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [plugin-architecture, oclif, monorepo, daemon, coder]
summary: The daemon and coder toolsets ship as separate oclif plugins depending on @seans-mfe/contracts rather than being merged into this monorepo; monorepo consolidation is a later phase.
rationale-summary: Merging prematurely would entangle release cycles; keeping them as oclif plugins lets them evolve independently while sharing the contracts package, and validates the plugin model before committing to consolidation.
long-form: false
---

# ADR-022: Plugin-first architecture — falese/daemon and falese/coder as oclif plugins

## Context

During MERGE-PLAN.md planning, the question arose: should `falese/daemon` and `falese/coder` be merged into this monorepo immediately? The decision was to defer merging and instead validate the plugin model first.

## Decision

`falese/daemon` and `falese/coder` remain separate repositories and ship as oclif plugins:

- They declare `@seans-mfe/contracts` as a peer dependency
- They install into `seans-mfe-tool` via `seans-mfe-tool plugins install @falese/plugin-daemon`
- They add their commands to the `daemon:*` and `coder:*` topics (reserved in ADR-015)
- Monorepo consolidation happens in MERGE-PLAN.md Phase 2 — only after the plugin contract is proven stable

This is a deliberate "plugin-first, merge-later" strategy.

## Consequences

**Positive:**
- Release cycles are decoupled — daemon/coder can ship hotfixes without a platform release
- Plugin model is validated on real use cases before consolidation
- Any third-party developer can follow the same pattern to extend the tool

**Negative:**
- Cross-cutting changes (e.g. contracts interface changes) require coordinated updates across repos
- Plugin install/uninstall UX adds friction compared to a monorepo

## Amendment (2026-07-01) — the pattern generalizes to *any* plugin, including in-repo ones

The plugin contract this ADR validates is not limited to external repos. **Any**
command bundle — external (`falese/daemon`, `falese/coder`, installed via
`seans-mfe-tool plugins install`) or in-repo (a `packages/*` workspace member) —
follows the same oclif-plugin shape:

- it declares its commands via its own `package.json` `oclif.commands` (→ its
  built `dist/commands`) and reserves a topic;
- it depends on `@seans-mfe/contracts` (and other `@seans-mfe/*` packages) rather
  than reaching into the CLI's internals; it extends `BaseCommand` from
  `@seans-mfe/oclif-base`, not the CLI's local shim;
- the host CLI loads it — external plugins through the user plugin cache,
  **in-repo plugins by listing them in the root `oclif.plugins`** (a `file:`
  workspace dependency).

`@falese/bff-plugin` is the first in-repo application: `bff:init/dev/build/validate`
live in `packages/bff-plugin/src/commands/bff/` (D4, #126–130). One consequence
of in-repo plugins: **the plugin must be built** (`tsc` + `oclif manifest`) for
its commands to resolve — even in dev, where the core CLI runs from source via
`bun bin/dev.ts`, oclif loads a linked plugin from its `dist/commands`. Building
the workspace packages (`npm run build:packages` + the plugin's manifest) is
therefore a prerequisite for the plugin's topic to appear.

## References

- `MERGE-PLAN.md`
- ADR-015: oclif migration (topic reservation)
- ADR-021: Package namespace strategy
