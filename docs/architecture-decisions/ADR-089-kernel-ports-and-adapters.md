---
id: 0089
title: The governance+generation kernel couples to its host through four ports; the host implements them as adapters over its own code
status: Implemented
date: 2026-09-03
deciders: [sean]
area: Kernel / ports
enforcement: convention
tags: [kernel, ports-adapters, governance, generation, drift, extraction]
relates-to: [43, 75, 82, 84, 90]
supersedes: []
superseded-by: []
implements-pdr: [10]
implemented-by:
  - packages/sentinel/src/ports.ts
  - packages/sentinel/src/hardened-check.ts
  - packages/sentinel/src/index.ts
  - src/sentinel/adapters.ts
verified-by:
  - packages/sentinel/src/__tests__/hardened-check.test.ts
  - src/sentinel/__tests__/n1-proof.test.ts
tracked-by: []
summary: >-
  The reusable governance+generation kernel (PDR-010) depends on its host project through exactly
  four ports — validate(artifact), locateArtifacts(), materialize(artifact) (optional), and a
  HardenedCheck schema with a verify — and nothing else. SMT implements them as thin adapters over
  code it already has: validateFull, findManifest/MANIFEST_FILENAMES, generateAllFiles, and a
  PLATFORM_MIGRATIONS entry verified by mfe:validate. Everything MFE-shaped lives behind an adapter;
  the kernel package holds no SMT import past the ports, so a later extraction to its own repo is
  mechanical.
rationale-summary: >-
  A kernel that is worth extracting has to be provable as reusable while it still has exactly one
  consumer, and the only honest test of that is a minimal, named seam: if SMT's whole gate suite
  runs green through four ports, nothing MFE-specific has leaked into the machinery. A narrow port
  surface is also the anti-speculation discipline — every knob added before a second real consumer
  needs it is an SMT-ism disguised as generality (YAGNI), so the boundary is drawn at what the
  existing gates actually exercise, not at what a hypothetical foreign domain might want.
long-form: true
---

# ADR-089: The governance+generation kernel couples to its host through four ports; the host implements them as adapters over its own code

## Context

PDR-010 names a domain-agnostic pattern the platform had already built twice — a model reads
wide, emits a typed artifact, and a deterministic floor executes it — and decides to extract the
machinery around it into a reusable, self-hosting kernel, with SMT as reference implementation #1.

Extraction has a trap. The machinery it would extract is today welded to MFE specifics:
`validateFull` knows about manifests, `generateAllFiles` writes rspack and Angular files,
`PLATFORM_MIGRATIONS` matches source that imports `@seans-mfe-tool/runtime`. If the kernel is cut
out with any of that still attached, it is not reusable — it is SMT with extra indirection, and
the claim of a second instance (the kernel governing itself, PDR-010) is hollow because both
"instances" are really the same domain.

The only way to prove reuse *before* a foreign consumer exists is a named, minimal seam and a
falsifiable test: run SMT's existing gate suite entirely *through* that seam, and check that
nothing MFE-shaped had to leak across it. This ADR fixes the seam.

## Decision

The kernel depends on its host through four ports and nothing else. The host provides an adapter
for each; the kernel provides the machinery behind them.

### 1. The four ports

- **`validate(artifact) → { valid, errors }`** — the deterministic oracle. The crux port: it is
  what makes stochastic output safe to act on. SMT adapter: `validateFull`
  (`packages/dsl/src/validator.ts`).
- **`locateArtifacts() → paths`** — discovery. Where the host's typed artifacts live. SMT adapter:
  `findManifest` / `MANIFEST_FILENAMES` (`packages/dsl/src/parser.ts`).
- **`materialize(artifact) → files`** — optional. Turns an accepted artifact into files; an
  audit-only host omits it. SMT adapter: `generateAllFiles`
  (`packages/codegen/src/unified-generator.ts`).
- **`HardenedCheck` (schema + `verify`)** — the typed check a governance finding hardens into. SMT
  adapter: a `PlatformMigration` entry (`packages/codegen/src/platform-migrations.ts`), verified by
  `mfe:validate` firing on the affected artifact. The auditor's typed output is ADR-090's subject;
  this port is the deterministic half it hardens *into*.

### 2. Adapters own every host specific; the kernel imports none

The kernel package contains no import that names an MFE, a manifest field, a framework, or any
`@seans-mfe/*` package past the port types. Anything domain-specific — the shape of a manifest, the
set of framework templates, the text a migration matches — lives on the SMT side of an adapter. The
kernel sees only `{ valid, errors }`, a list of artifact paths, a list of files, and a
`HardenedCheck`.

### 3. The port surface is drawn at what the gates exercise, not at what a foreign domain might want

The boundary is minimal on purpose. It is set at exactly what SMT's existing gates already need to
run — no configuration knob, no extension point, no abstraction is added for a hypothetical second
domain. Universality is deferred to a real third consumer (PDR-010); until then every unused knob is
an SMT-ism in disguise. `materialize` is the one optional port, and it is optional only because
audit-only use is a concrete, already-anticipated shape, not a speculative one.

## Boundaries

- **This is not a universal governance API.** It is the minimal seam that lets SMT's own machinery be
  reused by a second instance of the same pattern (the kernel governing its own records). Designing
  for a foreign domain is explicitly out of scope until a third consumer forces a real generalization.
- **The ports do not include the deterministic floor itself.** The decision-record schema, the
  traceability and existence gates, and the `HardenedCheck` verifier are *provided machinery*, not
  ports — they are plain code the kernel owns and the fuzzy layer never produces (ADR-090, PDR-010's
  Trusting-Trust guardrail). A port is a seam to host *judgment about the host's domain*, not a seam
  through which the floor could be swapped for a generated one.
- **`verify` is host-supplied, but plain.** The `HardenedCheck.verify` an adapter provides must be
  ordinary, independently-tested code (SMT's is `mfe:validate`). A port does not license a fuzzy
  verifier.

## Consequences

- **Better:** the reuse claim becomes falsifiable — if SMT's gate suite passes through the ports with
  nothing MFE-shaped leaking, the machinery is genuinely generic, proven at n=1. Extraction to a
  neutral-identity peer repo later is mechanical because the kernel already holds no host import.
- **Worse / the cost accepted:** four ports plus an adapter layer is indirection that buys no new
  behavior today; SMT pays refactoring cost for an asset whose *general* value is unproven until a
  foreign consumer appears. The narrowness is a bet that the next consumer's needs will be a subset of
  what the gates already exercise — a bet that will be wrong in some detail, and the fix then is to
  widen the port deliberately, not to have pre-widened it speculatively.

## References

- ADR-084 — generation already targets a validated typed artifact, not source; `validate` is that
  same oracle lifted to a port.
- ADR-082 — the platform-migration entry, verified by `mfe:validate`, is SMT's `HardenedCheck`
  adapter; this ADR names it as a port.
- ADR-043 — the manifest-driven code generation `materialize` wraps.
- ADR-075's decision-record machinery, which the kernel extracts as provided (non-port) code.
- ADR-090 — the auditor whose typed output hardens into the `HardenedCheck` port.
- PDR-010 — the kernel thesis this port surface serves.
