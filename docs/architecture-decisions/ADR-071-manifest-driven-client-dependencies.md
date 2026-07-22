---
id: 0071
title: Manifest-Driven Client Dependencies and Federation Shared
status: Accepted
date: 2026-07-19
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [codegen, dependencies, module-federation, package.json, templates, drift]
summary: Generated React `package.json` client dependencies and the Module-Federation `shared` block are derived from `mfe-manifest.yaml` (`dependencies.runtime` + `dependencies.design-system`) instead of being hardcoded in the EJS templates. Framework versions still come from `DEPENDENCY_VERSIONS` (ADR-027/ADR-050); the manifest chooses which libraries ship. `shared` covers framework singletons + the design-system only, never arbitrary runtime libraries.
rationale-summary: The templates force-injected React + MUI + emotion into every MFE and ignored `dependencies.runtime`, so any other library (babylon, styled-components, zustand) had to be hand-added to `package.json` and then drifted from the manifest and the federation config. Deriving both from the manifest makes that class of drift impossible by construction while preserving today's default (MUI) for MFEs that declare nothing.
long-form: true
---

# ADR-071: Manifest-Driven Client Dependencies and Federation Shared

## Context

`mfe-manifest.yaml` already declares an MFE's dependencies — the DSL
`DependenciesSchema` (`packages/dsl/src/schema.ts`) has `runtime`,
`design-system`, and `mfes` sections, and PDR-001 ("generate, don't
hand-write") makes the manifest the source of truth for what codegen emits.

But the React templates ignored it. `base-mfe/package.json.ejs` unconditionally
emitted `react`, `react-dom`, `@mui/material`, `@mui/system`, `@emotion/react`,
`@emotion/styled` and nothing else; `base-mfe/rspack.config.js.ejs` hardcoded the
same set into the Module-Federation `shared` block. `dependencies.runtime` was
read only for the runtime *version* (via `muiVersion`), never to decide *which*
libraries the project ships.

Consequences, seen concretely in `meridian-docking-simulation` (PR #292):

- Babylon.js and styled-components had to be hand-added to `package.json`, so
  they lived outside the manifest and drifted (wrong versions, missing from
  `shared`).
- MUI + emotion were force-installed into an MFE that does not use them, and sat
  in `shared` as eager singletons the app never loads.
- A federation `shared` key could reference a package that isn't an installed
  dependency, and nothing caught it.

ADR-050 already made `DEPENDENCY_VERSIONS` the single source for version
*strings*. This ADR closes the remaining gap: which *packages* a generated MFE
declares, and what it federates.

## Decision

### 1. `package.json` client dependencies are derived from the manifest

For a React MFE the client dependency set is:

```
framework singletons   (react, react-dom)      ← DEPENDENCY_VERSIONS (ADR-027/050)
+ design-system         (manifest.dependencies['design-system'], or the default)
+ runtime extras        (manifest.dependencies.runtime, minus framework packages)
```

Framework packages (`react`, `react-dom`) are always sourced from
`DEPENDENCY_VERSIONS`, never from the manifest — the manifest chooses libraries,
the platform pins framework versions.

### 2. Design-system resolution

- **Nothing declared** → the platform default (MUI + emotion peers). Existing
  MFEs that declare no `design-system` regenerate byte-for-byte identically.
- **A declaration containing `@mui/*`** → the full MUI + emotion stack, with the
  declared versions winning. A bare `@mui/material: ^5.x` still ships the emotion
  peers MUI requires (it's a footgun otherwise).
- **A non-MUI declaration** (e.g. `styled-components`) → used verbatim. The MFE
  stops force-pulling MUI. This is what `meridian-docking-simulation` should have
  declared.

### 3. Federation `shared` = framework + design-system only

The `shared` block is derived from framework singletons + the resolved
design-system. Arbitrary `runtime` libraries (babylon, zustand, …) are **not**
auto-shared — forcing a heavy, app-specific library into a single shared instance
across the shell is usually wrong, and sharing should be a deliberate choice, not
a side effect of declaring a dependency. (Federation eager-singleton behavior is
governed by ADR-044.)

### 4. Angular

Angular framework/build deps continue to come from `DEPENDENCY_VERSIONS`.
Declared non-framework `runtime` (and `design-system`) libraries are appended to
the generated `package.json` so Angular MFEs can declare extra libraries the same
way. Angular has no default design system.

## Implementation

Pure resolver functions in `packages/codegen/src/unified-generator.ts`
(`resolveDesignSystemDeps`, `resolveRuntimeExtraDeps`, `resolveClientDependencies`,
`resolveReactSharedDeps`), unit-tested directly. `extractManifestVars` preformats
the dependency/`shared` strings (`clientDependencyLines`, `rspackSharedEntries`,
`angularExtraDependencyLines`) so ordering and formatting are deterministic — a
prerequisite for the generate-and-diff drift gate (#295, ADR-065's idiom).

## Consequences

- Declared libraries can no longer drift from `package.json` or `shared`.
- MUI stops being force-injected; MFEs opt out by declaring a design-system.
- Existing MFEs that declare no `design-system` are unaffected.
- **Behavior change:** an MFE that declares a *non-MUI* design-system no longer
  receives MUI. This is intended. The standalone dev harness template
  (`index.tsx`/`App.tsx`) still imports MUI and should be made design-system-aware
  in a follow-up; it does not affect the federated remote entry.

## References

- PDR-001 — Generate, don't hand-write
- ADR-027 / ADR-050 — `DEPENDENCY_VERSIONS` single source for version strings
- ADR-043 — Manifest-driven codegen pipeline
- ADR-044 — Federation eager-singleton behavior for generated MFEs
- ADR-065 — Generate-and-diff drift gate idiom (applied to MFEs in #295)
- #294 — this change; #293 — single-sourced the version literals it builds on
