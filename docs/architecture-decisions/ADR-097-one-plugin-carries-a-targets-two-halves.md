---
id: 0097
title: >-
  A framework plugin declares which target it builds and registers its own codegen — one object
  carries a target's build lifecycle and its file contribution
status: Implemented
date: 2026-09-15
deciders: [sean]
area: Plugins / targets / codegen
enforcement: code
tags: [plugins, codegen, native, targets, contracts]
relates-to: [36, 61, 92, 93, 94, 95, 96]
supersedes: []
superseded-by: []
implements-pdr: [2, 4]
implemented-by:
  - packages/contracts/src/framework-plugin.ts
  - packages/framework-swift/src/plugin.ts
  - packages/framework-swift/src/codegen.ts
  - src/framework/loader.ts
  - src/commands/build/check.ts
  - src/commands/build/prod.ts
verified-by:
  - src/framework/__tests__/target-plugins.test.ts
  - packages/framework-swift/src/__tests__/plugin.test.ts
  - src/__tests__/import-direction.test.ts
summary: >-
  `BaseFrameworkPlugin` gains `targetId` — `'web'` by default, or a key under `targets:` — and an
  optional `registerCodegen()`, so one plugin carries both halves of a target: the build
  lifecycle it already had, and the file contribution that previously lived in a separate
  package. `loadTargetPlugins(manifest)` returns the primary plugin plus one per declared target,
  and `build:check` and `build:prod` iterate it. The web-shaped members `defaultPort`,
  `startDevServer` and `getDockerStrategy` become optional, so a natively-linked target declines
  them by type rather than by stub.
rationale-summary: >-
  ADR-092 §5 removed six codegen getters and said what a real replacement needed — "a template
  directory AND a file plan together, not six scalar getters" — and declined to build it until
  the generator could receive one. ADR-093 and ADR-094 built that: a file plan, and a
  FileContributor carrying its own template root. So this is the member ADR-092 specified,
  added now that its precondition holds, rather than a reversal of it.
long-form: true
---

## Context

The Swift target shipped first as a codegen contributor in a package of its own
(`@seans-mfe/plugin-swift`), on the reasoning that neither existing seam could
carry it: a `CodegenVariant` is mutually exclusive, and `BaseFrameworkPlugin`
had no codegen surface after ADR-092.

Both statements are true and neither is a reason. They describe what the code
happened to be, not what it had to be. Two things followed that were worse than
the problem:

**The target had no build lifecycle at all.** `plugin-swift` declared no
`checkEnvironment`, no `buildProduction`, no Docker strategy. `remote:generate`
emitted a Swift package and then the CLI abandoned it: `build:check` would
report a green environment on a machine with no Swift toolchain, and
`build:prod` would never run `swift build`. Those are exactly the five members
`BaseFrameworkPlugin` exists to provide.

**It institutionalised an existing accident.** React and Angular already split a
target's two halves across two objects — a `BaseFrameworkPlugin` with the build
lifecycle and a `CodegenVariant` with the templates — joined only by the string
`plugin.id`. Adding a third object with codegen and no build lifecycle, and
documenting "three different things are called plugin" in `packages/README.md`,
made a known wart into a rule.

ADR-092 §5 had already said what the fix looks like:

> They are not replaced with anything: the real extension point needs a template
> directory **and** a file plan together, not six scalar getters

It declined to build it because the generator could not receive one — the
`overwrite:` booleans were inline in a 300-line render procedure. ADR-093 turned
that into a list of `FileSpec`s and ADR-094 added `FileContributor`, a template
root plus specs. The precondition ADR-092 named now holds.

## Decision

### 1. A plugin declares which target it builds

`BaseFrameworkPlugin.targetId` defaults to `'web'` — the primary build, selected
by the manifest's `framework` field. Any other value names a key under
`targets:` (ADR-095). Concrete rather than abstract, so a plugin written before
secondary targets existed keeps working unchanged.

### 2. A plugin registers its own codegen

`registerCodegen?(): void` is the member ADR-092 §5 specified. Implementations
call `registerVariant()` or `registerFileContributor()` from
`@seans-mfe/codegen`. It takes and returns nothing: `contracts` imports nothing
first-party (ADR-061) and must not learn codegen's vocabulary to declare it.

One method with a caller replaces six without one. It is **not** a reversal of
ADR-092, whose rule was *declare only what is consumed* — this is consumed, at
four call sites, on every generation.

