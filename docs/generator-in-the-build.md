# How the generator runs in the build of any MFE

**Status:** Informative. The rules live in the ADRs cited in each section; this page
says them in plain language and shows where they meet.
**Read this when:** you want to know what happens between `mfe-manifest.yaml` and a
built MFE, and which files you may edit afterwards.
**Deeper reference:** [Code Generation Architecture](./architecture-codegen.md) (the
internals) and [Platform Contract](./PLATFORM-CONTRACT.md).

---

## The idea in four sentences

1. Every MFE is described by one file: `mfe-manifest.yaml`. It is the source of truth
   (ADR-043).
2. The generator reads that file and **writes the platform layer for you**, so nobody
   hand-writes lifecycle, registration or BFF plumbing (PDR-001).
3. The generator splits its output into files **it owns** and files **you own**. It
   re-stamps its own on every run and never touches yours (ADR-082, ADR-091).
4. The build runs the generator first, every time, so the platform layer can never be
   older than the manifest.

---

## Where the generator sits in the build

A generated MFE's `build` script starts with the generator. This is the line in the
scaffolded `package.json` (React lane; the Angular lane is identical except for the
bundler):

```
seans-mfe-tool remote:generate  &&  rspack build  &&  mesh build   (mesh only if the manifest has `data:`)
```

So "building an MFE" is three steps in order:

| Step | What runs | What it does |
|---|---|---|
| 1. Generate | `remote:generate` | Reads the manifest, writes the platform layer |
| 2. Bundle | `rspack build` (React) or `ng build` (Angular) | Compiles the source into `dist/` |
| 3. BFF | `mesh build` | Builds the GraphQL Mesh BFF, only when the manifest declares `data:` |

The Docker image does the same thing: its build stage runs `npm run build`, then
copies `dist/` into nginx. Nothing else calls the generator, so nothing else needs to
know it exists.

Two related commands do **not** run the generator. `build:dev` and `build:prod` ask the
framework plugin to serve or bundle what is already on disk (ADR-036). Generate first,
or let `npm run build` do it.

---

## What the generator does, in five steps

`remote:generate` is a thin wrapper. The real work is `generateAllFiles()` in
`packages/codegen/src/unified-generator.ts`, which never writes to disk.

```
mfe-manifest.yaml
      │
      ▼
 1. VALIDATE ── bad manifest? stop here. Nothing is written.
      │
      ▼
 2. PICK THE FRAMEWORK ── react+rspack, angular+webpack, or a plugin's own
      │
      ▼
 3. PLAN ── read the manifest into one "render model" (pure, no disk)
      │
      ▼
 4. RENDER ── turn the model into a list of files, each tagged with an owner
      │
      ▼
 5. WRITE ── write the list, honouring each file's owner
```

**1. Validate.** The manifest is checked against its schema, and its mesh plugin and
transform settings are checked against the rules in ADR-027. A failure throws a
`ValidationError` before any file exists, so a bad manifest cannot leave half a
project behind.

**2. Pick the framework.** One rule decides it: `resolveWebTarget()` (ADR-092 §4).
`framework`/`bundler` at the top of the manifest and `targets.web` are two spellings
of the same fact (ADR-095 §6). If they disagree, validation rejects the manifest.
If neither is set you get React with rspack, which keeps every older MFE working.
The CLI turns the answer into a *variant* by loading the framework plugin and hands it
to the generator. The generator holds no framework names of its own (ADR-036,
ADR-061), which is why a third-party framework works without editing it.

**3. Plan.** The manifest's capabilities are sorted into the ten platform capabilities
(`load`, `render`, `refresh`, `authorizeAccess`, `health`, `describe`, `schema`,
`query`, `emit`, `UpdateControlPlaneState`) and your own domain capabilities. Lifecycle
hooks are collected across `before → main → after → error`, with the first declaration
of a name winning. A hook that names a `source` is wired through a generated
`handler-registry.ts` instead of becoming an empty stub (ADR-040).

**4. Render.** The variant supplies a *file plan*, which is a list of data, not
branching code (ADR-093). Each entry says: which template, where it lands, who owns
it, and when it applies. Plugins can contribute entries too, each with its own
templates (ADR-094 §2). Any domain capability whose feature code already exists is
left out of the plan completely, so it is out of `--force`'s reach as well
(ADR-091 §3).

**5. Write.** `writeGeneratedFiles()` applies the ownership rule below.

The generator also **returns** warnings and errors instead of printing them. The CLI
decides how to show them (ADR-094).

---

## The one rule that matters: who owns each file

Every file the generator emits carries an owner. This is the most important field in
the package, because it decides whether regeneration may overwrite the file.

