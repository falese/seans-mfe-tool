---
id: 0049
title: Release, Versioning, and Publish Automation
status: Proposed
date: 2026-05-28
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [release, versioning, publishing, packages, gap]
summary: First-party packages and the CLI must move from informal release intent to an explicit automated release workflow with changelog generation, versioning rules, and publish gates tied to the repository's quality checks.
rationale-summary: The repository documents phased publish intent and semver expectations, but it does not yet encode a release workflow, changelog policy, or publish automation. As the package set matures, that gap becomes an architectural and operational risk.
long-form: true
---

# ADR-049: Release, Versioning, and Publish Automation

## Context

The repository already behaves like a multi-package platform codebase. It includes shared packages such as contracts and oclif-base, framework plugins, and a plugin-oriented CLI. The strategic intent to publish packages is documented in [MERGE-PLAN.md](/Users/sean/Documents/Development/seans-mfe-tool/MERGE-PLAN.md), and semver expectations are described in project docs, but there is no publish workflow in [.github/workflows](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows), no checked-in changelog policy, and no automated release orchestration.

That keeps release discipline in tribal knowledge rather than in executable process.

## Decision Drivers

- First-party packages should have predictable versioning and publication behavior.
- Release process should reuse the repository's existing quality gates instead of bypassing them.
- Consumers need compatibility signals stronger than informal notes.

## Considered Options

### Option 1: Add an automated release workflow with changelog generation and publish gates

Pros:
- Makes package publishing repeatable and auditable.
- Couples release eligibility to existing test, lint, typecheck, and build expectations.
- Supports long-term multi-package ecosystem goals.

Cons:
- Requires setup and operational ownership.

### Option 2: Keep manual version bumps and publish steps documented in prose

Pros:
- Minimal immediate implementation work.

Cons:
- Easy to bypass or apply inconsistently.
- Hard to scale as package count grows.

### Option 3: Delay all release policy until external publication starts

Pros:
- Avoids early process investment.

Cons:
- Allows package semantics and compatibility expectations to drift before the first public release.

## Decision Outcome

Choose Option 1.

The repository standard is:
- Releases must run through an automated workflow that depends on green quality checks.
- Version changes and changelog generation must be explicit and reviewable.
- Publishable packages must declare clear release eligibility and artifact boundaries.

### Consequences

Positive:
- Stronger compatibility signaling for internal and future external consumers.
- Lower risk of publishing unverified artifacts.
- Better alignment between package strategy and ecosystem goals.

Negative:
- Requires bootstrapping release automation and maintaining credentials/secrets for publish paths.
- Adds process before the project is fully externally published.

Neutral:
- The specific release tool may change later; this ADR governs the release discipline, not a single vendor.

## Validation / Enforcement

Primary mechanism:
- CI-driven release workflow that blocks on lint, typecheck, tests, build, and schema consistency.

Secondary mechanism:
- Changelog generation and release-note review in PRs touching publishable packages.

Detection latency:
- PR and release time

Owner:
- Platform maintainer

Exception process:
- Manual hotfix publishing is allowed only with a tracked follow-up to reconcile version metadata and changelog output.

Autofix possible?
- Partial. Version file and changelog generation are automatable; release readiness decisions are not.

## References

- [MERGE-PLAN.md](/Users/sean/Documents/Development/seans-mfe-tool/MERGE-PLAN.md)
- [packages/contracts/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/package.json#L1)
- [packages/oclif-base/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/oclif-base/package.json#L1)
- [.github/workflows/test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml)
