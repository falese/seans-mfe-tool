---
id: 0095
title: >-
  A manifest may declare secondary build targets — a second artifact from the same capabilities,
  contributed to the file plan rather than selected as a variant
status: Implemented
date: 2026-09-15
deciders: [sean]
area: Codegen / targets / packaging
enforcement: code
tags: [codegen, plugins, manifest, native, packaging]
relates-to: [9, 34, 36, 43, 61, 91, 92, 93, 94, 96]
supersedes: []
superseded-by: []
implements-pdr: [1, 2, 4]
implemented-by:
  - packages/dsl/src/schema.ts
  - packages/dsl/src/parser.ts
  - packages/plugin-swift/src/codegen.ts
  - src/targets/swift.ts
  - src/commands/remote/init.ts
  - src/commands/remote/generate.ts
verified-by:
  - packages/dsl/src/__tests__/schema.targets.test.ts
  - packages/plugin-swift/src/__tests__/swift-contributor.test.ts
  - check:mfe-drift:check
summary: >-
  A manifest gains an optional `targets:` block naming builds produced ALONGSIDE the primary web
  build, rather than instead of it; `targets.swift` emits a Swift Package from the same
  capabilities the Module Federation remote is generated from. A secondary target is a
  FileContributor (ADR-094 §2) with its own template root, gated on its manifest section exactly
  as the BFF is gated on `data:` — so adding one changes no line of unified-generator.ts.
rationale-summary: >-
  The two seams that look like they should carry this cannot: a CodegenVariant is mutually
  exclusive, one per MFE, so it can only express a different build and never a second one; and
  BaseFrameworkPlugin has had no codegen surface since ADR-092 removed the six members nothing
  called, so a framework plugin cannot ship a template at all. The contributor seam already does
  precisely this job for the BFF, which has been a second build inside the same MFE since
  ADR-094 without anyone naming it that.
long-form: true
---

## Context

PDR-002 claims one language- and framework-neutral platform contract. Until now
that claim was only ever tested against web. Every MFE resolves to exactly one
`CodegenVariant` — `react-rspack` or `angular-webpack` — and emits one artifact
set. The `language:` field enumerates six languages but drives nothing: ADR-009
scoped non-JS out, and `resolveFrameworkName()` reads `framework`/`bundler` only.
A `language: go` manifest today loads the React plugin.

ADR-036 anticipated the gap and deferred it by name:

> Out of scope: Swift/Kotlin native targets — a separate effort with its own ADR
> for the native lifecycle contract.

Nothing picked it up, and there was no seam to pick it up *with*. Both obvious
candidates are closed:

- **`CodegenVariant` is mutually exclusive.** `renderFiles` does
  `findVariant(vars.templateVariant)` and renders one variant's template
  directory. A variant can express a *different* build; it has no way to express
  a *second* one.
- **`BaseFrameworkPlugin` has no codegen surface.** ADR-092 deleted
  `getTemplateDir`, `getTemplateVars`, `getRuntimeImport`,
  `getRuntimeClassName`, `getSourceExtension` and `getRuntimeDependencies` —
  every one abstract, implemented twice, called by nothing. A framework plugin
  cannot ship a template today.
  (`docs/framework-plugin-authoring.md` still documents that deleted API. An
  author following it produces a plugin that loads and then generates React.
  Out of scope here; noted so the next reader is not misled.)

The seam that *is* open turns out to already do the job. `@seans-mfe/plugin-bff`
registers a `FileContributor` (ADR-094 §2): a template root it owns plus the
`FileSpec`s to resolve against it, gated on `manifest.data` being present. That
is a **second build inside the same MFE** — the GraphQL BFF alongside the
Module Federation remote — and has been since ADR-094, without being named as
such.

## Decision

### 1. `targets:` names builds produced *alongside* the primary one

`framework` and `bundler` continue to describe the primary web build. `targets:`
is a new optional manifest block naming what is built beside it. It is additive
by construction: a manifest that gains a target loses nothing.

`DSLManifestSchema` is a plain, non-strict Zod object, so an undeclared
top-level key is **stripped, not rejected**. Declaring `targets` in the schema is
therefore load-bearing rather than cosmetic: without it a manifest asking for a
Swift build parses clean and silently loses the request.