It must also be a real function rather than a module-level side effect.
The first implementation was `require('./codegen')`, which cannot satisfy its own
idempotence contract: `require` caches, so a second call after any unregister
silently did nothing.

### 3. Registration is driven by the manifest, not by import lists

`registerTargetCodegen(manifest)` walks `loadTargetPlugins(manifest)` and calls
each plugin's hook. This replaces a side-effect `import` that four files —
`remote:generate`, `remote:generate:capability`, `check-mfe-drift.ts`,
`codegen-characterization.ts` — each had to remember.

That shape had a failure mode worth naming, because ADR-095 shipped with it and
documented it as a hazard rather than fixing it: forgetting one import did not
error. The drift gate compares against a *maximal* generation, so files the
unregistered contributor would have produced surfaced as `orphaned` — a
diagnostic pointing at a file nobody had touched. The set of contributors is now
a function of what is being generated.

### 4. Target resolution is plural

`loadTargetPlugins(manifest)` returns the primary plugin first, then one per
declared target. `build:check` runs `checkEnvironment()` across all of them and
`allPassed` is the conjunction; `build:prod` builds all of them, primary first,
stopping at the first failure. An unknown target id is skipped with a warning,
following the open-world policy `framework` and `bundler` already use
(ADR-036, #181).

`loadFrameworkPlugin(framework)` is unchanged and still answers the singular
question.

### 5. The web-shaped members become optional

`defaultPort`, `startDevServer` and `getDockerStrategy` are optional. A
natively-linked target has no port, no dev server and no nginx container, and
should say so in the type rather than stub a port it never uses or throw from a
method the caller had no reason to doubt.

`build:dev`, `build:docker` and `remote:init` narrow through `assertServesHttp`,
which fails naming the command and the target.

## Boundaries

- **`CodegenVariant` is untouched.** A primary build still resolves one variant.
  This ADR changes who *registers* a contribution, not what a contribution is.
- **The BFF still registers by side-effect import.** `@seans-mfe/plugin-bff` is
  an oclif command plugin that also contributes codegen; it has no `targetId`
  and is not resolved per-manifest. Converting it is a separate change.
- **`framework-react` and `framework-angular` do not yet implement
  `registerCodegen()`.** Their variants are still registered as codegen
  built-ins. The member is optional precisely so this could land without
  rewriting the two shipped plugins in the same change; doing so would close the
  `plugin.id` → `CodegenVariant.id` string join, and is the obvious next step.
- **`build:dev` and `build:docker` remain primary-only.** Correctly: there is no
  dev server or container for a natively-linked target. They are not "not yet
  plural".

## Consequences

Better: there is no third plugin category. A target is one object with a
`targetId`, a build lifecycle and a codegen contribution, and `framework-swift`
reads like `framework-react` because it is the same thing. `swift build` is
reachable from `build:prod`, and `build:check` fails on a machine that cannot
build what the manifest declares — neither of which was true before. The
four-import-site hazard is gone.

Worse, and accepted knowingly:

- **The plugin contract is now partly optional.** Four members can be absent,
  so a consumer must narrow. `assertServesHttp` centralises it, but "which
  members does this plugin actually have" is a question the type system now asks
  and did not before.
- **`BuildProdResult` and the `build:check` envelope grew a `targets` array.**
  Published schemas changed. The primary target's fields stay at the top level
  so existing consumers keep working, which means the primary build is
  represented twice.
- **Two registration mechanisms coexist.** Plugin-driven for targets,
  side-effect import for the BFF. That is one more than there should be, and it
  is the price of not rewriting the BFF in the same change.
- **`framework-swift` depends on `codegen`** where the other two framework
  plugins depend only on `contracts`. The import-direction allow-list records
  it. It is the honest consequence of a plugin owning its templates.

## References

- ADR-092 — the plugin contract declares only what is consumed; §5 specified the template-directory-plus-file-plan member this adds, once the generator could receive one.
- ADR-093 — what the generator emits is a list of file specs owned by a variant; the file plan half of that precondition.
- ADR-094 — the generator is a library that receives file contributions; `FileContributor` is the template-root half.
- ADR-095 — a manifest may declare secondary build targets; this decides what plugin object serves one.
- ADR-096 — the Swift MFE is a third concrete subclass of the platform base class; unchanged by this, which moves only where its codegen is registered from.
- ADR-036 — framework plugins and the abstract `BaseFrameworkPlugin` this extends.
- ADR-061 — `contracts` imports nothing first-party, which is why `registerCodegen()` takes no codegen type.
