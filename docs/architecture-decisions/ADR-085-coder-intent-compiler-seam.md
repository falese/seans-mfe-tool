---
id: 0085
title: Intent-compilation invokes coder as an external local model service; coder is the tunable open-weight implementation
status: Accepted
date: 2026-08-29
deciders: [sean]
area: AI / coder / generation
enforcement: convention
tags: [generative, ai, intent, coder, open-weights, subprocess, seam, mlx]
relates-to: [19, 22, 78, 21, 87, 88]
supersedes: []
superseded-by: []
impl:
  stage: phased
  refs: ["#364"]
implements-pdr: [9]
implemented-by: [packages/plugin-coder/src/types.ts, packages/plugin-coder/src/coder-service.ts, packages/plugin-coder/src/commands/coder/compile.ts]
verified-by: []
tracked-by: ["#364"]
summary: >-
  Intent-compilation (refined business intent + repo context → candidate DSL, and per
  ADR-087 domain source) is performed by coder, invoked out-of-process — the coder CLI
  (`coder generate --adaptor <name>`) or its local SSE `serve` endpoint — behind a typed
  contract, isolated the way tool calls already are (ADR-019). coder is a standalone Bun
  binary running a local open weight (Qwen2.5-Coder-7B + LoRA via MLX), not an in-process
  oclif plugin; the host exposes a thin `coder:*` wrapper command that shells out to it.
  No model, weights, or training code enters this repo; the tuning corpus is the
  platform's own `examples/**` intent/manifest/source examples, packaged as coder adaptors.
rationale-summary: >-
  Validating coder before ratification showed it is a Bun + commander CLI with a local
  MLX inference server and git-installed LoRA adaptors — it has no oclif surface, no
  `@seans-mfe/contracts` dependency, and cannot be loaded in-process by the Node CLI.
  So the integration is the child-process/service model the platform already uses for
  isolated tool execution (ADR-019), not the in-process framework-plugin resolution the
  first draft of this ADR wrongly borrowed. Keeping coder an external service preserves
  its independent cadence and lets the weights be tuned and swapped with no platform release.
long-form: true
---

# ADR-085: Intent-compilation invokes coder as an external local model service; coder is the tunable open-weight implementation

## Context

ADR-084 fixes *what* generation produces (a validated manifest) but not *who* compiles
the intent or *what runs the model*. PDR-009 asks for that compiler to be a **tunable
open weight**, hosted in **coder**, to end the per-token credit cost of continuous
generation.

The first draft of this ADR assumed coder ships as an in-process oclif plugin under the
`coder:*` topic, resolved the way framework plugins are (ADR-036), following ADR-022's
premise that *"falese/coder ships as an oclif plugin"*. **Validating the actual coder
repository before ratification falsified that.** coder is a standalone **Bun + commander
CLI** with a local **SSE `serve`** mode and **git-installed LoRA adaptors**; it has no
`oclif` section, no `coder:*` topic, and **no `@seans-mfe/contracts` dependency**. It
runs a local open weight — **Qwen2.5-Coder-7B-Instruct-4bit + LoRA via MLX**,
memory-gated — and its stated integration is *"CLI invokable in any shell"*. A Node
oclif process cannot load it in-process at all. So the integration model has to be the
one the platform already uses for isolated execution: out-of-process (ADR-019).

## Decision

### 1. coder is invoked out-of-process behind a typed contract

Intent-compilation calls coder either as a subprocess (`coder generate --adaptor <name>
--context <files>`) or against its local `serve` SSE endpoint (`POST` a
`{ prompt, system, messages }` body). The host owns a **typed contract** — refined
intent plus repo context (available capabilities, fleet manifests, the DSL schema) in,
a **candidate artifact** out — living with the platform's published contracts
(`@seans-mfe/contracts`, ADR-021) so the boundary is stable and the coder binary is a
replaceable implementation behind it.

### 2. The host surface is a thin `coder:*` wrapper, not coder itself

`seans-mfe-tool` exposes the operation as a `coder:*` command (topic reserved in
ADR-015) that shells out to the coder service and returns a `CommandResult<T>` in the
AI-native profile (PDR-003). coder stays a **separate repo and service** (ADR-022 /
PDR-008 keep it external); the wrapper — and the contract — are the only new surface in
this repo. This narrows ADR-022's "coder as an oclif plugin" premise to "coder as an
external service the host wraps", which the real repo requires.

### 3. coder is the tunable open weight; the corpus is packaged as adaptors

Fine-tuning happens in coder: `coder train` produces a LoRA **adaptor** (a git-installed
directory with a manifest, weights, and eval), swappable without a platform release. The
tuning corpus is the platform's own material — the `examples/**` intent/manifest/source
triples — packaged as coder adaptors: an **intent→manifest** adaptor for ADR-084's lane
and a **source** adaptor for ADR-087's developer-owned lane. No weights or training code
land in this repo.

## Boundaries

- **No model, weights, or training code enters this repo.** Only the contract and the
  `coder:*` wrapper do; the model, its serving, and its tuning are coder's.
- This ADR does not choose the base model, quantization, or tuning method — those are
  coder's (today Qwen2.5-Coder-7B / 4-bit / LoRA, recorded as observed, not mandated).
- It does not itself supply a manifest-targeted adaptor: coder's existing adaptors emit
  **source**, so ADR-084's lane needs a **net-new intent→manifest adaptor**. That
  training is coder-repo work against this contract, tracked as a dependency of PDR-009.

## Consequences

- **Better:** the integration matches what coder actually is, reusing the platform's
  existing isolated-execution model (ADR-019) rather than an in-process plugin it cannot
  support; coder keeps its independent cadence; the credit-cost escape (local open
  weights) is proven, not hypothetical.
- **Worse / the cost accepted:** an out-of-process local model service is an operational
  dependency (a running `serve`, an ~18GB memory gate, MLX/Apple-Silicon assumptions)
  the platform must tolerate or degrade around. And the loop's manifest lane is blocked
  on an adaptor that does not yet exist — coder's current strength is source, not
  manifests — so ADR-084's half needs new training before it runs end to end.

## References

- ADR-019 — child-process isolation for tool execution; the out-of-process model this
  integration follows instead of in-process plugin loading.
- ADR-022 — plugin-first architecture; its "coder as an oclif plugin" premise is
  narrowed here to an external service, per the validated repo.
- ADR-078 — the control plane moves into the platform but coder stays external.
- ADR-021 — `@seans-mfe/*` (platform) vs `@falese/*` (third-party) namespaces; the
  contract lives on the platform side.
- ADR-087 — the developer-owned source lane coder's react-ts adaptor already serves.
- ADR-088 — makes this seam's `coder:*` wrapper a concrete first-party in-repo package and
  resolves its eval-oracle coupling with a direct `@seans-mfe/dsl` dependency.
- PDR-009 — the product decision this implements.
- #364 — the intent→manifest adaptor build tracked against this seam, specified in
  `docs/coder-intent-manifest-adaptor-spec.md`.
