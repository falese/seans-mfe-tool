---
id: 0001
title: Generate MFEs from a manifest; don't hand-write them
status: Accepted
date: 2026-05-21
deciders: [sean]
supersedes: []
superseded-by: []
tags: [codegen, dsl, contract, consistency]
summary: A single declarative manifest is the source of truth for every MFE; a code generator plus a shared base class produce and enforce the platform contract, so developers own only domain logic, not boilerplate.
---

# PDR-001: Generate MFEs from a manifest; don't hand-write them

## Problem space

Every MFE on the platform must implement the same surface: the 10-capability contract,
a lifecycle (`before → main → after → error`) around each capability, a state machine,
telemetry checkpoints, a Module Federation build config, and — when it has data — a
GraphQL BFF. Hand-writing that surface per MFE produces three failure modes that get
worse with every team that joins:

- **Boilerplate drift.** Two MFEs written a month apart implement `load()`, telemetry
  event names, or shared-dependency versions slightly differently. The shell and daemon
  then have to tolerate the differences, and "tolerate the differences" is where
  integration bugs live.
- **Silent contract gaps.** A hand-written MFE that forgets `health()` or returns the
  wrong `render()` shape compiles fine and fails only at runtime, inside someone else's
  composition.
- **Boilerplate tax on the wrong people.** Domain engineers spend their first day
  re-deriving plumbing that the platform team already solved, instead of building the
  feature they were hired to build.

The pain is felt by domain teams (who pay the boilerplate tax), by the platform team
(who debug the drift), and increasingly by AI agents scaffolding MFEs at a rate no
human reviewer can hand-audit.

## Decision

The **manifest (`mfe-manifest.yaml`) is the single source of truth** for an MFE. A code
generator turns it into the full project, and a shared abstract base class
(`BaseMFE`) enforces the contract at runtime. Generated, contract-bearing files are
owned by the tool and regenerated freely; developers own only `src/features/**` and the
domain logic inside it. The manifest declares *what the MFE is and what it provides*;
the generator and base class guarantee *that it complies*.

## Why this over alternatives

- **Conventions + a starter template (rejected).** A `create-mfe` template that teams
  copy and edit gives a good day one, but the copies diverge immediately and there is no
  mechanism to re-converge them. Drift is reintroduced the moment the template is
  cloned.
- **A runtime framework with no codegen (rejected).** A pure base class without
  generation still leaves every team hand-wiring build config, BFF, and capability
  stubs. The base class enforces *behavior* but not *project shape*; both have to be
  guaranteed for the contract to hold end-to-end.

Manifest-driven generation is the only option that makes the contract the *default* and
non-compliance the *exception*, rather than the reverse.

## Success signals

- A new MFE goes from manifest to a building, contract-compliant project with zero
  hand-written plumbing.
- Regenerating an existing MFE after a platform contract change updates every generated
  file without touching `DEVELOPER-OWNED` code.
- The shell and daemon make no per-MFE special cases — every remote presents the same
  contract because it was generated from the same generator.

## Consequences / trade-offs

- **Positive:** The platform contract is enforced by construction. Domain teams write
  domain code. Contract upgrades are a regeneration, not a migration project per team.
- **Positive:** The manifest is a stable, reviewable, machine-writable boundary —
  which is exactly what makes PDR-003 (AI-native tooling) possible.
- **Negative:** The generator becomes a critical dependency: a generator bug ships to
  every MFE. This is mitigated by treating generated vs. developer-owned files
  explicitly (`// GENERATED` / `// DEVELOPER-OWNED` markers per ADR-033) and by test
  coverage on the generator itself.
- **Neutral:** Anything the manifest cannot yet express must either extend the manifest
  schema or live in developer-owned files. The schema is the negotiation surface for new
  capabilities.

## Implemented by

- Requirements: REQ-057 (BaseMFE boilerplate codegen from DSL), REQ-042–058 (DSL schema,
  parser, validator, type system).
- Code: `src/dsl/schema.ts` (Zod manifest schema),
  `src/codegen/UnifiedGenerator/unified-generator.ts` (`generateAllFiles`),
  `src/codegen/templates/` (EJS templates), `packages/runtime/src/` (`BaseMFE`).
- ADRs: ADR-001 (lifecycle re-entrancy guard in `BaseMFE`), ADR-002 (lifecycle hook
  execution model), ADR-003 (no custom lifecycle phases), ADR-004 (handler array
  support), ADR-005 (handler discovery convention), ADR-009 (`language` field →
  template selection), ADR-013 (generated MFE test templates), ADR-026 (load capability
  — atomic operation), ADR-040 (manifest-declared handler sources).
- Related: PDR-002 (the contract being enforced), PDR-003 (the manifest as the AI's
  interface).
