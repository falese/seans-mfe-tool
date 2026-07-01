# ADR-061 — `@seans-mfe/dsl` and `@seans-mfe/codegen` as first-class packages; framework variant is injected, not resolved

- **Status:** Accepted
- **Date:** 2026-07-01
- **Relates to:** ADR-027 (manifest validation layer), ADR-034 (framework/bundler as DSL fields), ADR-036 (framework plugins), ADR-040 (handler sources), the RESTRUCTURE-PLAN §1.3.4 generator split, issues #140 / #238
- **Amends:** RESTRUCTURE-PLAN.md §1.2 — `dsl/` is a **platform package**, not part of the "`src/` is CLI-only" set.

## Context

RESTRUCTURE-PLAN §1.3.4 calls for extracting the 1,214-LOC
`src/codegen/UnifiedGenerator/unified-generator.ts` into a **zero-dep**
`packages/codegen`, after splitting it into plan → render → emit (the split
landed in `f21518e`; output is byte-identical across all 14 abc-kids
manifests). Physically moving the generator into a package exposes two couplings
that no prior ADR settles:

1. **DSL manifest types.** The generator imports `DSLManifest`,
   `CapabilityConfig`, and `CapabilityEntry` from `src/dsl/schema.ts`. These are
   **Zod-inferred** types (`z.infer<typeof …Schema>`), so they cannot be
   "copied to contracts" without dragging Zod into `@seans-mfe/contracts`, which
   is deliberately zero-dependency (no `dependencies`, no `peerDependencies`).
   A `packages/codegen` importing from `src/dsl` is also an **inverted
   dependency** (package → `src/`), and `src/dsl/index.ts` currently
   *re-exports* the generator, so making both packages naïvely would create a
   `dsl → codegen → dsl` **cycle**.

2. **Framework resolution.** `extractManifestVars()` calls
   `loadFrameworkPlugin()` (`src/framework/loader.ts`) purely to read three
   strings off the plugin — `framework`, `bundler`, and `templateVariant`
   (`plugin.framework` / `.bundler` / `.id`). The loader dynamically `require`s
   `@seans-mfe/framework-<name>`; pulling it into codegen would make the
   generator depend on the framework plugin packages at runtime — the opposite
   of "zero-dep."

## Decision

**1. Promote `src/dsl` → `packages/dsl` as `@seans-mfe/dsl`.**
The manifest schema, its inferred types, the parser, and the validator are a
shared *platform contract* — consumed by the generator and (as `import type`
only) by the runtime's `BaseMFE`. They are not CLI-internal. `@seans-mfe/dsl`
owns Zod and `js-yaml`; that is appropriate for a parser package (contracts
stays zero-dep). This amends RESTRUCTURE-PLAN §1.2, which had parked `dsl/`
under "`src/` is CLI-only."

**2. Extract `src/codegen` → `packages/codegen` as `@seans-mfe/codegen`.**
A pure `manifest → GeneratedFile[]` generator. Its only workspace dependencies
are `@seans-mfe/dsl` (manifest types) and `@seans-mfe/contracts` (types),
plus `ejs` (the template engine) and `fs-extra`/`js-yaml`. It ships its EJS
templates. It does **not** import the framework loader.

**3. Inject the framework variant; do not resolve it inside codegen.**
`extractManifestVars` / `generateAllFiles` receive the resolved variant
`{ framework, bundler, templateVariant }` from their caller. The **CLI owns
framework resolution** — it already calls `loadFrameworkPlugin()` in the build
and deploy commands — and passes the trio in. codegen never loads a plugin. The
same resolution rule (`manifest.framework ?? (bundler === 'webpack' ? angular :
react)`, then `loadFrameworkPlugin`) moves to the CLI edge unchanged, so output
is identical.

**4. Break the `dsl → codegen` re-export.** The generator exports leave
`src/dsl/index.ts` (no source consumes them via `dsl`; they are imported from
`@seans-mfe/codegen` directly). This removes the would-be cycle.

Wiring follows the established pattern: tsconfig `paths` and Jest
`moduleNameMapper` resolve `@seans-mfe/dsl` and `@seans-mfe/codegen` to their
`src/index.ts`; each package builds to `dist/` via `tsc` for publish/staging.

## Consequences

- **codegen is a pure, injectable unit.** No framework or plugin coupling; a new
  framework remains "publish `@seans-mfe/framework-<name>`" (ADR-036) with zero
  codegen edits — the CLI resolves it and hands codegen three strings.
- **No new mirror / drift risk.** Manifest types have exactly one home
  (`@seans-mfe/dsl`); codegen and runtime import them, honoring the same
  single-source discipline D1 restored for `@seans-mfe/contracts`.
- **Runtime neutrality holds.** `BaseMFE` imports DSL types as `import type`
  only — erased at runtime — so the ADR-056 boundary test stays green.
- **Byte-identical artifacts.** The characterization harness
  (`scripts/codegen-characterization.ts`) must report `IDENTICAL` across all 14
  abc-kids manifests before and after the move; it is the acceptance gate.
- **Shared config touched by design.** Root `tsconfig.json` paths, `jest.config.js`
  `moduleNameMapper`, and the package set gain `@seans-mfe/dsl` and
  `@seans-mfe/codegen` — owned by this ADR / #140.

## Alternatives rejected

- **Manifest schema → `@seans-mfe/contracts`.** Would add Zod as a contracts
  runtime dependency, breaking the zero-dep invariant the campaign's D1 step
  exists to protect.
- **codegen keeps a structural copy of the manifest type.** Reintroduces exactly
  the hand-maintained mirror drift that D1 eliminated for contracts.
- **codegen owns the framework loader.** Couples the generator to the framework
  plugin packages at runtime, contradicting "zero-dep generator."