| | Generator-owned | Developer-owned |
|---|---|---|
| Flag in code | `overwrite: true` | `overwrite: false` |
| On every `remote:generate` | Re-stamped | Written once, then left alone |
| If you edit it | Your edit is lost on the next build | Your edit is safe |
| Examples | `platform/base-mfe/mfe.ts`, `platform/bff/bff.ts`, `platform/types.ts`, `public/index.html`, `.gitignore` | `src/index.tsx`, `App.tsx`, feature components, `package.json`, bundler config |
| Held honest by | `check:mfe-drift` | `mfe:validate`, `check:mfe-consistency` |

What this means in practice:

- **Never edit under `platform/`.** The next build will erase it. Change the manifest,
  or the template, instead.
- **Your code is yours.** Regeneration prints `Kept (developer-owned)` for each file it
  skipped. No flag changes that, except one.
- **`--force` re-seeds developer-owned files.** It overwrites your edits with fresh
  scaffolding and lists every file it replaced so you can run `git checkout -- <path>`
  (ADR-091). Use `--dry-run` first: it labels each file as new, re-stamped, kept or
  re-seeded.

---

## What happens when the platform changes

A platform change can reach a generated MFE in two ways, and only one is automatic.

- **Generator-owned files** are fixed by the next build. `npm run check:mfe-drift`
  proves they match a fresh generation.
- **Developer-owned files** are not fixed by anything. Instead, the platform *tells you*.
  Every change that can reach them ships a `PLATFORM_MIGRATIONS` entry
  (`packages/codegen/src/platform-migrations.ts`, ADR-082). After a run that skipped
  files, `remote:generate` scans them for code that uses the old thing and prints the
  file, line and fix. `seans-mfe-tool mfe:validate <dir>` reports the same.

The platform reports what it cannot fix. It never rewrites your code to fix it.

The same pattern covers dependency versions: they land in the developer-owned
`package.json`, so a changed pin is reported as drift for you to act on, not silently
applied.

---

## Fleet-level gates

One command regenerates and checks every example MFE in the repo. These are what keep
the claims above true:

| Gate | What it proves |
|---|---|
| `npm run check:mfe-drift:check` | Every generator-owned file matches a fresh generation. Also flags *orphans*: generated files left on disk after the manifest stopped producing them. Reported, never auto-deleted. |
| `npm run check:mfe-consistency` | Manifest, `package.json` and federation `shared` agree. This is the gate that catches a changed dependency version. |
| `npm run check:template-typecheck` | A freshly scaffolded MFE in each framework lane installs and typechecks against the runtime's public exports. |
| `seans-mfe-tool mfe:validate [dir]` | One MFE is internally consistent, with platform-migration warnings. |

Run `check:mfe-drift:check` and `check:mfe-consistency` together. Neither covers what
the other sees. If a result stops making sense, run `npm run clean` and rebuild:
several gates resolve packages to their compiled `dist/` output.

---

## A second build from the same manifest

A manifest can declare more than one build. `targets.swift` adds a Swift Package and
`targets.rust` adds a Cargo crate, both beside the web remote (ADR-095, ADR-099). The
generator treats each as a framework plugin with a `targetId`. The plugin carries both
halves: its build lifecycle and its file contribution to the generator (ADR-097). Which
plugins register is decided by the manifest, not by import side effects, and
`build:prod` builds every declared target in turn.

---

## Adding a framework

Add a variant module and a template directory, then publish a framework plugin whose
`templateVariant` matches. The generator file does not change (ADR-036, ADR-093). An
unregistered variant id is reported as an `unregistered-variant` error rather than
quietly falling back to React.

---

## Quick reference

| I want to… | Run |
|---|---|
| Build an MFE | `npm run build` (generates, then bundles) |
| See what generation would do | `seans-mfe-tool remote:generate --dry-run` |
| Regenerate without bundling | `seans-mfe-tool remote:generate` |
| Check one MFE is consistent | `seans-mfe-tool mfe:validate <dir>` |
| Check every example MFE for hand-edits | `npm run check:mfe-drift:check` |
| Fix drift by regenerating | `npm run check:mfe-drift`, then commit |

## ADRs this page rests on

| ADR | Decision |
|---|---|
| 027 | Mesh plugin and transform config is validated before generation |
| 036 | Framework plugins; the generator never branches on framework |
| 040 | Hooks can declare handler `source`s, wired by a generated registry |
| 043 | The manifest drives the whole pipeline; regeneration is idempotent |
| 061 | The framework variant is injected into the generator |
| 082 | The platform reports breaking changes in developer-owned code and never rewrites it |
| 091 | `--force` re-seeds developer-owned scaffolding, loudly |
| 092 | One rule resolves the web framework and bundler |
| 093 | The file plan is data |
| 094 | The generator is a library: it returns diagnostics and receives contributions |
| 095, 097, 099 | Secondary build targets and the plugin that carries both halves |
