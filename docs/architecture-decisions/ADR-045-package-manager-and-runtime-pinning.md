---
id: 0045
title: Package Manager and Local Runtime Pinning
status: Proposed
date: 2026-05-28
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [tooling, package-manager, node, reproducibility, gap]
summary: Standardize the contributor toolchain on a single package manager and an explicit local Node runtime pin so workspace installs, builds, and release tasks are reproducible outside CI.
rationale-summary: The repository currently declares npm as its package manager, also carries a pnpm workspace file, and tests multiple Node versions in CI without pinning one locally. That combination is workable for one maintainer but scales poorly and makes local behavior ambiguous.
long-form: true
---

# ADR-045: Package Manager and Local Runtime Pinning

## Context

The repository declares `npm@10.8.1` as its package manager in [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3), but also carries a pnpm workspace definition in [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml). CI installs with `npm ci` in [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L27) and validates on Node 20.x and 22.x in [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L14), yet the repository does not pin a local Node version via `.nvmrc`, `.node-version`, or equivalent.

That leaves contributors to infer the intended local toolchain from a mix of package manager declarations, workspace files, and CI behavior.

## Decision Drivers

- Reproducible contributor setup matters for a multi-package toolchain repo.
- CI and local development should agree on the default package manager.
- Runtime-sensitive tooling such as oclif, TypeScript, and Playwright benefits from a pinned default Node line.
- The decision should minimize disruption to the existing build and release scripts.

## Considered Options

### Option 1: Standardize on npm workspaces and remove pnpm workspace metadata

Pros:
- Matches the current `packageManager` declaration and CI usage.
- Minimizes immediate workflow churn.
- Keeps contributor commands aligned with existing docs and scripts.

Cons:
- Gives up pnpm-specific workspace ergonomics unless reintroduced later.
- Requires explicit cleanup of conflicting workspace metadata.

### Option 2: Standardize on pnpm and change CI and docs accordingly

Pros:
- Better monorepo ergonomics and deterministic workspace installs.
- Aligns with the existing `pnpm-workspace.yaml` file.

Cons:
- Conflicts with current `packageManager` declaration and CI implementation.
- Requires broader script and documentation changes immediately.

### Option 3: Keep both and document them as equivalent

Pros:
- Lowest short-term change cost.

Cons:
- Preserves ambiguity and divergent lockfile/runtime behavior.
- Makes enforcement and onboarding weaker.

## Decision Outcome

Choose Option 1 for the current repo state.

The repository standard is:
- `npm` is the authoritative package manager for contributor, CI, and release workflows.
- The repository must pin a default local Node line using a checked-in runtime version file.
- Any leftover pnpm-specific workspace metadata must either be removed or explicitly documented as non-authoritative transitional scaffolding.

### Consequences

Positive:
- One contributor story for install, build, test, and release.
- Faster onboarding and less accidental drift between local and CI.
- Clearer enforcement surface for scripts and docs.

Negative:
- If the project later wants pnpm as the real standard, this ADR will need supersession rather than quiet drift.
- Contributors already using pnpm will need to switch for authoritative workflows.

Neutral:
- CI may still test multiple Node lines, but one line becomes the documented local default.

## Validation / Enforcement

Primary mechanism:
- CI gate that verifies the declared package manager, runtime pin file, and contributor docs are consistent.

Secondary mechanism:
- Repository scaffolding and docs updates so new contributors default to the pinned Node line and npm commands.

Detection latency:
- PR

Owner:
- Platform maintainer

Exception process:
- Open a new ADR or superseding ADR if the project wants to migrate to pnpm or another toolchain standard.

Autofix possible?
- Partial. Adding or updating `.nvmrc` and documentation is automatable; policy disagreements are not.

## References

- [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3)
- [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml)
- [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L14)
- [MERGE-PLAN.md](/Users/sean/Documents/Development/seans-mfe-tool/MERGE-PLAN.md)
