---
id: 0088
title: The coder-facing seam is a first-party in-repo plugin; coder's model engine stays external
status: Proposed
date: 2026-08-29
deciders: [sean]
area: Architecture / plugins / AI
enforcement: convention
tags: [coder, plugin, first-party, seam, generative, mlx, namespace]
relates-to: [22, 85, 21, 19, 78, 87]
supersedes: []
superseded-by: []
implements-pdr: [4, 9]
implemented-by: []
verified-by: []
tracked-by: ["#364", "#365"]
summary: >-
  The coder-facing surface — the `coder:*` commands, the intent-compilation contract, and the
  DSL eval oracle — becomes a first-party in-repo workspace package, `@seans-mfe/coder-plugin`
  (`packages/coder-plugin`), wired through the root `oclif.plugins` exactly as
  `@falese/bff-plugin` is. It depends on `@seans-mfe/contracts` and `@seans-mfe/dsl`. coder's
  model, training, serving, and adaptors remain an external Bun + MLX service invoked
  out-of-process (ADR-085/ADR-019), so no ML toolchain enters this repo or its CI. The split
  ADR-022 never drew is now explicit: the seam is first-party `@seans-mfe/*`; the engine is
  external `@falese/coder`.
rationale-summary: >-
  ADR-085 already put the intent-compilation contract and the `coder:*` wrapper on the platform
  side, and ADR-022's 2026-07-01 amendment already established in-repo first-party plugins
  (`@falese/bff-plugin` at `packages/bff-plugin`, listed in root `oclif.plugins`). Promoting the
  seam to that same in-repo package shape makes it first-party where it belongs and — the
  concrete payoff — lets its eval oracle import `@seans-mfe/dsl` directly as a workspace
  dependency, resolving the coupling that otherwise needed the unpublished package, a shell-out,
  or a duplicated schema. Keeping the model engine external preserves PDR-008/ADR-078 (no ML
  runtime in the platform) and the independent release cadence PDR-004 wants.
long-form: true
---

# ADR-088: The coder-facing seam is a first-party in-repo plugin; coder's model engine stays external

## Context

ADR-085 established that intent-compilation is invoked out-of-process against coder, with the
contract on the platform side and a thin `coder:*` wrapper in this repo. It left open *where*
that wrapper lives. Two facts settle it:

1. **The precedent exists.** ADR-022's 2026-07-01 amendment already generalized the plugin
   contract to in-repo workspace members: `@falese/bff-plugin` lives at `packages/bff-plugin`,
   declares `bff:*` commands, depends on `@seans-mfe/*` packages, and is loaded by listing it in
   the root `oclif.plugins` as `file:packages/bff-plugin`.
2. **A concrete coupling needs resolving.** The intent-manifest adaptor's eval oracle
   (`docs/coder-intent-manifest-adaptor-spec.md` §6, issue #364) must reach the DSL validator
   (`@seans-mfe/dsl`), which coder does not depend on and which is not yet published. Left in the
   external coder repo, the oracle needs a publish, a shell-out, or a duplicated schema.

Making the seam a first-party in-repo package solves both at once and does not disturb the
resolved decision that coder's *engine* stays external (PDR-008, ADR-078, ADR-022 as narrowed).

## Decision

### 1. The seam is `@seans-mfe/coder-plugin` at `packages/coder-plugin`

A first-party workspace package holds the coder-facing surface: the `coder:*` command(s)
(extending `BaseCommand` from `@seans-mfe/oclif-base`, ADR-016), the typed intent-compilation
contract (ADR-085 §1), and the DSL eval oracle. It is loaded exactly like `@falese/bff-plugin` —
listed in the root `oclif.plugins` as `file:packages/coder-plugin`, built with the other
workspace packages. Namespace is `@seans-mfe/*` (ADR-021), because it is now platform-owned.

### 2. The model engine stays external and out-of-process

coder's model, training (`coder train`), serving (`coder serve`), and adaptors remain the
external Bun + MLX service. The plugin invokes it out-of-process (subprocess / local SSE, ADR-085
§1, ADR-019). **No model, weights, MLX, or Python enters this repo or its CI.** The external
engine keeps its `@falese/coder` identity.

### 3. The eval oracle depends on `@seans-mfe/dsl` directly

Because the plugin is in-repo, its oracle imports `validateFull` / `parseAndValidateDirectory`
from `@seans-mfe/dsl` as a workspace dependency — the source of truth, no publish gate, no
shell-out, no duplicated schema. This is the concrete coupling ADR-085 left unresolved.

## Boundaries

- This does **not** reverse PDR-008/ADR-078 or bring coder's engine in-repo — only the seam
  moves. The full monorepo merge (MERGE-PLAN Phase 2) is still a separate, later question.
- It narrows ADR-022's "`@falese/coder` ships as an oclif plugin": the *plugin* is now
  first-party `@seans-mfe/coder-plugin`; the *engine* is the external `@falese/coder` service.
- It does not choose the base model, tuning method, or serving runtime — those stay coder's.

## Consequences

- **Better:** the seam is first-party and testable in this repo's CI; the eval-oracle coupling
  dissolves (direct `@seans-mfe/dsl` dep); the contract gains a real home and test surface;
  reuses the proven `bff-plugin` in-repo pattern rather than inventing one.
- **Worse / the cost accepted:** another workspace package to build (the `bff-plugin` tax —
  `build:packages` + oclif manifest before its topic resolves), and wiring it touches shared
  files (root `package.json` `oclif.plugins`, `tsconfig`, `turbo.json`). Cross-repo coordination
  with the external engine remains — but now the contract it must satisfy lives first-party.

## References

- ADR-022 — plugin-first architecture and its 2026-07-01 in-repo amendment (`@falese/bff-plugin`
  at `packages/bff-plugin`); the pattern this reuses and the premise it narrows.
- ADR-085 — coder invoked as an external local model service; this makes its `coder:*` wrapper a
  concrete first-party package and resolves its open eval-oracle coupling.
- ADR-021 — `@seans-mfe/*` (platform) vs `@falese/*` (third-party) namespaces; the seam is now
  the former, the engine the latter.
- ADR-019 — child-process isolation; the out-of-process model the plugin uses to reach the engine.
- ADR-078 — the control plane moved into the platform but coder stayed external; the engine still does.
- PDR-004 — plugin-first federated ecosystem; PDR-009 — the generative software system.
- #364 — the intent→manifest adaptor whose eval oracle this seam hosts.
- #365 — the build target: scaffold `@seans-mfe/coder-plugin` per this decision.
