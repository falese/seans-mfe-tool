---
id: 0002
title: One language- and framework-neutral platform contract
status: Accepted
date: 2026-05-21
deciders: [sean]
supersedes: []
superseded-by: []
tags: [contract, polyglot, federation, framework]
summary: The platform's stable interface is the 10-capability contract, not a framework or language; React, Angular, and polyglot MFEs are siblings that implement the same contract, so framework and bundler choices never fork the platform.
---

# PDR-002: One language- and framework-neutral platform contract

## Problem space

A platform that hard-codes a single UI framework and bundler — here, React + rspack —
forces every team onto that stack or out of the ecosystem. Two things make that
untenable as the platform grows:

- **Teams arrive with their own stacks.** An Angular team, a team with a Go or Python
  service that wants to expose UI, or a team mid-migration cannot adopt a React-only
  tool without rewriting first. The realistic outcome is a **fork** of the tool per
  stack — and forks drift apart until "the platform" is a name, not a guarantee.
- **Frameworks churn.** Betting the platform's identity on today's framework means the
  next framework migration is a platform migration. The thing that should be stable —
  how MFEs are discovered, loaded, rendered, authorized, and observed — gets dragged
  along with a UI-layer decision that has a much shorter half-life.

The pain is felt by any team whose stack is not the blessed one, and by the platform
team the day they want to change the blessed stack.

## Decision

The platform's stable interface is the **10-capability contract**
(`describe, load, render, refresh, query, schema, authorizeAccess, health, emit,
updateControlPlaneState`) defined in `PLATFORM-CONTRACT.md` — *not* a framework, a
bundler, or a language. Any MFE that implements the contract is a first-class member of
the ecosystem. Framework and bundler are **implementation details** carried as optional
manifest fields; the daemon, registry, shell, and other MFEs interact only through the
contract and never with framework specifics.

## Why this over alternatives

- **One blessed stack, fork for others (rejected).** Simplest to build, but guarantees
  divergence: every fork re-implements the contract slightly differently and the
  composition guarantees evaporate.
- **A subclass per framework off a shared concrete base (rejected).** Sharing a concrete
  `RemoteMFE` between React and Angular over-fits the base to today's two frameworks and
  drags React-flavored Module Federation assumptions into Angular. Instead, framework
  runtimes are **siblings** that each extend the abstract `BaseMFE` directly
  (`AngularRemoteMFE extends BaseMFE`, not `extends RemoteMFE`).

## Success signals

- An Angular MFE and a React MFE mount in the **same shell**, through the same
  `mfe.render()` lifecycle, with **identical telemetry checkpoint names**, so consumers
  stay framework-agnostic. (Demonstrated by PR #161.)
- Adding a new framework or bundler is a new sibling runtime + a template variant — not
  an edit to existing MFEs and not a fork of the tool.
- The same manifest capability (e.g. a BFF) produces the same `server.ts` + Mesh config
  regardless of the MFE's framework.

## Consequences / trade-offs

- **Positive:** Framework and bundler decisions are local and reversible; the platform
  contract outlives them. Polyglot stubs (TypeScript, Python, Go, Rust) prove the
  contract is genuinely language-neutral, not just framework-neutral.
- **Positive:** The contract — not a codebase — is the thing teams integrate against,
  which is what lets independent teams ship independently (see PDR-004).
- **Negative:** "Sibling, not subclass" means some structurally similar code is
  duplicated across runtimes (e.g. the three-phase `doLoad`) rather than shared. This is
  an accepted cost to avoid a wrong abstraction; the parity contract is held by tests
  asserting identical telemetry event names, not by a shared superclass.
- **Negative:** Shared-singleton hazards move to the shell (e.g. two Angular remotes need
  the shell to declare `@angular/*` singletons). The contract is neutral; runtime
  dependency coordination still needs care.

## Implemented by

- ADRs: ADR-069 (pluggable bundler/framework — optional `framework` / `bundler` manifest
  fields, React+rspack default preserved).
- Code / PRs: PR #161 (`src/runtime/angular-remote-mfe.ts`, `src/codegen/templates/base-mfe-angular/`,
  `remote:init-angular`); `src/runtime/base-mfe.ts` (the abstract contract); `PLATFORM-CONTRACT.md`
  (the 10 capabilities); `examples/polyglot-stubs/{python,go,rust}/`.
- Related: PDR-001 (codegen enforces the contract), PDR-005 (the runtime that composes
  framework-neutral MFEs).
