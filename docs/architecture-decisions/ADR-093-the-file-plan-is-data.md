---
id: 0093
title: >-
  What the generator emits is a list of file specs owned by a variant, not a procedure with
  framework branches
status: Implemented
date: 2026-09-11
deciders: [sean]
area: Codegen / extensibility / ownership
enforcement: code
tags: [codegen, ownership, plugins, extensibility, dx]
relates-to: [36, 43, 61, 77, 82, 91, 92]
supersedes: []
superseded-by: []
implements-pdr: [1, 4]
implemented-by:
  - packages/codegen/src/file-plan.ts
  - packages/codegen/src/variants/types.ts
  - packages/codegen/src/variants/shared.ts
  - packages/codegen/src/variants/react-rspack.ts
  - packages/codegen/src/variants/angular-webpack.ts
  - packages/codegen/src/variants/index.ts
  - packages/codegen/src/unified-generator.ts
verified-by:
  - packages/codegen/src/__tests__/third-variant.test.ts
  - packages/codegen/src/__tests__/file-plan.test.ts
  - build:codegen-snapshot:check
tracked-by: []
summary: >-
  The generator's render phase becomes a generic loop over declarative FileSpec entries supplied
  by a framework variant, replacing roughly 25 hand-written emit sites and six comparisons
  against the literal 'angular-webpack'; ownership stops being 25 inline booleans and becomes a
  column three subsystems can read; and a variant id is an open string backed by a registry, so
  a framework the generator has never heard of can generate a complete MFE.
rationale-summary: >-
  ADR-036 already decided framework support should be variant data and the generator's own
  header asserted it was, while six branches said otherwise — a promise that could not be kept
  because there was no mechanism to keep it; making the emit set data rather than procedure is
  that mechanism, and it is the same one the BFF needs, since core reaches into plugin-bff by
  relative path for exactly the same reason.
long-form: true
---

## Context

`renderFiles` was roughly 300 lines containing about 25 hand-written
`files.push({ path, content, overwrite })` calls. Template selection, output
path, ownership, conditional inclusion and framework branching were interleaved
at every site, each in a slightly different shape: some guarded with
`fs.pathExists` and some not; some warned on a missing template, some were
silent, some consulted a separate allow-list; three near-identical
`{tpl, out, overwrite}` loops used three different field names; one file was
emitted as a hardcoded string with no template at all.

**The promise that could not be kept.** ADR-036 decided that framework support
is template-variant data, and the file's own header stated it plainly:

> *Framework differences are template-variant data, never branches in this file
> (ADR-036, ADR-061) — the variant is injected by the caller, which is what lets
> a third-party framework plugin work without editing the generator.*

There were six comparisons against the string literal `'angular-webpack'`,
deciding the template directory, the feature filenames, the remote-entry
filename, the BFF tsconfig, the root-template list and the entry-file list. The
`templateVariant` field was a closed union of the two built-ins. Adding a third
framework meant editing the generator in six places and widening a type. The
header had been wrong for two ADRs, and nothing could detect that, because
nothing tested the property — only the outputs.

**Ownership had no single definition.** `overwrite` is the ownership map
(ADR-077 §1), and it existed as 25 inline booleans. Three subsystems depend on
the split and each re-derived it: `check:mfe-drift` (compares only
generator-owned files), `mfe:validate`'s `developerOwned` predicate (scans only
the other half for platform migrations, ADR-082), and the dry-run planner.
Moving a file between the two is the most breaking edit available in the
package and is invisible in review — the risk ADR-082 exists to mitigate.

**It is the same defect as the BFF cycle.** `codegen` reaches into
`packages/plugin-bff/templates` by relative path because there is no way for a
plugin to contribute files to the generation plan. The generator hardcodes
framework variants for the same reason it hardcodes that path: nothing can be
injected, so everything is inlined.

## Decision

### 1. The emit set is data

A `FileSpec` says what to emit and who owns it:

```ts
interface FileSpec {
  template?: string;          // resolved against a named root
  content?: string;           // or a literal, for files with no template
  out: string;                // relative to the MFE root
  owner: 'generator' | 'developer';
  root?: 'variant' | 'bff';
  when?: (ctx) => boolean;
  vars?: (ctx) => Record<string, unknown>;
  optional?: boolean;         // absence is a variant's choice, not a defect
}
```

`resolveFilePlan` is the single implementation of *"if the spec applies, render
its template with the model and emit it, owned by whoever the spec says owns
it"*. All filesystem access is injected, so a plan resolves without a disk.

### 2. A variant is a directory plus a list

