---
id: 0087
title: Coder's source adaptor fills developer-owned feature files; the generator-owned lane stays deterministic
status: Accepted
date: 2026-08-29
deciders: [sean]
area: Codegen / generation / AI
enforcement: convention
tags: [generative, ai, coder, codegen, ownership, drift, hybrid, adaptor]
relates-to: [84, 82, 85, 86]
supersedes: []
superseded-by: []
impl:
  stage: phased
  refs: []
implements-pdr: [9]
implemented-by: [packages/codegen/src/unified-generator.ts]
verified-by: []
tracked-by: []
summary: >-
  Generation runs in two non-overlapping lanes keyed to the existing ownership seam.
  The generator-owned lane (`overwrite: true`) stays a deterministic function of the
  manifest via `unified-generator.ts` (ADR-084) — the model never writes it. The
  developer-owned lane (`overwrite: false` feature files) is where coder's source
  adaptor writes domain logic, because codegen only seeds those files once and never
  rewrites them and `check:mfe-drift` does not gate them. The stochastic model
  therefore never touches a drift-gated byte, and coder's proven code-generation
  strength (the react-ts adaptor) is used for exactly the files it already targets.
rationale-summary: >-
  Validating coder before ratifying these ADRs showed it is a shipping local
  open-weight code generator whose react-ts adaptor produces React/TS/MUI/Module
  Federation source at 0.92 eval pass — but has no manifest capability. ADR-084 keeps
  the model out of generator-owned code; this ADR puts coder's actual strength to work
  on the one lane ADR-084 leaves open, the developer-owned feature files, without
  weakening the reproducibility invariant, because those files are precisely the ones
  the drift gate never compares.
long-form: true
---

# ADR-087: Coder's source adaptor fills developer-owned feature files; the generator-owned lane stays deterministic

## Context

ADR-084 fixes that a *generator* emits a manifest, never source, so the deterministic,
drift-gated core is preserved. It deliberately left one question open: may a model
write the **developer-owned** feature files — the `overwrite: false` files codegen
seeds once and never touches again?

Validating coder against ADR-085's claims (before ratification, at the human's
direction) answered why that question matters now. coder is a shipping local
open-weight code generator — Qwen2.5-Coder-7B + LoRA via MLX — and its `react-ts`
adaptor is trained specifically on *"React TypeScript + MUI + Module Federation
patterns"*, scoring 0.92 eval pass versus a 0.46 baseline. It generates **source
code**, and has no concept of a manifest. ADR-084 forbids that source from being the
generator's output; but the platform already has a lane where hand- (or model-) written
source is expected: the developer-owned feature files under `src/features/<cap>/*`.

## Decision

Generation runs in two non-overlapping lanes, keyed to the `overwrite` flag that
`packages/codegen/src/unified-generator.ts` already stamps on every emitted file.

### 1. Generator-owned lane (`overwrite: true`) — deterministic, model-free

Platform-contract files remain a pure function of the manifest, written only by
`unified-generator.ts` and gated by `check:mfe-drift` (ADR-084). No model writes here.
The upstream generative step for this lane is intent→manifest (ADR-084/085).

### 2. Developer-owned lane (`overwrite: false`) — coder's source adaptor

Feature files that hold domain logic are where coder's source adaptor writes. This is
safe against the reproducibility invariant precisely because codegen **seeds these
files once and never rewrites them** (and preserves an already-implemented capability
via `capabilityImplemented()`), and `check:mfe-drift` **does not diff them**. The model
writes only files the drift gate never compares.

### 3. The lanes never overlap

The `overwrite` flag is the boundary. No file is authored by both codegen and coder;
the stochastic model never touches a drift-gated byte. Order is immaterial — codegen's
seed is preserved if coder fills after, and codegen refuses to overwrite if coder fills
first.

## Boundaries

- coder-written feature source is **not** exempt from the other gates: it must pass
  typecheck, lint, tests, and `check:mfe-consistency`; CI remains the acceptance oracle
  (ADR-086).
- This ADR does not let a model write generator-owned files, templates, or the runtime
  contract — that remains ADR-084's prohibition.
- It does not require the developer-owned lane; an MFE whose feature files a human wrote
  is unaffected. This adds a *permitted* author for that lane, not a mandatory one.

## Consequences

- **Better:** uses coder's proven strength (0.92 on React-MFE source) instead of
  discarding it; closes the full loop (contract *and* domain logic generated) while the
  reproducibility guarantee is untouched, because the two lanes are disjoint by
  construction.
- **Worse / the cost accepted:** two generative artifacts now flow into an MFE — a
  manifest adaptor and a source adaptor — each needing its own training and eval, and
  developer-owned source is now a place stochastic output lands, so review and the CI
  oracle carry more weight there. The deterministic drift gate offers no protection on
  that lane (by design), so lint/type/test coverage on feature files is the safety net.

## References

- ADR-084 — the manifest boundary that keeps the model out of the generator-owned lane;
  this ADR takes up the developer-owned lane it left open.
- ADR-082 — the platform reports its own breaking changes in code it does not own and
  never rewrites that code; the developer-owned lane this ADR uses is that same
  never-rewritten code.
- ADR-085 — coder as the tunable open-weight implementation; the react-ts source
  adaptor is what fills this lane.
- ADR-086 — the generation loop closes on the existing CI gates; those gates are the
  only check on coder-written feature source.
- PDR-009 — the product decision this implements.
