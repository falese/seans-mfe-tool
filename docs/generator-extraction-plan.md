# The Generator System — Map, Findings, and Simplification Plan

**Purpose:** document the generator CLI, the manifest contract, and the schema
system as they actually are today; name the complexity, dead ends, and
duplicated knowledge; and give a phased plan to get to a clean, extractable
core that can stand alone as a prototype.

**Scope:** `packages/dsl`, `packages/codegen`, the slice of `packages/contracts`
they depend on, the `remote:*` / `mfe:validate` commands, and the two schema
generators. The runtime platform (`packages/runtime`), the control plane, and
the BFF/API/ADR plugins are out of scope except where they couple to the above.

**Status:** exploration and plan only. No code changed. Gates were not run —
`node_modules` is not installed in this environment and `packages/*/dist` is
absent, so every claim below is from source reading and static analysis, not
execution. Each finding names the file and line so it can be re-checked.

---

## 1. The map

### 1.1 Four subsystems, one direction of flow

```
mfe-manifest.yaml
      │
      │  parse + validate         packages/dsl
      ▼
  DSLManifest  ──────────────►  schemas/dsl/manifest.schema.json
      │                          (z.toJSONSchema, scripts/generate-dsl-schema.ts)
      │  plan                    packages/codegen/src/render-model.ts
      ▼
  RenderModel (template vars)
      │  render                  packages/codegen/src/unified-generator.ts
      ▼                          + 56 EJS templates
  GeneratedFile[] { path, content, overwrite }
      │  emit                    packages/codegen/src/template-io.ts
      ▼
  an MFE on disk
```

A second, unrelated schema pipeline sits beside it:

```
oclif command registry ──┐
                         ├──► schemas/<command>.json  ──► MCP tool catalog
command result type T ───┘     (scripts/generate-schemas.ts)
```

### 1.2 Package graph

Declared dependencies form a clean DAG:

```
contracts  (0 deps)
    ▲
    ├── dsl        (+ zod, js-yaml, fs-extra)
    ▲        ▲
    └── codegen ───┘   (+ ejs, js-yaml, fs-extra)
              ▲
              └── plugin-bff, the CLI, framework-react, framework-angular
```

One undeclared edge breaks it — see Finding D1.

### 1.3 Size

| Unit | LOC (src, excl. tests) |
|---|---|
| `packages/contracts/src` | 2,197 |
| `packages/dsl/src` | 2,746 |
| `packages/codegen/src` | 2,494 |
| `packages/runtime/src` | 5,168 |
| `src/` (CLI) | 4,397 |
| framework plugins (react + angular) | 814 |
| oclif-base | 467 |
| plugin-adr / api / bff / coder | 3,628 |
| **repo total (approx.)** | **~21,900** |

Templates: 56 EJS files — 20 in `base-mfe`, 24 in `base-mfe-angular`, 12 in
`plugin-bff/templates`. Reference fleets: 21 MFEs across `examples/abc-kids`
and `examples/meridian-station`.

**The generator core that would actually be extracted is far smaller.** `codegen`
and `dsl` import exactly ten symbols from `contracts`:

```
PLATFORM_CAPABILITIES, PLATFORM_CAPABILITY_SPECS, PLATFORM_WRAPPER_METHODS   (platform-contract.ts, 304)
SLOT_ID_SEGMENT, isSlotParamSegment                                          (slot-grammar.ts, 47)
ValidationError, SystemError                                                 (errors/, ~100)
createSlotAddressRegistry, SlotProviderDeclarations                          (slot-contract.ts — control-plane only)
```

So the extractable surface is roughly:

| Piece | LOC |
|---|---|
| contracts slice actually needed | ~450 of 2,197 |
| dsl minus `type-system.ts` and control-plane | ~1,600 of 2,746 |
| codegen | 2,494 |
| **extractable generator core** | **~4,500 + 56 templates** |

That is the headline: a ~4,500-line generator is currently distributed through a
~22,000-line repo, and the boundary is real — it is obscured by a handful of
specific couplings, not by genuine entanglement.

### 1.4 The pipeline in detail

**Parse** (`packages/dsl/src/parser.ts`) — find `mfe-manifest.yaml`, YAML-parse,
hand to the validator.

**Validate** (`packages/dsl/src/schema.ts`, `validator.ts`) — Zod is the single
source of truth for the manifest language: it validates, the TypeScript types
are `z.infer`'d from it, and `schemas/dsl/manifest.schema.json` is emitted from
it. That is the strongest design decision in the system and should survive
extraction untouched. `validateFull` = schema parse + `validateSemantics`
(duplicate capability names, PascalCase capabilities, kebab-case MFE name,
duplicate data sources, mesh plugin/transform classification).

**Plan** (`packages/codegen/src/render-model.ts`, `unified-generator.ts:172`) —
`extractManifestVars` turns the manifest into a flat bag of template variables;
`planRenderModel` walks `manifest.capabilities`, splits them into platform
capabilities (matched against `PLATFORM_CAPABILITY_SPECS`) and domain
capabilities, collects deduplicated lifecycle hooks, and separates
manifest-declared handler `source:` entries (ADR-040) from stub-generated hooks.
Pure — no disk, no rendering. This part is good.

**Render** (`unified-generator.ts:276`, `renderFiles`) — ~300 lines that fan the
model out into ~25 `files.push({ path, content, overwrite })` calls. This is the
complexity hot spot; see Finding E1.

