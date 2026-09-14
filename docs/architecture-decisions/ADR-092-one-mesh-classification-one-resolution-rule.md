---
id: 0092
title: >-
  Mesh plugin/transform classification and framework-name resolution each have exactly one
  implementation; the framework plugin contract drops the members nothing calls
status: Implemented
date: 2026-09-11
deciders: [sean]
area: Codegen / contracts / validation
enforcement: code
tags: [codegen, dsl, contracts, validation, duplication, dx]
relates-to: [27, 36, 61, 80]
supersedes: []
superseded-by: []
implements-pdr: [1]
implemented-by:
  - packages/contracts/src/mesh-catalog.ts
  - packages/dsl/src/schema.ts
  - packages/dsl/src/validator.ts
  - packages/codegen/src/catalog.ts
  - packages/codegen/src/manifest-validation.ts
  - packages/contracts/src/framework-plugin.ts
  - src/framework/loader.ts
verified-by:
  - packages/contracts/src/__tests__/mesh-catalog.test.ts
tracked-by: []
summary: >-
  The Mesh plugin and transform allow-lists move to a single table in @seans-mfe/contracts with
  the Mesh config key as the canonical name and the npm package spelling accepted as an alias,
  replacing four divergent copies of which two rejected each other's spelling of the same
  manifest field; framework-name resolution keeps one implementation instead of two that each
  documented an obligation to match the other; and the six BaseFrameworkPlugin members no
  caller reads are removed rather than left as a contract the platform does not honour.
rationale-summary: >-
  Every one of these is the ADR-080 shape — one fact, several statements, no mechanism keeping
  them equal — and each had already produced a defect rather than merely risking one: a
  manifest spelled the way the generator itself emits was refused, a validation error demanded
  a declaration the generator derives, and a getTemplateDir() pointing at a directory deleted
  two ADRs ago stayed green because its test matched the string and never opened the path.
long-form: true
---

## Context

Three duplications in the generator, found while mapping it for extraction
(`docs/generator-extraction-plan.md`, findings B1, B2, B3, C1). They are listed
together because they are the same defect — one fact stated several times with
nothing keeping the statements equal — and because two of them had already
produced live misbehaviour.

**1. Four copies of the Mesh allow-lists.** `packages/codegen/src/catalog.ts`
(13 plugins / 15 transforms, camelCase), `packages/dsl/src/validator.ts`
(8 / 9, kebab-case), `packages/dsl/src/schema.ts` (9 / 12, camelCase, different
contents again), and `src/utils/manifestValidator.js` (a fourth, orphaned, and
deleted separately). Two of them read the same `manifest.transforms` field.

Measured, not inferred:

| manifest | `dsl/validator.ts` | `codegen` |
|---|---|---|
| `transforms: [filterSchema]` | **rejected** (`valid=false`) | accepted |
| `transforms: [filter-schema]` | accepted | warns "unknown" |

Whichever spelling an author chose, one half of the platform objected — and the
rejected one is the spelling `DEFAULT_MESH_TRANSFORMS` generates into
`.meshrc.yaml`. Every copy also listed `mock` (and in one case `snapshot`) in
*both* sets, which silently disabled its own "X is a transform, not a plugin"
check for exactly the names that needed judgement.

A separate false positive sat beside it: `validatePerformanceConfig` required
that enabling `performance.rateLimit` be accompanied by a matching entry in the
top-level `transforms` array, and errored otherwise — but `render-model.ts`
derives that transform from the `performance` block itself. The check demanded
the author duplicate a derivation, and failed the manifest when they did not.

**2. Two framework-name resolvers.** `deriveBuiltinVariant` (codegen) and
`resolveFrameworkVariant` (the CLI loader) each implemented *explicit
`framework`, else `bundler === 'webpack'` selects Angular*, and each docstring
asserted it matched the other. Nothing enforced it.

**3. Six `BaseFrameworkPlugin` members with no caller.**
`getRuntimeDependencies`, `getTemplateDir`, `getTemplateVars`,
`getRuntimeImport`, `getRuntimeClassName` and `getSourceExtension` were declared
abstract, implemented by both shipped plugins, and read by nothing outside
their own tests — the generator hardcodes the same facts.

`getTemplateDir()` shows what that costs. It returned
`src/codegen/templates/base-mfe`, a directory deleted when templates moved to
`packages/codegen` under ADR-061. Its test asserted the returned **string**
matched `/templates\/base-mfe$/` and never checked the path existed, so it
stayed green for the whole migration while pointing at nothing. The plugins'
`getRuntimeDependencies()` had rotted the same way, still pinning
`@angular/core: ^17.0.0` where `catalog.ts` pins `^19.2.16` and names two
security advisories, and `react: ^18.2.0` where the platform's own
`react-pinned` rule requires exactly `~18.2.0`.

## Decision

### 1. One Mesh classification, in `contracts`