`CodegenVariant` carries the template directory, the per-capability filenames,
the remote-entry and slot-sugar names, whether it owns the root tsconfig, the
patterns that mean a capability is already implemented, and its own `FileSpec[]`
for root and entry files. `renderFiles` reads it and **contains no framework
name**.

Shared specs ask the variant declarative questions — `ownsRootTsconfig`, not
`id === 'angular-webpack'`. An id comparison inside a shared list is the same
defect in a new location.

### 3. `templateVariant` is an open string, resolved through a registry

`registerVariant` adds a variant beyond the two built-ins; `findVariant`
resolves registered ones first. `templateDirName` may be absolute, so a variant
shipped by a plugin points at its own package's templates without the generator
knowing where that is.

### 4. Ownership is a column

`ownershipOf(plan)` returns the map straight off the specs, without rendering.
One statement of the split for the three subsystems that need it.

### 5. The property is a test, not a comment

`__tests__/third-variant.test.ts` registers a `preact-rspack` variant against a
temporary template directory and generates a real MFE from it, asserting that
nothing under `packages/codegen/src/` changed to make it work. It also greps
`renderFiles` for the two built-in variant ids. A comment claiming this was
already true survived two ADRs; a test does not.

## Boundaries

**Generated output is unchanged.** All 21 reference MFEs, 435 files, are
byte-identical to the Phase 0 baseline — content, ownership flags and preserved
capabilities. This is a restructuring of how the emit set is expressed, not of
what it contains.

**The BFF path escape is still there.** Core still resolves
`../../../packages/plugin-bff/templates`. The mechanism this ADR builds is what
removes it — a plugin contributing `FileSpec`s with its own template root — but
the BFF's specs still live in `codegen/src/variants/shared.ts` and are declared
with `root: 'bff'`. Moving them into `plugin-bff` is the next step and is
tracked by the `KNOWN_ESCAPES` entry in
`src/__tests__/package-templates-shipped.test.ts`.

**Dependency resolution still branches on framework.** `render-model.ts` has
`resolveReactSharedDeps` and an `angularExtraDependencyLines` block keyed on
`variant.framework`. That is the dependency half of variant knowledge and is
untouched here; a third variant therefore generates files correctly but gets no
framework-specific dependency lines. The acceptance test covers the file plan,
which is what this ADR is about, and the gap is named rather than implied.

**`deriveBuiltinVariant` still names the two built-ins.** It is the default
resolution rule for a manifest with no plugin loaded, so naming the built-ins
is its job. A third framework arrives through the CLI's plugin loader
(ADR-036), not through that function.

## Consequences

**Better.** A framework is a module and a template directory. The claim in the
file header is now enforced by a test instead of contradicted by the code
beneath it. Ownership has one definition, so moving a file between generator-
and developer-owned is a one-word diff in a table rather than an invisible
boolean flip. `renderFiles` went from ~300 lines to ~90, and the four different
shapes of "emit a file" became one.

**Worse.** Indirection: reading what an MFE gets now means reading a variant's
spec list plus three shared lists, rather than one procedure top to bottom. The
`when`/`vars` predicates take an opaque `PlanContext` that specs cast, which
trades some type safety for keeping `file-plan.ts` free of generator types.
And a spec list makes it easy to add files without thinking about ownership,
where an inline `overwrite:` at least forced the author to type it.

**The trade-off accepted.** Byte-identical output was held as a hard invariant
throughout, which ruled out fixing several things noticed along the way — the
BFF specs' `optional: true` flags exist only to reproduce the old silent-skip
behaviour, and `capabilityImplemented`'s regexes are preserved despite
`pathExists` giving the same on-disk result. Both are follow-ups, deliberately
not smuggled into a refactor whose whole claim is that nothing changed.

## References

- ADR-036 — framework plugins rather than hardcoded variants; this supplies the
  mechanism that decision assumed existed.
- ADR-043 — manifest-driven codegen and idempotent regeneration; the property
  the byte-identical baseline protects.
- ADR-077 §1 — `overwrite` is the ownership map; §4 gives it one statement.
- ADR-082 — platform migrations, which exist because developer-owned files are
  unreachable; the ownership column is what its `developerOwned` predicate reads.
- ADR-091 — `--force` re-seeds developer-owned scaffolding; §3's boundary is
  why implemented capabilities are omitted from the plan rather than flagged.
- ADR-092 — gave the Mesh classification and the framework-name resolution
  each exactly one implementation; this is the same shape of defect applied to
  the emit set.
- `docs/generator-extraction-plan.md` — findings C2 and D1, and Phase 4.
