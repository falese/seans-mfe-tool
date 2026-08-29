---
id: 0085
title: Intent-compilation is a resolved plugin capability; coder is its tunable open-weight implementation, external
status: Proposed
date: 2026-08-29
deciders: [sean]
area: AI / plugins / coder / generation
enforcement: convention
tags: [generative, ai, intent, coder, plugin, open-weights, mcp, seam]
relates-to: [36, 22, 78, 21, 19]
supersedes: []
superseded-by: []
implements-pdr: [9]
implemented-by: []
verified-by: []
tracked-by: []
summary: >-
  Intent-compilation (refined business intent + repo context → candidate DSL) is
  resolved as a plugin capability the same way framework support is (ADR-036): the host
  CLI owns a typed contract and a command surface under the reserved `coder:*` topic,
  and an installed plugin provides the implementation. Coder is that implementation — a
  tunable open-weight model — and stays external and plugin-hosted (ADR-022, PDR-008),
  so no model, weights, or training code enters this repo; only the seam does. The
  tuning corpus is the platform's own intent/manifest/generated-MFE examples.
rationale-summary: >-
  The platform already has a proven pattern for "the same operation, different resolved
  backend" — framework plugins (`loadFrameworkPlugin`) and MCP child-process isolation.
  Intent-compilation is another axis of the same shape, so it should reuse the pattern
  rather than hardcode a model or fork the CLI. Keeping coder external preserves the
  resolved plugin-first decision and its independent release cadence, and lets the
  weights be tuned and swapped without a platform release.
long-form: true
---

# ADR-085: Intent-compilation is a resolved plugin capability; coder is its tunable open-weight implementation, external

## Context

ADR-084 fixes *what* generation produces (a validated manifest) but not *who* compiles
the intent or *what model* runs. PDR-009 asks for that compiler to be a **tunable open
weight**, hosted in **coder**, to end the per-token credit cost of continuous
generation.

Two resolved decisions constrain the answer. Coder is deliberately **external and
plugin-hosted**: ADR-022 and PDR-004 ship it as an oclif plugin depending on published
contracts, and ADR-078/PDR-008 — while retiring the daemon into the platform —
explicitly keep *coder a plugin*. And the platform already has the right pattern for
"one operation, a resolved backend": framework support is resolved through
`loadFrameworkPlugin` (`src/framework/loader.ts`, ADR-036), and AI/tool operations run
as isolated child processes over the MCP contract (ADR-019). Intent-compilation is a
new axis of exactly this shape, so it should reuse the pattern, not hardcode a model or
pull an LLM into this repo's tree (the `inner-voice` scope-bleed that RESTRUCTURE-PLAN
already moved out).

## Decision

### 1. Intent-compilation is a typed, host-owned contract

This repo defines the seam: a typed contract taking a refined business intent plus repo
context (available capabilities, fleet manifests, the DSL schema) and returning a
**candidate DSL document** for ADR-084's pipeline to validate. The contract lives with
the platform's other published contracts (`@seans-mfe/contracts`, ADR-021), so any
implementation depends on it rather than reaching into the CLI.

### 2. The host exposes a command surface; a plugin provides the implementation

The operation is invoked through the reserved `coder:*` topic (ADR-015) and resolved
the way frameworks are — the host CLI loads an installed plugin and calls it; no model
is bundled in core. The command follows the AI-native profile (`--json`, typed errors,
`CommandResult<T>`; PDR-003) so it is agent-drivable end to end.

### 3. Coder is the implementation, external and tunable

`@falese/coder` provides the compiler behind that contract, running a tunable open
weight. It stays a separate repo and plugin (ADR-022, PDR-008); the weights are tuned
and swapped there without a platform release. The **tuning corpus** is the platform's
own material — the intent/manifest/generated-MFE triples already present across
`examples/**` — which this repo can package and publish for training without hosting
the training itself.

## Boundaries

- **No model, weights, or training code lands in this repo.** This ADR defines the
  contract and the host command; the model and its fine-tuning are coder-repo work
  against this contract.
- It does not choose a base model, a serving runtime, or a tuning method — those are
  coder's, downstream of the contract.
- It does not widen coder's role beyond intent-compilation; the existing `coder:refactor`
  surface is unaffected.

## Consequences

- **Better:** reuses a proven resolution pattern instead of inventing one; keeps the
  stochastic model out of the deterministic core repo; preserves coder's independent
  cadence and the plugin-first decision; makes the credit-cost escape (open weights) a
  swap behind a stable contract.
- **Worse / the cost accepted:** the end-to-end value depends on work in a repo this
  decision does not own, and on the contract being right before coder builds against
  it — a cross-repo coordination cost (the known negative of ADR-022's plugin-first
  stance). The tuning corpus must be curated and kept representative or the tuned model
  regresses silently.

## References

- ADR-036 — framework plugins resolved via `loadFrameworkPlugin`; the resolution
  pattern this mirrors for intent-compilation.
- ADR-022 — plugin-first architecture keeping coder an external oclif plugin.
- ADR-078 — control plane moves into the platform but coder stays a plugin.
- ADR-021 — `@seans-mfe/*` (platform) vs `@falese/*` (third-party plugin) namespaces.
- ADR-019 — MCP child-process isolation, the AI-operation invocation model.
- ADR-084 — the boundary that makes the compiler's output a manifest, not code.
- PDR-009 — the product decision this implements.