**Emit** (`packages/codegen/src/template-io.ts`) — `writeGeneratedFiles` walks
the list and writes. The `overwrite` flag is the ownership map: `true` =
generator-owned (re-stamped every run, held byte-identical by
`check:mfe-drift`), `false` = developer-owned (seeded once, never touched).

### 1.5 The ownership model

This is the system's best idea and its most fragile mechanism. Ownership is
decided *per push site* by an inline boolean literal in `renderFiles`. Nothing
collects those decisions into one place, yet three separate consumers depend on
the split:

- `check:mfe-drift` compares only `overwrite: true` files;
- `check:mfe-consistency` scans only developer-owned files for platform
  migrations, via a `developerOwned` predicate the *caller* supplies
  (`packages/codegen/src/validate.ts:47`);
- `PLATFORM_MIGRATIONS` (ADR-082) exists specifically because regeneration
  cannot reach `overwrite: false` files.

Three consumers, one implicit definition spread across 25 literals. See
Finding E2.

### 1.6 The gate ecosystem

Thirteen verification gates, eight CI-enforced. The generator-relevant ones:

| Gate | What it actually proves |
|---|---|
| `check:mfe-drift:check` | Regenerating all 21 examples produces byte-identical **generator-owned** files |
| `check:mfe-consistency` | manifest ⇄ package.json ⇄ federation `shared` agree; reports migration warnings |
| `check:template-typecheck` | A scaffolded MFE per framework lane installs and typechecks against the runtime barrel |
| `build:schema:dsl:check` | `schemas/dsl/*.json` matches the Zod source |
| `build:schemas` | `schemas/<cmd>.json` matches the oclif registry + command result types |

Note: `build:schemas:check` is **not** in CI (only `build:schema:dsl:check` is).
`npm run build` regenerates the command schemas as a side effect, so a drifted
`schemas/*.json` is silently rewritten in CI rather than failed. Minor, but it
is a gate the CLAUDE.md gate list assumes is enforced.

There is also an unused-but-valuable asset: `scripts/codegen-characterization.ts`
generates every `abc-kids` manifest in dry-run mode and prints sorted
`{path, overwrite, sha256}` JSON. It is referenced only by ADR-061 and is not
wired to any test or gate. **This is the safety net the whole refactor needs.**

---

## 2. Findings

Grouped by kind. Each is independently verifiable at the cited location.

### A. Dead ends — code that goes nowhere

**A1 — `packages/dsl/src/type-system.ts` (638 LOC) has no production consumer.**
`parseType`, `toGraphQLType`, `toTypeScriptType`, `toPythonType`,
`generateZodSchema`, `validateValue` are referenced only by their own three test
files (834 LOC). It is not exported from `packages/dsl/src/index.ts`. Codegen
reads `DSLInput.type` / `DSLOutput.type` as opaque strings and hands them to
templates verbatim — no type string is parsed anywhere in the pipeline.

**Resolved: retained, not deleted.** The cross-language mappers are the concrete
shape of the platform's stated multi-language goal, and `LanguageSchema` already
admits python, go, rust and java; re-deriving them later costs more than
carrying them. The file now carries a header stating that it has no consumer,
what it costs (1,472 lines plus a 99/100/100/100 coverage threshold gating code
no shipped path executes), and that it sits outside the extraction boundary.
The defect was that its status was undiscoverable, not that it exists.

**A2 — `src/utils/manifestValidator.js` (210 LOC) is orphaned and misleading.**
Zero importers. Its header says *"SYNC WITH:
`src/codegen/UnifiedGenerator/unified-generator.ts`"* — a path that no longer
exists. It carries a third copy of the Mesh plugin/transform lists (see B1).

**A3 — Two scripts point at deleted paths.**
`scripts/generate-mfe.js:29` requires
`../src/codegen/UnifiedGenerator/unified-generator` (gone).
`scripts/test-mesh-dependencies.js` reads `src/codegen/templates/bff/*.ejs`
(gone — `src/codegen/templates/` now contains only `docker/`). Both are still in
the tree; `test:mesh-deps` is still a package.json script.

**A4 — `--force` was a three-layer no-op.**
`remote:generate --force` was parsed, passed to
`writeGeneratedFiles(allFiles, { force: options.force })` — and
`writeGeneratedFiles` never read it. The generator was *also* called with a
hardcoded `force: true` into a `generateAllFiles` option that was equally
unread. Running with and without the flag produced identical results. Its own
help text already said *"Deprecated no-op"*, so this was known and documented
rather than unnoticed.

It was not broken by an edit. Both meanings it could have carried were removed
deliberately: gating re-stamps of generator-owned files became meaningless when
ADR-043 made regeneration unconditional, and overwriting developer-owned files
is forbidden by the invariant ADR-082 quotes approvingly.

**Resolved: given the meaning ADR-082 lacks** (ADR-089, commit `06da32b`).
`--force` now re-seeds developer-owned *scaffolding* from current templates,
which is the repair action for the warnings ADR-082 can only emit — the
19-of-48 hand-edit tail from the ADR-017 rollout. Capability feature files stay
unreachable: they never enter the plan once implemented, so the split between
scaffolding the platform can rebuild and domain logic it must not touch is
structural, not a new flag. Re-seeds are reported as their own outcome
(`reseeded[]`, `PlannedChange.op: 'reseed'`, a red itemised list with a
recovery line) because it is the only op that can destroy work.