### 2. Target ids are open, following ADR-036 §181

`KNOWN_TARGETS` drives a stderr warning, not a validation error, exactly as
`KNOWN_FRAMEWORKS` and `KNOWN_BUNDLERS` do. Shipping a target generator outside
this repository must not require a schema change inside it.

### 3. A secondary target is a `FileContributor`, not a variant or a framework plugin

It brings its own template root, resolved inside its own package, and gates every
spec on its manifest section — the direct analogue of the BFF's `hasBff`. The
consequence worth stating plainly: **`unified-generator.ts` is not modified by
this ADR.** Adding the Swift lane touched no line of the generator, which is the
acceptance criterion ADR-093 set for variants and ADR-094 set for contributors.

### 4. Registration is a side-effect import, at every site that generates

`import '@seans-mfe/plugin-swift/codegen'` goes wherever
`'@seans-mfe/plugin-bff/codegen'` already is: `remote:generate`,
`remote:generate:capability`, `check-mfe-drift.ts`, `codegen-characterization.ts`.

Missing one does **not** fail loudly. The drift gate compares against a *maximal*
generation, so files an unregistered contributor would have produced surface as
`orphaned` — which reads like an unrelated bug in a file nobody edited. Four
sites, not one, is the whole rule.

### 5. `--swift` is additive on both `remote:init` and `remote:generate`

`remote:init --swift` seeds the block in a new manifest. `remote:generate
--swift` adds it to an existing one and then generates — the retrofit path, so
an existing MFE gains a second build by a reproducible command rather than by
hand-edited YAML. Both go through one helper (`src/targets/swift.ts`) so the two
cannot disagree about what the flag means.

## Boundaries

- **This is not a target *matrix*.** `targets.swift` is one key. There is no
  `targets.swift.variants`, no per-target framework selection, and no attempt to
  generalise `framework`/`bundler` into the same structure. When a second
  secondary target lands, that generalisation is worth revisiting; predicting its
  shape from n=1 is not.
- **It does not connect `language:` to anything.** ADR-009's scoping stands: a
  `language: go` manifest still generates React. A secondary target is selected
  by `targets`, never inferred from `language`.
- **It does not make the web build optional.** Every manifest still resolves a
  primary variant. "Swift only" is not expressible and is deliberately not a goal
  — the point is one manifest producing *both*.
- **The target's own contract is ADR-096's problem, not this one.** This ADR
  decides *where a second build attaches*. What the Swift package contains, and
  why its `load` is `Bundle.load()`, is decided there.

## Consequences

Better: the platform's central claim is now falsifiable. One manifest, one set of
capabilities, two independently buildable artifacts, and a drift gate holding the
generated half byte-identical. The contributor seam gets a second user, which is
the first evidence it generalises beyond the case it was extracted for.

Worse, and accepted knowingly:

- **A third concept named "plugin".** `packages/README.md` had two; it now has
  three (oclif command plugins, framework plugins, codegen contributors). That is
  a real cost in a codebase where the first two were already confused often
  enough to need a section explaining them.
- **Four import sites with a silent failure mode.** §4 exists because the
  consequence of forgetting one is an `orphaned` diagnostic pointing at the wrong
  thing. A real registration lifecycle would be better; this is the same debt
  ADR-094 already carries for the BFF, now doubled.
- **`package.json` and `jest.config.js` were touched** to add the workspace
  dependency and module mapping. Both are shared files the session checklist asks
  about; a new package cannot avoid them.
- **One more generated surface the fleet gates must walk.** Every `examples/**`
  MFE declaring a Swift target adds ~14 files to drift comparison.

## References

- ADR-036 — framework plugins and the abstract `BaseFrameworkPlugin`; it deferred native targets, and its concrete implementations cannot carry one.
- ADR-092 — the framework plugin contract drops the members nothing calls, which is why a framework plugin can no longer ship a template.
- ADR-093 — what the generator emits is a list of file specs owned by a variant; a variant is one per MFE, which is why a second build cannot be one.
- ADR-094 — the generator is a library that receives file contributions instead of reaching across packages; `FileContributor` is the seam this uses.
- ADR-009 — the language field and template selection; `targets` selects a second build without reopening how `language` drives templates.
- ADR-096 — what the Swift target actually contains.
