# Plan: Decouple example apps from the tool's npm workspace (polyglot-safe) + re-add standalone Angular example

> Follow-up to PR #161 (Angular + webpack MFE support). Intended to be executed
> **locally** with npm/registry access (e.g. via GitHub Copilot). Every step that
> needs `npm install`/`npm ci` is called out explicitly.
>
> **Scope:** a dedicated PR branched off `main` **after #161 merges** — not part of #161.

## Context

PR #161 (`claude/webpack-federated-module-class-dDMzf`) added Angular + webpack MFE generation to `seans-mfe-tool`. While validating it, a structural flaw surfaced: **generated example/demo apps are npm workspace members** (root `package.json` → `"workspaces": ["packages/*", "src/runtime", "examples/abc-kids/*"]`). That couples the **tool's** install/build/CI to every example's dependency graph. Concretely, adding the Angular `multiplication-quiz` example (Angular 17 deps that conflict with the React/TS-5.9 root) broke `npm ci` for *all* CI jobs (`test`, `perf`, `e2e`), because the lockfile went out of sync and Angular's peers need `--legacy-peer-deps`.

That example was removed from #161 (commit `c99ee7a`) to get CI green. This plan does the real fix so polyglot examples (React, Angular, future Vue/etc.) can coexist **without any example being able to break the tool**, then re-adds the Angular example as a standalone (non-workspace) project and wires it into the abc-kids shell.

**Principle:** the tool's root install graph contains only the tool's own code (`packages/*`, `src/runtime`). Example apps are *consumers* of the tool's output — self-contained projects with their own `node_modules`, resolving `@seans-mfe-tool/runtime` via a `file:` dependency rather than workspace hoisting. This also mirrors real external usage (a consumer generates an MFE in their own repo and installs the runtime as a normal dependency).

## Key facts (verified)