**A5 — `remote:init` advertised two flags it ignored.** *Removed* (`06da32b`).
`--template` and `--skip-install` were declared, parsed, and threaded into
`RemoteInitOptions`; `remoteInitCommand` read neither, and the command never
ran an install, so `--skip-install` had nothing to skip.

**A6 — Completed-migration shims still in `src/commands/`.**
`remote-init.ts`, `remote-generate.ts`, `remote-init-angular.ts` — three 4-line
re-export files whose comments say *"Remove when A7 completes Commander
removal."* The oclif migration (Epics A+B+C) is marked ✅ Done in CLAUDE.md.
They sit inside the oclif command glob (`dist/commands/**/*.js`) while exporting
functions rather than Command classes.

**A7 — `remote:init-angular` was a deprecated duplicate.** *Removed* (`06da32b`).
69 lines re-declaring the same flag set to call `remoteInitCommand(name,
{framework:'angular'})`, deprecated since ADR-036 made `--framework` the
documented path. Removing its `CATALOG_EXCLUDED` entry surfaced something the
exclusion had been hiding: the schema generator rejects hyphenated command ids
outright, because `schemas/<cmd>.json` encodes `:` as `-` and consumers decode
every `-` back to `:`. It could never have had a published schema.

**A8 — Three unused imports and one stale coverage glob.**
`unified-generator.ts:30` imports `ejs` (never called — all EJS use moved to
`template-io.ts`); line 32 imports `ValidationError` (never used); line 31
imports `CapabilityConfig` (never used). Lint does not catch these:
`@typescript-eslint/no-unused-vars` is set to `warn`
(`eslint.config.js`). Separately, `jest.config.js:52` collects coverage from
`src/codegen/UnifiedGenerator/**` (gone), and `package.json` declares
`clean:test-workspaces: node scripts/clean-test-workspaces.js` — a file that
does not exist.

**A9 — `src/utils/ensureFiles.js` (36 LOC)** is referenced only by its own test.

**A10 — `capabilityImplemented` does work its own docstring says is redundant.**
`template-io.ts` runs up to three regexes to decide whether a capability is
already implemented, and the docstring concedes: *"the generated stub already
exports `<Name>`, so a capability counts as 'implemented' from the moment its
file exists."* `fs.pathExists` already answers the question.

### B. Duplicated knowledge — the same fact stated in several places, differently

**B1 — Three copies of the Mesh plugin/transform allow-lists, and two of them
disagree on spelling.**

| Location | `responseCache` | `rateLimit` | `filterSchema` | `resolversComposition` |
|---|---|---|---|---|
| `packages/codegen/src/catalog.ts:265,286` | `responseCache` | `rateLimit` | `filterSchema` | `resolversComposition` |
| `packages/dsl/src/validator.ts:138,150` | `response-cache` | `rate-limit` | `filter-schema` | `resolvers-composition` |
| `src/utils/manifestValidator.js:13` | `responseCache` | (orphaned) | | |

These are not near-duplicates, they are **contradictory**. A manifest declaring
`transforms: [filterSchema]` is valid to `codegen` and an `unknown_transform`
error to `dsl`. A manifest declaring `filter-schema` is the reverse. Both
validators run on the same manifest. The codegen list additionally contains
`mock` in *both* the plugin set and the transform set, which makes its
misclassification check (`"X is a transform, not a plugin"`) unable to fire for
that entry in either direction.

**B2 — Two variant resolvers computing the same trio.**
`deriveBuiltinVariant` (`unified-generator.ts:100`) and
`resolveFrameworkVariant` (`src/framework/loader.ts:114`) implement the same
rule — *explicit `framework`, else `bundler:'webpack'` selects Angular* — and
both are live. The second loads a plugin off disk to read three string fields
the first computes from the manifest. The docstrings each state they must match
the other; nothing enforces it.

**B3 — Dependency versions duplicated into the framework plugins, and already
stale.**

