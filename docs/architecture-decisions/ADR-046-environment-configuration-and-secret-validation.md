---
id: 0046
title: Environment Configuration and Secret Validation
status: Proposed
date: 2026-05-28
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [configuration, secrets, validation, security, gap]
summary: All process environment and generated deployment configuration must load through typed schemas with fail-fast validation, documented non-secret examples, and explicit secret injection boundaries.
rationale-summary: The repository has strong manifest validation via Zod but weak runtime configuration discipline. Commands and runtime helpers still consume raw environment values or emit placeholder secrets without a central validation contract, which makes misconfiguration easy and security posture uneven.
long-form: true
---

# ADR-046: Environment Configuration and Secret Validation

## Context

Manifest validation is a strong pattern in this repository through Zod-backed schemas such as [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279). In contrast, runtime environment and deployment configuration are handled ad hoc.

Examples:
- MCP execution forwards raw `process.env` into child processes in [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L46).
- Deployment generation emits placeholder production secrets like `JWT_SECRET` and `API_KEY` in [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399).
- The repository has no checked-in `.env.example`, no dedicated env validation package, and no shared config module.

The current pattern validates declarative manifests but not operational configuration.

## Decision Drivers

- Misconfiguration should fail fast before runtime behavior becomes ambiguous.
- Secrets must not be normalized as checked-in defaults.
- Generated outputs should guide correct deployment behavior without encouraging unsafe placeholder reuse.
- The repository already favors schema-based validation, so environment config should match that discipline.

## Considered Options

### Option 1: Central typed config module with fail-fast validation

Pros:
- Reuses the repository's existing schema-first design mindset.
- Provides one place to document required vs optional settings.
- Supports both CLI/runtime code and generated deployment assets.

Cons:
- Requires touching multiple modules that currently use raw env access.

### Option 2: Keep raw env access and rely on docs plus CI smoke tests

Pros:
- Minimal code changes.

Cons:
- Continues inconsistent behavior and delayed failures.
- Weakens security and operational clarity.

### Option 3: Validate only production deploy artifacts, not runtime modules

Pros:
- Smaller initial scope.

Cons:
- Leaves most local and CI execution paths ungoverned.

## Decision Outcome

Choose Option 1.

The repository standard is:
- Process environment must be loaded through typed validation schemas before operational use.
- Secret values are never supplied as repository defaults; example files may document keys, but not operational values.
- Generated deployment artifacts must distinguish clearly between required secrets, optional config, and safe defaults.
- Commands should fail fast with typed configuration errors when required config is absent or malformed.

### Consequences

Positive:
- Configuration failures become deterministic and early.
- Secret handling becomes easier to audit.
- Generated artifacts align with the repository's schema-driven design language.

Negative:
- Existing command and runtime code will need migration away from direct `process.env` use.
- Example generators may need more explicit documentation or flags.

Neutral:
- Teams still choose their secret manager externally; this ADR governs the application-side contract, not the backing vault product.

## Validation / Enforcement

Primary mechanism:
- CI gate and type-checked config module adoption for all production code paths that read environment variables.

Secondary mechanism:
- Scaffolding/codegen emits `.env.example`-style documentation and explicit boot-time checks in generated artifacts.

Detection latency:
- PR and runtime startup

Owner:
- Platform maintainer

Exception process:
- Temporary exceptions require a follow-up issue and a dated TODO linked from the consuming module.

Autofix possible?
- Partial. Example-file generation and some direct env access migrations can be automated; semantic config design cannot.

## References

- [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279)
- [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L46)
- [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399)
- [docs/architecture-decisions/ADR-017-typed-error-hierarchy.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-017-typed-error-hierarchy.md)