`packages/contracts/src/mesh-catalog.ts` holds `MESH_PLUGINS`,
`MESH_TRANSFORMS`, `MESH_AMBIGUOUS`, `canonicalMeshName` and
`classifyMeshEntry`. It sits in `contracts` for the ADR-080 reason: the DSL
schema validates against it, the DSL validator classifies against it and codegen
renders from it, so it belongs at the root of the dependency graph rather than
in any one consumer.

**The canonical name is the Mesh config key** (`filterSchema`), because that is
what `.meshrc.yaml` is keyed by and what the generator emits. The kebab-case
npm package suffix (`filter-schema`) resolves to it as an alias, so both
spellings are accepted and neither is a migration.

### 2. A name that is genuinely both is `ambiguous`, not listed twice

`mock` and `snapshot` ship as both a Mesh plugin and a Mesh transform. They are
in `MESH_AMBIGUOUS` and in neither set, and `classifyMeshEntry` returns
`'ambiguous'` so no caller reports them as misplaced. Listing a name in both
allow-lists — what every previous copy did — disables the misclassification
check by accident and looks like completeness.

### 3. One owner per concern

A **misclassified** name (a plugin declared as a transform, or the converse) is
an error, reported by whichever layer reads that field. An **unknown** name is a
warning, owned by codegen alone. The DSL validator no longer reports unknown
names at all: `ValidationResult` has no warning channel, so reporting one there
made it fatal, and the platform's policy for open vocabularies is a warning
(ADR-036, the same reasoning already applied to `framework` and `bundler` —
Mesh ships more transforms than any table here will track).

`validatePerformanceConfig` is emptied of its two false-positive rules and kept
as a named seam, so the next genuine cross-field rule lands there rather than
growing a fresh copy somewhere else.

### 4. One framework-name resolution rule

`resolveFrameworkVariant` calls `deriveBuiltinVariant(manifest).framework`
instead of restating the rule. The CLI still owns plugin *loading* (ADR-036,
ADR-061); what it no longer owns is a second copy of how a manifest maps to a
framework name.

### 5. The plugin contract declares only what is consumed

The six unread members are removed from `BaseFrameworkPlugin` and from both
shipped plugins. They are not replaced with anything: the real extension point
needs a template directory **and** a file plan together, not six scalar
getters, and building it now against the generator's 25 inline `overwrite:`
booleans would bake in a shape that work is about to remove.

## Boundaries

**No manifest migration, because none was needed.** No example manifest
declares a top-level `transforms` or `plugins` array — the `transforms:` keys
in the meridian fleet are per-source (`data.sources[].transforms`), a different
field. The contradiction in §1 was latent across the fleet and reachable only by
a manifest nobody had written yet. Generated output is byte-identical across all
21 MFEs.

**Widening, not narrowing.** Every change to validation here accepts strictly
more manifests than before: both spellings now resolve, ambiguous names stop
being misreported, and two false-positive errors are gone. No previously-valid
manifest becomes invalid.

**The tables are still hand-maintained.** This is one list instead of four, not
a list derived from Mesh itself. It will fall behind new Mesh releases, and the
`unknown` path is a warning precisely because it must.

**Does not address the generator's framework branching.** C2 — the six
hardcoded `'angular-webpack'` comparisons in `renderFiles` — is untouched.
Removing the unread plugin members clears the misleading half-abstraction out
of the way; building the real one is Phase 4 of the extraction plan, whose
acceptance test is a third framework added without editing the generator.

## Consequences

**Better.** A manifest can no longer be accepted by one half of the platform and
rejected by the other for the same field. The spelling the generator emits is
now a spelling the validator accepts. Two validation errors that could not be
satisfied without duplicating a derivation are gone. The plugin contract no
longer advertises six capabilities the platform does not use, one of which had
been pointing at a deleted directory since ADR-061.

**Worse.** `contracts` grows a module, and `dsl` and `codegen` both gain a
dependency on it for a table they previously each owned — a change in one place
now reaches three packages, which is the point but is also a wider blast radius
per edit. Removing the plugin members is a breaking change to
`BaseFrameworkPlugin` for any third-party plugin implementing the full abstract
surface; nothing outside this repo does today, and a plugin that implements
extra methods still compiles.

**The trade-off accepted.** The `ambiguous` classification is a judgement, not a
fact Mesh publishes: `mock` and `snapshot` are treated as valid in either
position, so a genuine misplacement of those two goes unreported. Reporting them
was never possible anyway — every prior copy listed them in both sets — and
silently failing to check is worse than declaring that they are not checked.

## References

- ADR-027 — introduced the Mesh plugin/transform split these tables classify.
- ADR-036 — open-string `framework` / `bundler` with warnings, not errors; §3
  applies that policy to unknown Mesh names.
- ADR-061 — moved codegen and dsl into packages, which is when
  `getTemplateDir()`'s path went stale.
- ADR-080 — single-sourced the platform capability set in `contracts`; this is
  the same fix applied to the Mesh vocabulary.
- `docs/generator-extraction-plan.md` — findings B1, B2, B3 and C1, and Phase 4
  where the real framework extension point is built.