| Package | `catalog.ts` (authoritative, ADR-050) | framework plugin's `getRuntimeDependencies()` |
|---|---|---|
| react / react-dom | `~18.2.0` | `^18.2.0` (`framework-react/src/plugin.ts:55`) |
| @angular/* | `^19.2.16` (comment cites GHSA-prjf-86w9-mfqv, GHSA-jrmj-c5cx-3cw6) | `^17.0.0` (`framework-angular/src/plugin.ts:60`) |
| zone.js | `~0.15.0` | `~0.14.0` |

The plugin copies are not read by anything (see C1), so nothing is broken today
— but the react entry would *fail the platform's own `react-pinned` rule*
(`packages/codegen/src/validate.ts`, which requires exactly `~18.2.0`), and the
Angular entry pins versions the catalog comment names as having published
security advisories. This is precisely the kind of stale duplicate that becomes
a live bug the moment someone wires the abstraction up.

**B4 — Overlapping validation entry points.** Five surfaces validate a manifest,
with no stated ownership between them:

1. `dsl/validator.ts::validateFull` — Zod + semantics (+ mesh classification)
2. `codegen/manifest-validation.ts::validateManifestConfiguration` — mesh
   classification again, this time throwing and printing
3. `codegen/validate.ts::validateMfeConsistency` — manifest ⇄ package.json ⇄
   federation (this one is clean and well-factored)
4. `dsl/slot-validation.ts` — slot declarations vs. app code
5. `src/utils/manifestValidator.js` — orphaned copy of (2)

Only (3) has a clear, non-overlapping remit.

**B5 — Four descriptions of the manifest language; the most authoritative-sounding
one is the most stale.**

Zod is genuinely the source of truth and the generated chain out of it is sound
(§1.4, Finding F). The problem is upstream: three hand-maintained prose
documents describe the same language, none is generated, and none is gated.

| Document | Lines | Declares itself | Read by code | Gated |
|---|---|---|---|---|
| `docs/DSL/dsl.yaml` | 644 | *"the complete platform contract that ALL MFEs must conform to"* | no | no |
| `docs/DSL/dsl-schema-reference.md` | 855 | the v3.2 schema reference | no | no |
| `docs/schemas/dsl-manifest.md` | — | correctly names Zod as the source | no | no |
| `packages/dsl/src/schema.ts` | 557 | — | **yes** | **yes** (`build:schema:dsl:check`) |

They have drifted in the predictable direction:

| Field | `dsl.yaml` | `dsl-schema-reference.md` | `schema.ts` |
|---|---|---|---|
| `providesSlots` | absent | present | present |
| `framework` / `bundler` | absent | absent | present |
| `data.mockSwitch` | absent | absent | present |

The file whose header claims to be the complete platform contract does not know
the slot contract exists — ADR-066 through ADR-073, marked ✅ Done. It is stamped
v3.2 and has not moved since. Nothing in `src/`, `packages/`, `scripts/` or
`tests/` reads any of the three; they are not fixtures and not golden files.

**The live defect inside the package.** `packages/dsl/src/types.ts` is a 52-line
back-compat re-export shim whose own header says *"single source of truth"* and
which then hand-restates two of the enums it re-exports:

```ts
export const VALID_LANGUAGES = ['javascript', 'typescript'] as const;
```

`LanguageSchema` in the same package admits six: `javascript`, `typescript`,
`python`, `go`, `rust`, `java`. Same package, four values apart. The three
constants (`VALID_MFE_TYPES`, `VALID_LANGUAGES`, `VALID_CAPABILITY_TYPES`) are
among the dead exports in the Phase 1 list, so nothing consumes the wrong answer
today. The header also cites `docs/dsl-schema-reference.md` — a path that does
not exist; the file is under `docs/DSL/`.

This is B1 in prose rather than code: one fact stated several times, in
different states, with the copy carrying the most authority in its own header
being the most out of date. The fix is the ADR-075 pattern already applied to
the ADR index and the system map — generate the reference from the schema, and
demote what remains to a worked example.

### C. Abstraction that exists but is not wired

**C1 — Six of `BaseFrameworkPlugin`'s thirteen abstract members have zero
consumers.**

`getTemplateDir`, `getTemplateVars`, `getRuntimeImport`, `getRuntimeClassName`,
`getSourceExtension`, `getRuntimeDependencies` are declared abstract in
`packages/contracts/src/framework-plugin.ts`, implemented in both shipped
plugins, and called by nothing outside the plugins themselves and the contract.
`getTemplateDir()` returns `src/codegen/templates/base-mfe`
(`framework-react/src/plugin.ts:61`) — **a directory that no longer exists**; the
templates moved to `packages/codegen/templates/`. Nobody noticed, because nobody
calls it.

**C2 — The generator hardcodes the branches the plugin system was built to
remove.** The header of `unified-generator.ts` states:

> *Framework differences are template-variant data, never branches in this file
> (ADR-036, ADR-061) — the variant is injected by the caller, which is what lets
> a third-party framework plugin work without editing the generator.*

`renderFiles` contains **six** hard comparisons against the string literal
`'angular-webpack'` — lines 292 (template directory), 325 (feature component and
spec filenames), 378 (remote entry filename), 523 (whether to emit the BFF
tsconfig), 576 (the entire root-template list), 618 (the entire entry-file list).
`FrameworkVariant.templateVariant` is itself typed as the closed union
`'react-rspack' | 'angular-webpack'` (line 89).

Adding a third framework today means editing the generator in six places and
widening a union, with a plugin system, an ADR, and a header comment all
asserting the opposite. This is the single most important finding for
extraction: the extension point the design promises does not exist.

The slot-template emission (line 700) shows the *correct* pattern already —
it probes the variant's template directory for `slots.*.ejs` rather than
branching on framework name. That pattern needs to be applied to the other six.

### D. Coupling that blocks extraction

**D1 — `codegen` reads templates out of `plugin-bff`, which depends on
`codegen`.**

```ts
// packages/codegen/src/unified-generator.ts:301
const bffTemplateDir = path.resolve(__dirname, '../../../packages/plugin-bff/templates');
```

`plugin-bff` imports `DEPENDENCY_VERSIONS` from `@seans-mfe/codegen`
(`plugin-bff/src/commands/bff/init.ts:13`). So the two packages are mutually
dependent — one edge declared in `package.json`, the other a hardcoded relative
path that escapes the package root. Consequences:

- `packages/codegen/package.json` ships `files: ["dist", "templates"]`. A
  published `@seans-mfe/codegen` **cannot generate a BFF at all** — 12 templates
  it needs are in a package it does not depend on.
- The path assumes a fixed directory depth (`__dirname` = `packages/codegen/dist`).
  Any change to the build output layout silently breaks BFF generation.
- No test catches it: `check:mfe-drift` runs in-repo, where the path resolves.

**D2 — The generator prints to the console.** Twelve `console.*` calls in
`packages/codegen/src` — seven `console.warn`/`console.log` in
`unified-generator.ts` (missing-template warnings, "Preserved (already
implemented): …") and five in `manifest-validation.ts` including
`console.warn('\n⚠️  Manifest Configuration Warnings:')` and
`console.log('✅ Manifest validation passed: …')`.

A library that writes emoji to stdout is not extractable, and this violates the
repo's own rule (*"No `console.log` in production code — use the structured
logger"*). It also collides with the JSON-envelope contract: under `--json`,
stdout must carry exactly one `CommandResult<T>` line. `dsl` and `contracts`
have zero `console.*` — `codegen` is the only offender.

**D3 — `validateManifestConfiguration` throws and prints instead of returning.**
It is the first thing `generateAllFiles` calls. Turning it into a pure function
that returns diagnostics is a prerequisite for both D2 and any embedding of the
generator in something that is not a CLI.

### E. Complexity hot spots

**E1 — `renderFiles` is a ~300-line procedure with ~25 inline emit sites.**
`unified-generator.ts:276-779`. The plan phase is pure and testable; the render
phase is a long imperative sequence in which template selection, output path,
ownership, conditional inclusion, and framework branching are interleaved at
every site, each with a different shape:

- some use `fs.pathExists` guards, some do not;
- some warn on a missing template, some are silent, some consult
  `OPTIONAL_PUBLIC_ASSETS`;
- some build ad-hoc arrays of `{tpl, out, overwrite}` (BFF at 522, root
  templates at 575, Angular entries at 619) and loop — three near-identical
  loops with three different field names;
- one file (`__mocks__/fileMock.js`, line 771) is emitted as a hardcoded string
  literal with no template at all.

Every one of those is the same operation. There are at least four different
spellings of it in one function.

**E2 — Ownership has no single definition.** Twenty-five inline `overwrite:`
booleans, consumed by three subsystems that each need the ownership split
(§1.5). The most breaking edit available in the package — flipping a file
between the two — is invisible in review, which is exactly why ADR-082 and
`PLATFORM_MIGRATIONS` had to be invented. The registry is the right response to
the risk; the risk itself is removable.

**E3 — `extractManifestVars` returns a 30-field anonymous object.** Its return
type is inferred (`ReturnType<typeof extractManifestVars>`), so the template
contract is implicit. Three of its fields (`capabilities`, `lifecycleHooks`,
`handlerSources`) are initialised to empty arrays and overwritten by
`planRenderModel` afterwards — a two-phase construction that the type system
cannot enforce, annotated in-source with `// will be overwritten in
generateAllFiles`.

**E4 — Large exported surface with no internal consumer.** Across `codegen` and
`dsl`, ~60 exported symbols have no reference outside their defining file and
its tests — including 28 Zod sub-schemas in `dsl/src/schema.ts`
(`DSLInputSchema`, `PerformanceConfigSchema`, `ProvidedSlotSchema`, …) exported
alongside the composed `DSLManifestSchema` that is the only one used. For a
package about to become a standalone product, every exported symbol is a
compatibility promise. Most of these were never meant to be one.

### F. What is already good — do not touch

Worth stating plainly, because the refactor should protect these:

- **Zod as the single source of truth** for the manifest — types inferred,
  JSON Schema generated, one definition. The mechanism is exactly right and
  should be preserved as-is. Note the qualifier from B5: the chain *downstream*
  of `schema.ts` is clean, but three hand-written documents upstream still
  claim to define the same language and have drifted from it. Keep the
  mechanism; retire the shadow copies.
- **`scripts/generate-schemas.ts`** — deriving MCP tool inputs from the live
  oclif registry and outputs from the command's declared `T` via the TypeScript
  compiler. Its header documents four real drift bugs this design made
  unrepresentable.
- **`packages/codegen/src/validate.ts`** — rule taxonomy, severity model,
  pure-core/IO-shell split, `checked[]` so callers know which rules ran. Best
  file in the generator; use it as the template for the others.
- **`packages/codegen/src/drift.ts`** — pure diff with an injected reader, plus
  `findOrphanedGeneratedFiles` closing the shrinking-manifest direction.
- **The plan/render/emit split itself.** The seam is correct. Only the render
  phase is unfinished.
- **`scripts/codegen-characterization.ts`** — the byte-exact safety net. It just
  needs to be wired to a gate.

---

## 3. Target architecture

The extracted generator should be four modules and **one** extension point.

```
gen-contract/     the manifest language: zod schemas, inferred types,
                  JSON Schema emitter, platform capability set.
                  Zero IO. Zero console. No framework knowledge.

gen-core/         plan(manifest, variant) -> FileSpec[]        pure
                  render(FileSpec[], io)  -> GeneratedFile[]   template IO only
                  emit(GeneratedFile[], io) -> WriteReport     disk only
                  Returns Diagnostic[]. Never prints. Never throws for
                  user-input problems.

gen-variants/     a variant = { templateDir, filePlan[], vars(manifest) }.
                  Data, not code. react-rspack and angular-webpack are the
                  first two; a third is a new directory, not a generator edit.

gen-checks/       validate.ts, drift.ts, platform-migrations.ts —
                  the pure rule engines, unchanged in spirit.
```

### 3.1 The key move: a declarative file plan

Replace the six framework branches and the ~25 hand-written emit sites with one
data table per variant:

```ts
interface FileSpec {
  /** Template path relative to the variant's template directory. */
  template: string;
  /** Output path relative to the MFE root. */
  out: string;
  /** The ownership decision — the single place it is ever made. */
  owner: 'generator' | 'developer';
  /** Emit only when this holds. Absent = always. */
  when?: (ctx: PlanContext) => boolean;
  /** Extra template vars beyond the shared model. */
  vars?: (ctx: PlanContext) => Record<string, unknown>;
  /** Absence of the template is a variant's choice, not a defect. */
  optional?: boolean;
}
```

`renderFiles` then collapses to roughly:

```ts
for (const spec of variant.filePlan) {
  if (spec.when && !spec.when(ctx)) continue;
  const tpl = path.join(variant.templateDir, spec.template);
  if (!(await io.exists(tpl))) {
    if (!spec.optional) diagnostics.push(missingTemplate(spec, tpl));
    continue;
  }
  files.push({
    path: path.join(basePath, resolveOut(spec, ctx)),
    content: await io.render(tpl, { ...vars, ...spec.vars?.(ctx) }),
    overwrite: spec.owner === 'generator',
  });
}
```

Roughly 30 lines instead of 300. What this buys, concretely:

| Today | After |
|---|---|
| Adding a framework = editing 6 branches + widening a union | Adding a framework = a template directory + a `FileSpec[]` |
| Ownership = 25 inline booleans | Ownership = one `owner` column, greppable as a table |
| Missing-template handling = 4 different shapes | One code path, `optional` as data |
| `check:mfe-drift` / `mfe:validate` / `PLATFORM_MIGRATIONS` each infer the ownership split | All three read the same exported plan |
| The template contract is `ReturnType<typeof extractManifestVars>` | An explicit, named `RenderModel` interface |

Per-capability feature files (the one genuinely dynamic fan-out) stay a separate,
small loop — but expressed as a `FileSpec[]` generator function so it lands in
the same pipeline.

### 3.2 Diagnostics instead of printing

```ts
interface GenerateResult {
  files: GeneratedFile[];
  preservedCapabilities: string[];
  diagnostics: Diagnostic[];   // { severity, code, message, location?, fix? }
}
```

Reuse the `ValidationIssue` shape already proven in
`packages/codegen/src/validate.ts` — severity, `fix`, `location`. The CLI renders
them with chalk; the MCP server serialises them into the envelope; a library
consumer reads them. One shape, three presentations.

---

## 4. The plan

Six phases. Phases 0–2 are behaviour-preserving and independently mergeable.
Phase 3 onward changes internal structure but not generated bytes.

**The invariant for every phase: `scripts/codegen-characterization.ts` output is
byte-identical before and after.** Generated artifacts are the product; any diff
is a defect until proven an intended fix.

---

### Phase 0 — Build the safety net (½ day)

Nothing else starts until this is green.

1. `npm run clean && npm run build:packages` (required — `check:mfe-drift` and
   `check:template-typecheck` resolve packages to their compiled output and will
   silently check the last build).
2. Extend `scripts/codegen-characterization.ts` to cover **both** fleets — it
   walks `examples/abc-kids` only: 14 of 21 MFEs, and exactly one Angular
   variant (`multiplication-quiz`). Three of the platform's four Angular MFEs
   live in `meridian-station`, and Angular is where all six framework branches
   key. The full baseline is 21 MFEs / 435 files.
3. Export `captureSnapshot()` and guard `main()` behind
   `require.main === module`. Importing the module currently generates 21 MFEs
   as an import side effect, which is what makes it unusable from a test.
4. Commit the snapshot as a fixture and assert it from a Jest test. Today the
   harness runs only when someone remembers the two-command recipe in its
   docstring — across the whole ADR-061 packages migration, apparently never.
5. Record baseline output of every gate.

**Exit:** a single `npm test` failure tells you the generator's output changed.

**Why this is not redundant with `check:mfe-drift` — measured, not assumed.**
Planting a trailing comment in `App.tsx.ejs`, a developer-owned template:

| Gate | Result |
|---|---|
| `check:mfe-drift:check` | exit 0 — did not see it |
| `check:mfe-consistency` | exit 0 — did not see it |
| `build:codegen-snapshot:check` | **exit 1 — caught it** |

Planting the same change in `mfe.ts.ejs` (generator-owned) fails both drift and
the baseline; reverting returns both to green. **182 of the 435 generated files
— 42% — are developer-owned and therefore structurally invisible to the drift
gate.** That is the same blind spot that let the ADR-017 rollout leave 19 files
stale with every gate green (CLAUDE.md, §"Platform changes that reach generated
code"). The refactor touches templates on both sides of that line, so the
baseline is the only gate that covers the whole blast radius.

---

### Phase 1 — Delete (1 day)

Pure subtraction. Every item is A-series, provable, zero behaviour change.

**Done** — commit `5b2ef17`, verified byte-identical output:

| Deleted | LOC (source + tests) |
|---|---|
| `src/utils/manifestValidator.js` + test (A2) | 683 |
| `scripts/test-mesh-dependencies.js`, `scripts/generate-mfe.js` (A3) | 495 |
| `src/utils/ensureFiles.js` + test (A9) | 328 |
| `scripts/remove-dist-shims.js` + its build step — existed only to sweep up after the shims | 35 |
| `src/commands/remote-{init,generate,init-angular}.ts` shims (A6) | 12 |
| 18 unused imports (A8) — 14 in `unified-generator.ts`, 4 in `render-model.ts` | — |
| Stale jest coverage globs and thresholds; `clean:test-workspaces`, `test:mesh-deps` (A8) | — |
| **Net** | **1,603 deletions / 32 insertions** |

Two findings changed shape once the work started, both worth recording:

- **The shims were load-bearing.** Five test suites imported through
  `../remote-init` and `../remote-generate`. The reference check that called
  them dead excluded `__tests__` directories. They now import the real modules
  directly, which is what the shims existed to avoid needing.
- **The lint escalation paid for itself immediately.** Raising
  `no-unused-vars` to `error` — scoped to `contracts`/`dsl`/`codegen`, the
  extraction boundary, since the rest of the repo carries 11 pre-existing
  warnings that belong to their own change — found 18 dead imports rather than
  the 3 this document predicted. Fourteen were the `import` half of an
  `export … from` that already re-exported the same symbols.

**Retained by decision:** `type-system.ts` (A1), now marked in-source.

**Done, second slice** — commit `06da32b`, ADR-089:

- `--force` given the meaning ADR-082 lacks (A4) — see the finding above.
- `--template` / `--skip-install` removed (A5); `remote:init-angular` removed (A7).
- The now-empty migration-shim exclusion in `command-conformance`, orphaned by
  the first slice.

**Deferred to Phase 4** — `capabilityImplemented` (A10). The plan filed this as
a deletion, and it is not one. Replacing the three regexes with `fs.pathExists`
leaves the on-disk result identical in every case — an existing feature file is
either omitted from the plan or pushed as developer-owned and skipped by the
writer — and the snapshot is byte-identical across all 21 MFEs. But the two
differ in *reporting* for a file that exists without exporting its capability:
today it appears in the dry run as `skip — yours`, after it would vanish into
`preservedCapabilities`. That is a semantic change, however small, and it
belongs with the Phase 4 rework of preservation rather than smuggled into a
deletion pass.

Two judgement calls to make here, not assume:

- **`--force`**: delete it, or implement it? It is published to MCP agents. My
  recommendation: delete. The ownership model is the product; a flag that
  promises to override it and does not is worse than no flag, and
  `unified-generator.ts`'s own header says developer-owned files are never
  rewritten *"not even with `--force`"* — so the documented behaviour is that it
  does nothing. Make that explicit by removing it.
- **`type-system.ts`**: delete, or keep for the multi-language ambition?
  `toPythonType`/`toGraphQLType` point at the "any framework, any language" goal
  in CLAUDE.md. My recommendation: delete from the extracted core and keep the
  file in git history / a `future/` note. It has never been called; re-deriving
  it when a language target actually exists will cost less than carrying 1,640
  lines of untested-in-anger code into a prototype.

Also bump `@typescript-eslint/no-unused-vars` from `warn` to `error` in this
phase, so A8 cannot recur.

**Exit:** characterization identical; all gates green.

---

### Phase 2 — Single-source the duplicated facts (1 day)

**2a. One Mesh allow-list (B1).** Decide the canonical spelling — camelCase, to
match `catalog.ts`, the manifest examples, and `DEFAULT_MESH_TRANSFORMS`. Move
the tables to `packages/contracts/src/` (they are contract data, not generator
data). Delete the `dsl/validator.ts` copies and the `manifestValidator.js` copy
(already gone in Phase 1). Fix the `mock`-in-both-sets bug. Grep all 21 example
manifests for kebab-case transform names and migrate any found — this is the one
step in Phase 2 that can change generated bytes, so do it under the
characterization harness and review any diff deliberately.

**2b. One variant resolver (B2).** Keep `deriveBuiltinVariant` in `codegen` as
the pure default. Reduce `resolveFrameworkVariant` to: load the plugin, read
`{framework, bundler, id}`, done — and have it *delegate* to
`deriveBuiltinVariant` for the name-resolution rule rather than restating it.
One implementation of "explicit `framework`, else `bundler:'webpack'` ⇒ Angular".

**2c. Resolve the framework-plugin dead surface (C1).** Two options — this is a
real fork and worth a decision rather than a default:

- *Narrow:* delete the six uncalled abstract members. `BaseFrameworkPlugin`
  shrinks to what is actually consumed (`id`, `framework`, `bundler`,
  `displayName`, `defaultPort`, `directoryStructure`, `checkEnvironment`,
  `startDevServer`, `buildProduction`, `getDockerStrategy`,
  `getSharedDependencies`, `getTestExtension`). Honest, immediate, ~120 LOC gone.
- *Wire:* keep them and make Phase 4 consume them — `getTemplateDir()` becomes
  the real template lookup, `getRuntimeDependencies()` the real version source.

**Recommendation: narrow now, and let Phase 4's `variant.templateDir` /
`variant.filePlan` become the wired extension point.** The existing methods are
the wrong shape for what Phase 4 needs (a directory *and* a file plan, not six
scalar getters), and keeping a broken `getTemplateDir()` alive through the
refactor just preserves the confusion. Fix the stale
`src/codegen/templates/...` paths as part of the deletion, and delete the stale
version tables in B3 with them.

**Exit:** each fact stated once; characterization identical.

---

### Phase 3 — Decouple for extraction (1–2 days)

**3a. Move the BFF templates into `codegen` (D1).**
`packages/plugin-bff/templates/**` → `packages/codegen/templates/bff/**`. Delete
the `../../../` path escape at `unified-generator.ts:301`. `plugin-bff` keeps
importing `DEPENDENCY_VERSIONS` from `codegen` — the dependency becomes a proper
DAG edge in one direction only. This also makes a published `@seans-mfe/codegen`
able to generate a BFF, which it currently cannot.

Add a regression test that resolves every template path from the package's
`files:` manifest rather than from the repo root, so a future path escape fails
at test time.

**3b. Diagnostics instead of `console.*` (D2, D3).** Thread a `Diagnostic[]`
through `generateAllFiles`; make `validateManifestConfiguration` return
`{ ok, diagnostics }` rather than throw-and-print. `remote:generate` renders
them. Escalate `no-console` to `error` for `packages/codegen/**` so it cannot
regress.

**Exit:** `packages/{contracts,dsl,codegen}` contain zero `console.*` and zero
paths that escape their own package root. Characterization identical.

---

### Phase 4 — The file-plan refactor (2–3 days)

The one that makes it a product. Do it strictly incrementally, running the
characterization harness after each sub-step.

1. Name the render model. Replace `ReturnType<typeof extractManifestVars>` with
   an explicit `RenderModel` interface; make `capabilities` /`lifecycleHooks` /
   `handlerSources` constructor inputs rather than post-assignment (E3).
2. Introduce `FileSpec` and the generic emit loop. Migrate the three existing
   ad-hoc `{tpl, out, overwrite}` arrays (BFF 522, root 575, Angular entries
   619) to it first — they are already 90% of the shape.
3. Migrate the remaining ~15 individual `files.push` sites, a few at a time.
4. Lift the six `'angular-webpack'` branches into the two variant file plans
   (C2). At this point `unified-generator.ts` contains no framework name.
5. Extract `react-rspack.ts` and `angular-webpack.ts` as variant modules:
   `{ templateDir, filePlan, vars }`.
6. Export the ownership table derived from the file plans, and have
   `check:mfe-drift`, the `developerOwned` predicate in `validate.ts`, and the
   dry-run planner all read it instead of inferring it (E2).

**Acceptance test for the whole phase:** add a third variant in a test fixture —
a trivial `preact-rspack` with a two-file plan — and generate from it **without
editing any file under `gen-core/`**. If that requires a core edit, the phase is
not done. That test is the durable guard against C2 returning.

**Exit:** `unified-generator.ts` under ~150 lines; zero framework literals in
core; characterization identical.

---

### Phase 5 — Draw the extraction boundary (1 day)

1. Carve the contracts slice: `errors/`, `platform-contract.ts`,
   `slot-grammar.ts` (~450 LOC) into `gen-contract`. Everything else in
   `contracts` — `envelope.ts`, `messages.ts`, `observability.ts`,
   `presentation.ts`, `build-output-parser.ts`, `framework-plugin.ts` — is CLI
   and runtime concern and stays behind.
2. Move `control-plane-{schema,compiler}.ts` out of `dsl`. It is composition, not
   manifest language, and it is the only reason `dsl` touches
   `createSlotAddressRegistry`.
3. Prune the public surface (E4): export `DSLManifestSchema`, the inferred
   types, and the pipeline entry points. Stop exporting the 28 sub-schemas and
   the ~30 internal interfaces. Add an `api-surface` snapshot test so additions
   to the public API are deliberate.
4. Consolidate the manifest documentation (B5). Generate the field reference
   from `DSLManifestSchema` the way the ADR index and system map are generated,
   and gate it. Delete `docs/DSL/dsl-schema-reference.md`; strip the "complete
   platform contract" claim from `docs/DSL/dsl.yaml` and move it to
   `examples/` as a worked example, or delete it. Fix the stale doc path in
   `packages/dsl/src/types.ts` — or delete that shim outright, since Phase 1
   already removes its only non-re-export content.
5. Replace `file:` dependencies with real versions; verify `npm pack` produces a
   tarball that generates a complete React MFE *and* a complete BFF MFE in a
   clean directory outside the repo. This is the actual extraction acceptance
   test, and it is the one that would fail today because of D1.

**Exit:** `npm pack` → install in a scratch directory → generate both fleets'
manifests → byte-identical to the characterization snapshot.

---

## 5. Summary

| Phase | Effort | Removes | Risk |
|---|---|---|---|
| 0 — safety net | ½ day | — | none · **done** (`f8ada74`) |
| 1 — delete | 1 day | 1,603 LOC (partial · CLI surface held) | very low (provable dead code) |
| 2 — single-source facts | 1 day | ~200 LOC, 3 contradictions | low (one manifest migration) |
| 3 — decouple | 1–2 days | 1 cycle, 12 `console.*` | low |
| 4 — file plan | 2–3 days | ~250 LOC, 6 branches | medium — mitigated by Phase 0 |
| 5 — boundary | 1 day | ~1,750 LOC of contracts + ~1,500 lines of shadow docs | low |

**~7 working days to go from a ~4,500-line generator embedded in ~22,000 lines,
with a broken extension point and a package cycle, to a standalone, publishable
generator whose extension point is proven by a test.**

The three findings that matter most, in order:

1. **C2** — the framework extension point does not exist. Six hardcoded branches
   sit behind a plugin system, an ADR, and a header comment all claiming
   otherwise. Everything else is tidying; this is the load-bearing defect.
2. **D1** — `codegen` and `plugin-bff` are mutually dependent through a
   hardcoded relative path, so the published package cannot generate a BFF.
   This is what would break on day one of extraction.
3. **B1** — three copies of the Mesh allow-lists, two of them using
   contradictory naming conventions, both live on the same manifest.

The rest — ~1,600 lines of dead code already gone, twelve `console.*` calls, a no-op
`--force` flag — is real weight but low-risk to shed.

The system's core ideas are sound: the manifest as the only input, Zod as the
single source of truth, plan/render/emit, and `overwrite` as the ownership
boundary. The work is finishing them, not replacing them.
