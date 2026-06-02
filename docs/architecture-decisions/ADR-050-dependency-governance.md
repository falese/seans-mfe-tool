---
id: 0050
title: Dependency Governance — Pinning Strategy, hasBff Gate, and DEPENDENCY_VERSIONS
status: Implemented
date: 2026-05-30
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [codegen, dependencies, security, bff, package.json, templates]
summary: Three rules govern generated MFE `package.json` files. (1) All version strings come from the `DEPENDENCY_VERSIONS` constant in `unified-generator.ts` — no hardcoded versions in templates. (2) Mesh/BFF deps are only emitted when the manifest declares a `data:` section (`hasBff`). (3) A targeted `overrides` block forces safe transitive versions to close known vulnerability chains without a blanket `npm audit fix --force`.
rationale-summary: Phantom BFF deps in non-BFF projects bloated installs, broke dev scripts, and added unnecessary Mesh vulnerability surface. DEPENDENCY_VERSIONS as a single source of truth prevents template drift. The npm overrides block is the minimal, deliberate response to known transitive CVEs in generated projects.
long-form: true
---

# ADR-050: Dependency Governance — Pinning Strategy, hasBff Gate, and DEPENDENCY_VERSIONS

## Context

The `package.json.ejs` template in `src/codegen/templates/base-mfe/` generates
the `package.json` for every React MFE. Prior to this ADR, that template
unconditionally included:

- **Prod deps**: `@graphql-mesh/serve-runtime`, `@graphql-tools/*`,
  `@graphql-mesh/plugin-response-cache`, `@graphql-mesh/plugin-prometheus`,
  `@graphql-mesh/transform-naming-convention`, `express`, `cors`, `helmet`, `tslib`
- **Dev deps**: `@graphql-mesh/cli`, `@graphql-mesh/openapi`,
  `@types/cors`, `@types/express`
- **Scripts**: `bff:dev`, `prebff:dev`, `mesh:validate`; the `dev` script ran
  `concurrently "rspack serve" "npm run bff:dev"` which fails when
  `server.ts` and `.mesh/` do not exist

Hockey (`abc-kids-hockey`) has no `data:` section in its manifest and therefore
no BFF — yet it received all of these deps and a broken dev script. This is the
*phantom BFF* problem.

Additionally, the dev-only moderate vulnerability chain
`@rspack/cli → @rspack/dev-server → webpack-dev-server → sockjs → uuid@<11.1.1`
was present in all generated non-BFF projects with no mitigation, and
BFF projects already had an `overrides` block for `fast-uri` but non-BFF
projects had none.

## Decision

### 1. `DEPENDENCY_VERSIONS` as single source of truth (ADR-027 extension)

All dependency version strings in `package.json.ejs` must be template
expressions (`<%= dependencyVersions.x.y %>`), never string literals. The
`DEPENDENCY_VERSIONS` constant in `src/codegen/UnifiedGenerator/unified-generator.ts`
is the authoritative registry. Reviewers can audit all generated versions in
one place; drift is impossible because the template has no literals to drift.

Pinning strategy:
- `^` ranges for most runtime deps and build tools — allows compatible patch/minor upgrades.
- `~` for tight peer dependencies in Angular (Angular CLI, builders, zone.js) — prevents Angular CLI version matrix mismatches.
- Exact version (`0.105.19`) for `@graphql-mesh/transform-naming-convention` — a known-good locked version following the Mesh v0.100.x resolution (ADR-027).
- npm `overrides` for forced transitive versions (see §3 below).

### 2. `hasBff` gate — BFF deps only when manifest declares `data:`

`extractManifestVars` in `unified-generator.ts` computes:

```typescript
const hasBff = !!manifest.data;
```

The template gates all Mesh/BFF content on this flag:

