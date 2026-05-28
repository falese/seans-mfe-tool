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

## References

- `MERGE-PLAN.md`
- ADR-015: oclif migration (topic reservation)
- ADR-021: Package namespace strategy
