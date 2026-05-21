---
id: 0069
title: Pluggable bundler + framework via codegen variants
status: Accepted
date: 2026-05-21
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [codegen, bundler, framework, mfe, module-federation]
summary: Add optional manifest fields `framework` and `bundler` that drive codegen template variant selection in UnifiedGenerator, alongside a new concrete runtime class `AngularRemoteMFE` that is a direct sibling of `RemoteMFE`. The first non-default variant is Angular 17+ standalone components + webpack 5 native ModuleFederationPlugin.
rationale-summary: The codegen path was hardcoded to React + rspack. Adding Angular + webpack support without breaking the dozens of existing MFEs requires (a) the manifest schema to express which target the MFE wants, (b) a parallel template directory selected by that field, and (c) a parallel runtime class implementing the same `BaseMFE` contract with framework-specific render/mount and shared-deps. The new class is a sibling — not a subclass — of `RemoteMFE` so React assumptions can't bleed into Angular code and vice versa.
long-form: true
---

# ADR-069: Pluggable bundler + framework via codegen variants

## Context and problem statement

`seans-mfe-tool` scaffolded remote MFEs as React 18 + rspack Module Federation containers exclusively. The runtime side was `RemoteMFE extends BaseMFE` at `src/runtime/remote-mfe.ts`; the codegen side was `UnifiedGenerator.generateAllFiles()` rendering EJS templates from `src/codegen/templates/base-mfe/`. The template directory, the root config filenames (`rspack.config.js`), the entry filenames (`App.tsx`, `index.tsx`, `remote.tsx`), and the feature file extensions (`.tsx`, `.test.tsx`) were all hardcoded.

A new requirement landed: scaffold an Angular 17+ standalone-component remote MFE built with webpack 5 + native `ModuleFederationPlugin`, as a true peer of the existing React/rspack path. ADR-068 records the rspack-only choice for that prior epoch but does not restrict future bundlers.

## Decision

1. **Manifest schema gains two optional fields.** `framework: 'react' | 'angular'` and `bundler: 'rspack' | 'webpack'`, both optional. Absence preserves today's behavior (`framework = react`, `bundler = rspack`). Validation rejects unknown values.

2. **`UnifiedGenerator` selects a `templateVariant`** from the manifest. The variant chooses:
   - the **template directory** (`src/codegen/templates/base-mfe` for react-rspack; `src/codegen/templates/base-mfe-angular` for angular-webpack),
   - the **root template list** (`rspack.config.js` vs `webpack.config.js` + `tsconfig.json` + `tsconfig.app.json`),
   - the **entry-file block** (`App.tsx` + `index.tsx` vs `src/main.ts` + `src/bootstrap.ts` + `src/polyfills.ts` + `src/app/app.component.ts`),
   - the **feature file extensions** (`.tsx`/`.test.tsx` vs `.component.ts`/`.component.spec.ts`),
   - and the **MF expose target** (`src/remote.tsx` vs `src/remote.ts`).

   The BFF block (server.ts, Dockerfile, docker-compose, README) is framework-agnostic and runs identically for both variants. The generator's public entry point (`generateAllFiles(manifest, basePath, opts)`) is unchanged — callers pass the manifest and the variant is derived internally.

3. **New runtime concrete class: `AngularRemoteMFE extends BaseMFE`.** A direct sibling of `RemoteMFE`, NOT a subclass. Same atomic load lifecycle (Entry → Mount → EnableRender) with identical telemetry checkpoint names (`load-entry`, `load-entry-metric`, `load-mount`, `load-mount-metric`, `load-enable-render`, `load-enable-render-metric`, `load-completed`, `load-error`, `render-*`) so platform consumers stay framework-agnostic. Framework-specific differences are isolated to:
   - `mountComponent()` — uses `bootstrapApplication()` from `@angular/platform-browser` to bootstrap the named standalone component, applies props as `@Input()` fields on the bootstrapped instance, and tracks one `ApplicationRef` per containerId,
   - `getSharedDependencies()` — Angular singletons (`@angular/core`, `@angular/common`, `@angular/platform-browser`) with `strictVersion: true`, plus `zone.js` with `eager: true`,
   - `unmount(containerId)` — calls `appRef.destroy()` instead of `root.unmount()`.
   - `doUpdateControlPlaneState`, `doHealth`, `doDescribe`, `doSchema`, `doEmit`, `doRefresh`, `doAuthorizeAccess`, `doQuery` are framework-agnostic and copied from `RemoteMFE`.

4. **New oclif command: `remote:init-angular`.** Parallel to `remote:init`. Writes only `mfe-manifest.yaml` (parity with `remote:init`), but with `framework: 'angular'` + `bundler: 'webpack'` so the downstream `remote:generate` picks the angular-webpack variant. Default port 3101 (different from React default 3001 so both can run side-by-side).

## Why sibling, not shared base

Extracting a shared `FederatedRemoteMFE` base from `RemoteMFE` would reduce duplication of `extractAvailableComponents`/`extractCapabilities`/`fetchContainer` (~80 lines). The trade-off is dragging Module Federation lifecycle assumptions across both subclasses and making future framework variants (Vue, Svelte) have to fit a contract derived from today's two implementations. The duplicated helpers are small, stable, and framework-agnostic — easier to evolve them in place if a third framework arrives than to refactor an over-fitted base.

## Why native webpack `ModuleFederationPlugin` (not `@angular-architects/module-federation`)

`@angular-architects/module-federation` wraps webpack with Angular-aware defaults (zone.js singleton, `@angular/*` singletons). Convenient, but it adds a fourth-party dep that has its own release cadence and opinions, and the wrapper has historically lagged Angular major versions by weeks. Native `ModuleFederationPlugin` from `webpack.container` gives us full control over the `shared` block (we declare the Angular singletons explicitly in `webpack.config.js.ejs`), and matches the structure of our existing rspack config 1:1. ADR-069 explicitly leaves the wrapper out so future maintainers don't have to think about both paths.

## Why no NgModules

Angular 17+ standalone bootstrap (`bootstrapApplication()`) is the current Angular team's recommended path and matches the runtime API our `AngularRemoteMFE.mountComponent()` calls. NgModules add an extra layer of indirection without buying anything for a single-purpose remote MFE.

## Consequences

- A second template tree means two places to update when a cross-cutting change lands (e.g., a new BFF dep in `package.json.ejs`). The variants share the BFF block via `UnifiedGenerator` rather than EJS partials, so cross-cutting BFF changes touch only one file; cross-cutting per-framework changes (CORS headers, etc.) need to be applied twice. Acceptable trade-off given the template count is small and each tree is self-contained.
- The manifest schema picks up two optional fields. Existing MFEs in the wild are unaffected (absence ⇒ React/rspack); new MFEs may or may not declare framework/bundler.
- A future "react-webpack" or "angular-rspack" variant would need its own template tree under the same naming convention. The current implementation derives the variant from a coupled check (`framework === 'angular' || bundler === 'webpack'`) — when a third combination lands, this should become a true 2×2 variant matrix.

## Out of scope

- Vue / Svelte / Solid variants.
- A formal plugin API for third-party bundlers/frameworks. The current approach is "fork the template tree and add a variant" — fine for the two-target window.
- Auto-migrating existing React/rspack MFEs to Angular/webpack.