| Section | Gated by `hasBff` |
|---|---|
| Prod deps: `@graphql-mesh/serve-runtime`, `@graphql-tools/*`, mesh plugins, mesh transforms, `express`, `cors`, `helmet`, `tslib` | Yes |
| Dev deps: `@graphql-mesh/cli`, `@graphql-mesh/openapi`, `@types/cors`, `@types/express` | Yes |
| Scripts: `bff:dev`, `prebff:dev`, `mesh:validate` | Yes |
| `dev` script: `concurrently "rspack serve" "npm run bff:dev"` | Yes — falls back to `rspack serve` |
| `concurrently` in devDeps | Yes |
| `ts-node` in devDeps | Yes |

A manifest without `data:` receives a lean package.json containing only React,
MUI, rspack, TypeScript, ESLint, Jest, and the `serve` static server.

### 3. npm `overrides` for transitive vulnerability closure

Every generated `package.json` includes a targeted `overrides` block:

**Non-BFF projects** (`hasBff === false`):
```json
"overrides": {
  "uuid": "^11.1.1"
}
```
Closes: `@rspack/cli → @rspack/dev-server → webpack-dev-server → sockjs → uuid@<11.1.1` (moderate, dev-only chain).

**BFF projects** (`hasBff === true`):
```json
"overrides": {
  "fast-uri": ">=2.3.0"
}
```
Closes: the `fast-uri` high-severity chain in the Mesh dependency tree (pre-existing, carried forward).

These overrides are deliberate and minimal. `npm audit fix --force` is
explicitly **prohibited** — it downgrades packages and introduces its own
regression surface. Only intentional overrides targeting specific CVE chains
are added here.

## Consequences

- Hockey and all future non-BFF React MFEs receive a clean, lean `package.json`
  with no phantom Mesh packages and a working `dev` script (`rspack serve`).
- BFF-equipped MFEs (those with a `data:` section) retain all Mesh deps,
  BFF scripts, and the `fast-uri` override — no change in their behaviour.
- `DEPENDENCY_VERSIONS` becomes the only place to update a generated dep
  version; template maintenance surface is reduced.
- The moderate uuid chain in `@rspack/cli` is closed in all non-BFF generated
  projects without touching rspack itself.
- Security-conscious CI audits (`npm audit --audit-level=moderate`) will pass
  on generated projects with these overrides in place.

## Alternatives Considered

- **Upgrade `@rspack/cli` to v2.x** — investigated but deferred. rspack 2.x
  changes the `ModuleFederationPlugin` import path (`@rspack/core/container`)
  and requires rspack config changes in generated projects. This is a separate
  migration concern (see `rspack.config.js.ejs`). The uuid override closes the
  moderate chain at lower risk.
- **Single `overrides` block for all projects** — rejected. Including `fast-uri`
  in non-BFF projects is noise; it only matters when Mesh is present.
- **Remove ts-node from all devDeps** — ts-node is only needed for `server.ts`
  (BFF runtime). Non-BFF projects have no use for it. Gated correctly by `hasBff`.

## Traceability

- ADR-027: GraphQL Mesh v0.100.x with Production Plugins & Transforms
  (DEPENDENCY_VERSIONS origin; Mesh version pins; `fast-uri` override)
- ADR-034: Pluggable bundler + framework via codegen variants
  (template variant selection context)
- ADR-043: Manifest-Driven Code Generation Pipeline
  (the pipeline this ADR adds a governance layer to)
- Files:
  - `src/codegen/UnifiedGenerator/unified-generator.ts` — `DEPENDENCY_VERSIONS`,
    `hasBff` computation in `extractManifestVars`
  - `src/codegen/templates/base-mfe/package.json.ejs` — gated template
  - `src/codegen/UnifiedGenerator/__tests__/unified-generator.test.ts` —
    `hasBff package.json gating — ADR-050` test suite (10 new tests)
  - `examples/abc-kids/hockey/package.json` — regenerated, clean (no BFF deps)
  - `examples/abc-kids/flappy/package.json` — regenerated, clean (no BFF deps,
    flappy also has no `data:` section)
