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
relates-to: [9, 34, 36, 43, 61, 91, 92, 93, 94, 96, 97]
supersedes: []
superseded-by: []
implements-pdr: [1, 2, 4]
implemented-by:
  - packages/dsl/src/schema.ts
  - packages/dsl/src/parser.ts
  - packages/framework-swift/src/codegen.ts
  - src/targets/swift.ts
  - src/commands/remote/init.ts
  - src/commands/remote/generate.ts
verified-by:
  - packages/dsl/src/__tests__/schema.targets.test.ts
  - packages/framework-swift/src/__tests__/swift-contributor.test.ts
  - check:mfe-drift:check
summary: >-
  A manifest gains an optional `targets:` block naming builds produced ALONGSIDE the primary web
  build, rather than instead of it; `targets.swift` emits a Swift Package from the same
  capabilities the Module Federation remote is generated from. A secondary target is a
  FileContributor (ADR-094 §2) with its own template root, gated on its manifest section exactly
  as the BFF is gated on `data:` — so adding one changes no line of unified-generator.ts. Which
  plugin object owns a target, and registers that contribution, is ADR-097.
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

`framework` and `bundler` describe the web build. `targets:` is a new optional
manifest block naming every build the manifest produces. It is additive by
construction: a manifest that gains a target loses nothing.

The web build has two spellings — see §6, which makes `targets` a complete list
rather than a list of everything-except-the-important-one.

`DSLManifestSchema` is a plain, non-strict Zod object, so an undeclared
top-level key is **stripped, not rejected**. Declaring `targets` in the schema is
therefore load-bearing rather than cosmetic: without it a manifest asking for a
Swift build parses clean and silently loses the request.

### 2. Target ids are open, following ADR-036 §181

`KNOWN_TARGETS` drives a stderr warning, not a validation error, exactly as
`KNOWN_FRAMEWORKS` and `KNOWN_BUNDLERS` do. Shipping a target generator outside
this repository must not require a schema change inside it.

`TargetsSchema` must therefore carry a `.catchall()`. The first implementation
did not, and the claim above was half-true in a way worth recording: a plain
`z.object` **strips** unknown keys, so a manifest declaring `targets.kotlin`
printed the warning from the raw parse and then lost the key entirely in
`parseAndValidateDirectory` — the path every command actually uses. The
open-world policy held for `framework` and `bundler`, which are
`z.string()`, and silently did not hold here. The test that was supposed to
cover it built its manifest in memory and never round-tripped through
validation.

### 3. A secondary target's files are a `FileContributor`, not a variant

It brings its own template root, resolved inside its own package, and gates every
spec on its manifest section — the direct analogue of the BFF's `hasBff`. A
`CodegenVariant` could not do this: `findVariant` resolves exactly one per MFE,
so a variant expresses a *different* build and never a *second* one.

The consequence worth stating plainly: **`unified-generator.ts` is not modified
by this ADR.** Adding the Swift lane touched no line of the generator, which is
the acceptance criterion ADR-093 set for variants and ADR-094 set for
contributors.

This says where a target's *files* come from. Which object owns the target —
and registers that contribution — is ADR-097: a `BaseFrameworkPlugin` with a
`targetId`, carrying the build lifecycle and the codegen contribution together.
An earlier draft of this ADR made the contributor a separate kind of plugin, on
the reasoning that `BaseFrameworkPlugin` had no codegen surface after ADR-092.
That was true and was not a reason: it described the code rather than a
constraint, it left the target with no build lifecycle at all, and it turned the
existing `plugin.id` → `CodegenVariant.id` string join into a documented rule.

### 4. Registration is driven by the manifest

`registerTargetCodegen(manifest)` asks each plugin the manifest builds with to
register its own contribution (ADR-097 §3).

The shape this replaces is worth recording, because this ADR originally
specified it: a side-effect `import` in each of the four files that generate —
`remote:generate`, `remote:generate:capability`, `check-mfe-drift.ts`,
`codegen-characterization.ts`. Missing one did **not** fail loudly. The drift
gate compares against a *maximal* generation, so files the unregistered
contributor would have produced surfaced as `orphaned` — a diagnostic pointing
at a file nobody had touched. A hazard documented in four places is still a
hazard; deriving the contributor set from the manifest removes it.

### 5. `--swift` is additive on both `remote:init` and `remote:generate`

`remote:init --swift` seeds the block in a new manifest. `remote:generate
--swift` adds it to an existing one and then generates — the retrofit path, so
an existing MFE gains a second build by a reproducible command rather than by
hand-edited YAML. Both go through one helper (`src/targets/swift.ts`) so the two
cannot disagree about what the flag means.