- `@seans-mfe-tool/runtime` is the package at `src/runtime/` (`package.json` name `@seans-mfe-tool/runtime`, `main`/`types` = `index.ts` — consumed as **TypeScript source**, transpiled by each example's bundler).
- Existing React examples (`flappy`, `hockey`, `shell`) and the generator templates reference it as `"@seans-mfe-tool/runtime": "*"` — resolves **only** via workspace symlink.
  - `src/codegen/templates/base-mfe/package.json.ejs:18`
  - `src/codegen/templates/base-mfe-angular/package.json.ejs:17`
- The abc-kids shell `shared` block (`examples/abc-kids/shell/rspack.config.js` ~lines 37–43) declares React/MUI singletons but **no Angular** — a single Angular remote works, but the shell must declare `@angular/*` singletons to host Angular remotes cleanly.
- `npm ci` validates the whole lockfile against all workspace `package.json`s, so **any** change to `workspaces` membership or a member's deps requires regenerating `package-lock.json` via `npm install`.

## Implementation

### Step 1 — Remove examples from the tool's workspace
- `package.json` (root): change `"workspaces"` from `["packages/*", "src/runtime", "examples/abc-kids/*"]` to `["packages/*", "src/runtime"]`.

### Step 2 — Make each existing example resolve the runtime standalone
For `examples/abc-kids/flappy`, `hockey`, `shell` `package.json`:
- Replace `"@seans-mfe-tool/runtime": "*"` with a `file:` dep pointing at the runtime, path relative to each example dir:
  `"@seans-mfe-tool/runtime": "file:../../../src/runtime"`
- (`shell` consumes the runtime only via the `RemoteMFEInstance` type in `remotes.d.ts`; confirm whether it actually imports the package — if not, the `file:` dep may be unnecessary there.)

### Step 3 — Make the generator emit a standalone-resolvable runtime dep
Both `package.json.ejs` templates currently emit `"@seans-mfe-tool/runtime": "*"`, which won't resolve once examples aren't workspace members.
- Introduce a template variable (e.g. `runtimeDep`) and emit it in place of `"*"`.
- Default value = published spec `"^0.1.0"` (see Decision 1). In-repo examples (Steps 2 & 6) override to `file:../../../src/runtime`.

### Step 4 — Regenerate the lockfile (REQUIRES npm)
```bash
npm install                      # rebuilds package-lock.json for the new workspace + file: deps
git add package.json package-lock.json examples/abc-kids/*/package.json src/codegen/templates/**/package.json.ejs
git commit -m "refactor(workspace): decouple example apps from tool workspace; runtime via file: dep"
```
- Verify the tool still installs cleanly and `npm ci` would pass:
```bash
rm -rf node_modules && npm ci    # must succeed with NO --legacy-peer-deps
```

### Step 5 — Per-example CI isolation (optional but recommended)
- In `.github/workflows/*.yml`, the `test`/`perf`/`e2e` jobs run `npm ci` at the root — now they install only tool code, so an example can't break them.
- Optionally add a separate, non-blocking job (or matrix) that installs/builds each example independently so examples don't silently rot. Keep `continue-on-error: true` or a separate workflow so a broken example never blocks the tool PR.

### Step 6 — Re-add the Angular example as a standalone project
- Regenerate (or restore from Devin's branch `origin/devin/1779446971-angular-multiplication-quiz`) `examples/abc-kids/multiplication-quiz`, but as a **non-workspace** project:
  - Its `package.json` uses `"@seans-mfe-tool/runtime": "file:../../../src/runtime"` and is NOT matched by the root `workspaces` (already excluded after Step 1).
  - It has its **own** `node_modules` (gitignore `examples/**/node_modules` if not already) and installs via `cd examples/abc-kids/multiplication-quiz && npm install --legacy-peer-deps` (Angular 17 peers).
- Re-add the abc-kids shell wiring (from Devin's commit `4c442a0`): `shell/rspack.config.js` remote entry, `shell/src/remotes.d.ts`, `GameBrowser.tsx`, `GameLauncher.tsx`.
- In `shell/rspack.config.js` `shared`, add Angular singletons so the shell can host the Angular remote without "two copies of Angular":
  ```js
  '@angular/core':              { singleton: true, requiredVersion: '^17.0.0' },
  '@angular/common':            { singleton: true, requiredVersion: '^17.0.0' },
  '@angular/platform-browser':  { singleton: true, requiredVersion: '^17.0.0' },
  ```

## Critical files

- `package.json` (root `workspaces`)
- `examples/abc-kids/{flappy,hockey,shell}/package.json` (runtime `file:` dep)
- `src/codegen/templates/base-mfe/package.json.ejs`, `src/codegen/templates/base-mfe-angular/package.json.ejs` (generator runtime dep)
- `examples/abc-kids/shell/rspack.config.js` (Angular singletons + remote entry), `shell/src/remotes.d.ts`, `shell/src/components/{GameBrowser,GameLauncher}.tsx`
- `examples/abc-kids/multiplication-quiz/**` (re-added standalone)
- `package-lock.json` (regenerated — Step 4)
- `.github/workflows/*.yml` (optional per-example job — Step 5)

## Verification

Run locally (npm required):
1. **Tool install is decoupled:** `rm -rf node_modules && npm ci` → succeeds with no `--legacy-peer-deps`, installs only `packages/*` + `src/runtime` (no Angular/React example deps in the root tree).
2. **Tool build:** `npm run build` → completes through `oclif manifest` + `build:schemas`.
3. **Tool tests:** `npm test` → green; coverage gate holds.
4. **React examples still run standalone:** `cd examples/abc-kids/flappy && npm install && npm run dev` (and `hockey`).
5. **Angular example runs standalone:** `cd examples/abc-kids/multiplication-quiz && npm install --legacy-peer-deps && npx ng serve` → serves, `remoteEntry.js` reachable.
6. **Shell hosts both:** run shell + flappy + multiplication-quiz; confirm the React and Angular remotes both mount via `mfe.render()` with no duplicate-framework console errors.
7. **CI:** branch off `main` (after #161 merges), push, and confirm `test (18.x/20.x)`, `perf`, `e2e` all green on the new PR.

## Decisions (resolved)

1. **Generator runtime dep default** — generator emits a **published spec** `"@seans-mfe-tool/runtime": "^0.1.0"` (portable for external consumers). The **in-repo examples** (Steps 2 & 6) override to `file:../../../src/runtime` so they resolve today. Note: the published spec is unresolvable until `@seans-mfe-tool/runtime` is actually published (MERGE-PLAN Phase 1) — acceptable, since in-repo examples use `file:` and external consumers install post-publish.
2. **Scope** — dedicated PR opened after #161 merges, branched off `main`. Not part of #161.
3. **Shell `shared` Angular singletons** — declare them **lazy** (omit `eager: true`), so the Angular framework only loads when an Angular remote is actually used and the shell's initial bundle isn't bloated for React-only sessions.
