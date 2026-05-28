---
id: 0021
title: Package namespace strategy — @seans-mfe/* vs @falese/*
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [packages, namespace, oclif, monorepo, plugin-architecture]
summary: Shared platform packages use the @seans-mfe/* namespace (contracts, oclif-base, runtime, framework-*); third-party and personal plugins use the @falese/* namespace.
rationale-summary: A single namespace for both platform packages and plugins would conflate tool internals with community extensions; separate namespaces make dependency direction and ownership clear.
long-form: false
---

# ADR-021: Package namespace strategy — @seans-mfe/* vs @falese/*

## Context

After extracting `@seans-mfe/contracts` and `@seans-mfe/oclif-base` (Phase 1 of MERGE-PLAN.md), and with `falese/daemon` and `falese/coder` planned as separate oclif plugins, a clear namespace policy was needed to avoid confusion about what is "platform" and what is "plugin".

## Decision

Two permanent namespaces:

| Namespace | Purpose | Examples |
|---|---|---|
| `@seans-mfe/*` | Platform packages published from this monorepo | `@seans-mfe/contracts`, `@seans-mfe/oclif-base`, `@seans-mfe/runtime`, `@seans-mfe/framework-react`, `@seans-mfe/framework-angular` |
| `@falese/*` | Personal / third-party oclif plugins that depend on `@seans-mfe/contracts` | `@falese/plugin-daemon`, `@falese/plugin-coder` |

Any community-contributed framework plugin or capability adaptor that ships outside this repo should use `@falese/*` or their own scope — not `@seans-mfe/*`.

## Consequences

**Positive:**
- Clear signal: anything `@seans-mfe/*` is part of the platform contract
- Plugins under `@falese/*` can evolve independently without platform versioning constraints

**Negative:**
- Renaming packages if the tool is rebranded requires a major migration

## References

- `MERGE-PLAN.md` (Phase 1: publish @seans-mfe/contracts + @seans-mfe/oclif-base)
- ADR-022: Plugin-first architecture