### 6. The web build is a target too, spelled two ways

```yaml
framework: react            targets:
bundler: rspack        ≡      web: { framework: react, bundler: rspack }
```

The scalars came first, every example manifest uses them, and they are not
deprecated. `targets.web` exists because without it `targets:` is not a list of
what a manifest builds — it is a list of everything *except* the web build,
which sits outside in a different shape. A team answering "does this MFE
support web and mobile?" could not point at one list and say yes.

One resolution rule reads both (`resolveWebTarget`, ADR-092 §4), and the two
spellings are required to **agree**: a manifest that sets both to different
values is rejected by `validateFull` with both values named. Silently picking a
winner between two sources of one fact is the defect class this repository keeps
paying for — `getTemplateDir()` pointing at a deleted directory, four capability
arrays two entries short — and a precedence rule here would be another instance
of it.

`loadTargetPlugins` skips the `web` key for the same reason: it is a spelling of
the primary build, already resolved, not a second plugin.

### 7. A target declares which capabilities it implements, and its files repeat per capability

`targets.swift.capabilities` names a subset; omitted means all of them, so a
manifest written before the field existed keeps its meaning. Not every
capability belongs on every delivery mechanism — a dense table may be web-only,
a compact card mobile-only — and the manifest should be able to say so rather
than having every target silently inherit everything.

For that to work, a contributor's files have to repeat per capability the way
the web lane's have since forever: `featureSpecs(ctx, capability)` runs in a
loop and emits `src/features/<Cap>/<Cap>.tsx`, `owner: 'developer'`. So
`FileContributor.specs` may now be a **function of the plan context**, not only
a fixed array. `FileSpec.out` is a static string, so a fixed array can only
describe files whose paths are known before any manifest is read.

That limit had already shaped the Swift lane badly. Unable to emit one file per
capability, it put every view in a single developer-owned
`CapabilityViews.swift` — and since `overwrite: false` means *seed once*, a
capability added later had nowhere to land. The resulting build break was then
written up as an intentional "migration notice" rather than recognised as the
workaround it was. With per-capability files the break disappears: a new
capability gets a new file, which does not exist yet and is therefore written,
exactly as in the web lane.

**`overwrite: false` means seed once, not never write.** That is the sentence
the original design missed, and it is worth stating plainly because it is the
whole reason the two lanes can behave the same.

The per-capability loop is a *set* of files, not one, and the set is itself
conditional: when the manifest declares a `data:` section the Swift target emits
`Features/<Cap>Query.swift` beside `Features/<Cap>View.swift`, so the capability
that gets a view also gets the document backing it (ADR-096 §7). A target's
generator composes its own repeated structure; the seam only has to hand it the
plan context.

## Boundaries

- **This is not a target *matrix*.** Each key names one build. There is no
  `targets.swift.variants` and no per-target framework selection beyond the
  `web` pair. A target's options are its own generator's business.
- **`capabilities` is Swift-only for now.** `targets.web` takes every domain
  capability, as it always has. Extending the subset to the web lane would
  change emission for all 21 example MFEs and everything the drift and
  characterization gates hold; worth doing, not worth doing in the same change
  that introduces the idea.
- **`targets.web` does not make the web build optional.** Every manifest still
  resolves one, and omitting `web` falls back to the scalars and then to
  react + rspack. "Mobile only" is not expressible and is deliberately not a
  goal — the point is one manifest producing *both*.
- **It does not connect `language:` to anything.** ADR-009's scoping stands: a
  `language: go` manifest still generates React. A secondary target is selected
  by `targets`, never inferred from `language`.
- **The target's own contract is ADR-096's problem, not this one.** This ADR
  decides *where a second build attaches*. What the Swift package contains, and
  why its `load` is `Bundle.load()`, is decided there.

## Consequences

Better: the platform's central claim is now falsifiable. One manifest, one set of
capabilities, two independently buildable artifacts, and a drift gate holding the
generated half byte-identical. The contributor seam gets a second user, which is
the first evidence it generalises beyond the case it was extracted for.

Worse, and accepted knowingly:

- **The web build now has two spellings.** Redundancy is a cost even when the
  two are checked against each other, and a reader of an unfamiliar manifest has
  to know both. The alternative — migrating 21 example manifests and every
  downstream consumer off the scalars — is a larger change that buys less.
- **Codegen gains a second reason to be registered.** Targets register through
  their plugin (ADR-097); the BFF still registers by side-effect import. Two
  mechanisms where there should be one.
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
