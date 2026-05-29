---
id: 0047
title: CODEOWNERS and Review Routing for Architectural Surfaces
status: Proposed
date: 2026-05-28
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [governance, codeowners, review, architecture, gap]
summary: Architecture-critical paths must be covered by CODEOWNERS and required review so changes to contracts, runtime, framework plugins, CLI base infrastructure, and ADRs cannot merge without explicit domain review.
rationale-summary: The repository has a mature ADR and governance culture but no CODEOWNERS file. That leaves review routing implicit and makes it too easy for high-impact architectural changes to merge without the right maintainer in the loop.
long-form: true
---

# ADR-047: CODEOWNERS and Review Routing for Architectural Surfaces

## Context

The repository contains high-leverage architectural surfaces such as:
- shared contracts in [packages/contracts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts)
- base command infrastructure in [packages/oclif-base](/Users/sean/Documents/Development/seans-mfe-tool/packages/oclif-base)
- framework plugins in [packages/framework-react](/Users/sean/Documents/Development/seans-mfe-tool/packages/framework-react) and [packages/framework-angular](/Users/sean/Documents/Development/seans-mfe-tool/packages/framework-angular)
- runtime platform code in [src/runtime](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime)
- ADRs in [docs/architecture-decisions](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions)

Despite that, repository search found no `CODEOWNERS` file and no equivalent maintainer-routing mechanism.

## Decision Drivers

- Architectural drift is more likely when review ownership is implicit.
- The repository already uses ADRs to make major decisions explicit; review routing should match that governance posture.
- CODEOWNERS is a lightweight, repository-native control that fits GitHub-hosted workflows.

## Considered Options

### Option 1: Add CODEOWNERS for architectural paths and make those reviews required

Pros:
- Native GitHub support.
- Works well with the existing GitHub Actions-centric workflow.
- Scales better than informal owner knowledge.

Cons:
- Needs ongoing maintenance as package boundaries evolve.

### Option 2: Rely on human convention only

Pros:
- No repository config needed.

Cons:
- Fails silently as the contributor pool grows.
- Hard to audit.

### Option 3: Use a manual reviewer checklist without CODEOWNERS

Pros:
- Flexible.

Cons:
- Non-blocking unless paired with policy enforcement.

## Decision Outcome

Choose Option 1.

The repository standard is:
- A `CODEOWNERS` file must exist and cover all architecture-critical paths.
- Changes to ADRs, contracts, runtime, base command infrastructure, framework plugins, and release or workflow definitions require owner review.
- Ownership rules should be broad enough to stay maintainable, but specific enough to route high-impact changes accurately.

### Consequences

Positive:
- Review routing becomes explicit and auditable.
- Architectural knowledge stays attached to critical paths.
- New contributors get clearer expectations for where design authority lives.

Negative:
- Owner coverage can become stale if not maintained.
- Small repositories may initially feel the process overhead.

Neutral:
- CODEOWNERS does not replace ADRs; it operationalizes review around them.

## Validation / Enforcement

Primary mechanism:
- `CODEOWNERS` plus branch protection requiring owner review on covered paths.

Secondary mechanism:
- CI or policy check that fails when critical directories are added or renamed without corresponding CODEOWNERS coverage.

Detection latency:
- PR

Owner:
- Platform maintainer

Exception process:
- Short-lived exceptions may be handled by a documented fallback owner, but the CODEOWNERS file must be updated in the same change window.

Autofix possible?
- Partial. Coverage diff checks can suggest missing patterns, but owner assignment remains a human decision.

## References

- [packages/contracts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts)
- [packages/oclif-base](/Users/sean/Documents/Development/seans-mfe-tool/packages/oclif-base)
- [src/runtime](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime)
- [docs/architecture-decisions](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions)
- [.github/workflows/test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml)
