# BFF Dependency Refactor Analysis

**Document Status:** ✅ Complete  
**Last Updated:** April 2026  
**Requirement:** REQ-MESH-DEPS-005  
**Related ADR:** ADR-062  

---

## Overview

This document captures the analysis performed for the GraphQL Mesh BFF dependency migration
(REQ-MESH-DEPS-005). It covers baseline findings, migration options evaluated, the decision
rationale, and current implementation status.

---

## Baseline State (Before ADR-062)

### Problems Found

The original BFF template (`src/codegen/templates/bff/package.json.ejs`, now
`packages/bff-plugin/templates/package.json.ejs`) had critical dependency issues:

| Problem | Description | Severity |
| ------- | ----------- | -------- |
| `"latest"` versions | All Mesh packages used `"latest"`, pulling incompatible versions | 🔴 Critical |
| Missing peer deps | `@graphql-tools/*` packages not explicitly declared | 🔴 Critical |
| `tslib` absent | Required by Mesh TypeScript emit but missing from template | 🟡 High |
| `helmet@^7` | Breaking API changes vs. current `^8.x` | 🟡 High |
| `NodeNext` module resolution | Incompatible with Mesh v0.100.x generated artifacts | 🔴 Critical |
| Old Mesh API | Used `getMesh()` / `findAndParseConfig()` (deprecated) | 🟡 High |

### Root Cause

The template was written before Mesh stabilized at v0.100.x. The use of `"latest"` was
fragile — a single Mesh release could pull in incompatible transitive versions and break
`npm install` with `ERESOLVE` errors.

---

## Migration Options Evaluated

### Option A: Migrate to compose-cli + omnigraph (Original Proposal)

**Target stack:**
```json
{
  "@graphql-mesh/runtime": "^0.100.21",
  "@graphql-mesh/compose-cli": "^0.5.x",
  "@omnigraph/openapi": "^0.4.x"
}
```

**Assessment:**

| Criterion | Result |
| --------- | ------ |
| `npm install` success | ⚠️ Partial — `@omnigraph/openapi@^0.4.x` had unmet peer deps |
| `.meshrc.yaml` format | ❌ Breaking — `compose-cli` uses different config schema |
| TypeScript types | ⚠️ Incomplete — `@omnigraph` had missing type exports |
| Documentation | ❌ Sparse — v1-era docs were incomplete at evaluation time |
| Stability | ❌ Pre-release — `compose-cli` was in early development |
| Migration effort | 🔴 High — all server templates require rewrite |

**Decision:** Not taken. The `compose-cli` + `omnigraph` stack was not production-ready.

---

### Option B: Lock to v0.100.x CLI (ADR-062 — CHOSEN)

**Target stack:**
```json
{
  "@graphql-mesh/cli": "^0.100.21",
  "@graphql-mesh/openapi": "^0.109.26",
  "@graphql-mesh/serve-runtime": "^1.2.4"
}
```

**Assessment:**

| Criterion | Result |
| --------- | ------ |
| `npm install` success | ✅ Clean — no ERESOLVE errors |
| `.meshrc.yaml` format | ✅ Unchanged — compatible with existing configs |
| TypeScript types | ✅ Complete — well-typed since v0.96.x |
| Documentation | ✅ Comprehensive — stable docs at the-guild.dev |
| Stability | ✅ LTS-equivalent — active security maintenance |
| Migration effort | 🟢 Low — minor API update only (`createBuiltMeshHTTPHandler`) |

**Decision:** ✅ Chosen. Locked versions prevent future drift, serve-runtime provides the
modern handler API without requiring a full platform migration.

---

## Changes Made (ADR-062, December 2025)

### 1. Centralized Version Constants

Added `DEPENDENCY_VERSIONS` object to `src/codegen/UnifiedGenerator/unified-generator.ts`.
This is the single source of truth — templates interpolate from it, preventing version drift.

### 2. Replaced "latest" with Pinned Ranges

All `"latest"` strings in `packages/bff-plugin/templates/package.json.ejs` replaced with
`^` ranges from `DEPENDENCY_VERSIONS`. Example:

```diff
- "@graphql-mesh/cli": "latest"
+ "@graphql-mesh/cli": "<%= dependencyVersions.graphqlMesh.cli %>"
```

### 3. Added Explicit Peer Dependencies

```json
"@graphql-tools/delegate": "^10.2.4",
"@graphql-tools/utils": "^9.2.1",
"@graphql-tools/wrap": "^10.0.5"
```

### 4. Fixed TypeScript Configuration

Changed from `NodeNext` to `commonjs` module resolution in generated `tsconfig.json`:

```json
{
  "module": "commonjs",
  "moduleResolution": "node",
  "skipLibCheck": true
}
```

### 5. Updated Server API

Replaced deprecated `getMesh()` + `findAndParseConfig()` with the v0.100.x pattern:

```typescript
import { createBuiltMeshHTTPHandler } from './.mesh';
const meshHandler = createBuiltMeshHTTPHandler<MeshContext>();
app.use('/graphql', meshHandler);
```

### 6. Production Plugin System

Added three-tier plugin system to templates (DSL-configurable via `mfe-manifest.yaml`):

- **Standard**: Response cache (default 5-min TTL), Prometheus metrics
- **Advanced**: OpenTelemetry tracing (opt-in, 10% sampling)
- **Opt-in transforms**: Rate limiting, schema filtering, resolvers composition

---

## Acceptance Criteria Status

From the original REQ-MESH-DEPS-005 issue:

| Criterion | Status | Evidence |
| --------- | ------ | -------- |
| `npm install` without ERESOLVE errors | ✅ Complete | Pinned versions in `DEPENDENCY_VERSIONS` |
| No peer dependency warnings | ✅ Complete | Explicit `@graphql-tools/*` in template |
| All Mesh packages use compatible GraphQL version | ✅ Complete | `graphql: "^16.8.1"` in all templates |
| rspack build succeeds | ✅ Complete | `@rspack/core@^1.7.0` in templates |
| Generated code compiles with TypeScript | ✅ Complete | `module: "commonjs"` in tsconfig |
| Runtime server starts without errors | ✅ Complete | `createBuiltMeshHTTPHandler()` pattern |
| GraphQL queries work end-to-end | ✅ Complete | E2E tests verified (2025-11-27) |
| Document version matrix | ✅ Complete | `docs/mesh-dependency-matrix.md` |

---

## Deferred Items

The following items from the original issue were consciously deferred or decided against:

| Item | Reason |
| ---- | ------ |
| Migrate to `@omnigraph/openapi` | Not stable at evaluation time; v0.109.26 is sufficient |
| Remove `@graphql-mesh/cli` | CLI is still needed for `mesh build` / `mesh dev` commands |
| Test with `@graphql-mesh/compose-cli` | Different architecture; track separately when v1 stabilizes |

These may be revisited when `@graphql-mesh` v1 reaches LTS status.

---

## References

- [ADR-062](./architecture-decisions/ADR-062-mesh-v0100-plugins.md)
- [docs/mesh-dependency-matrix.md](./mesh-dependency-matrix.md)
- [docs/archive/planning/DEPENDENCY-PLAN.md](./archive/planning/DEPENDENCY-PLAN.md)
- [docs/archive/planning/TEMPLATE-UPDATE-PLAN.md](./archive/planning/TEMPLATE-UPDATE-PLAN.md)
- [packages/bff-plugin/templates/package.json.ejs](../packages/bff-plugin/templates/package.json.ejs)
- [src/codegen/UnifiedGenerator/unified-generator.ts](../src/codegen/UnifiedGenerator/unified-generator.ts)
