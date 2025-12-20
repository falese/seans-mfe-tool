# Template Update Implementation Plan

## GraphQL Mesh Dependencies, Plugins, and DSL Enhancements

**Date**: 2025-12-06  
**Status**: READY FOR IMPLEMENTATION  
**Related**: TEMPLATE-UPDATE-PLAN.md, MESH-PLUGINS-RESEARCH.md

---

## Executive Summary

Update code generation templates to use correct GraphQL Mesh versions (v0.100.x), add production-ready plugins (response-cache, prometheus, naming-convention), support custom transforms, and extend DSL schema to configure observability and performance features.

**Impact**: All newly generated BFF/MFE projects will have correct dependencies, observability, and performance optimizations out-of-the-box.

---

## Part 1: Template Updates (Core Fix)

### 1.1 Add Dependency Version Constants

**File**: `src/codegen/UnifiedGenerator/unified-generator.ts`

**Location**: Top of file (after imports, before other code)

```typescript
// =============================================================================
// Dependency Version Constants
// =============================================================================

/**
 * Centralized dependency versions for template generation
 * Following e2e2 dependency resolution (2025-12-06)
 * Based on GraphQL Mesh v0.100.x stable releases
 */
export const DEPENDENCY_VERSIONS = {
  // GraphQL Mesh (BFF Layer)
  graphqlMesh: {
    cli: '^0.100.21', // Latest stable CLI
    openapi: '^0.109.26', // Latest OpenAPI handler
    serveRuntime: '^1.2.4', // HTTP handler runtime
  },

  // GraphQL Tools (Peer Dependencies)
  graphqlTools: {
    delegate: '^10.2.4',
    utils: '^10.5.7',
    wrap: '^10.0.5',
  },

  // Mesh Plugins (Production Features)
  meshPlugins: {
    responseCache: '^0.104.20',
    prometheus: '^2.1.8',
    opentelemetry: '^1.3.67',
  },

  // Mesh Transforms (Schema Manipulation)
  meshTransforms: {
    namingConvention: '^0.105.19',
    rateLimit: '^0.105.19',
    filterSchema: '^0.105.19',
    resolversComposition: '^0.105.19',
    cache: '^0.105.19',
  },

  // Core Dependencies
  core: {
    graphql: '^16.8.1',
    express: '^4.18.2',
    cors: '^2.8.5',
    helmet: '^8.1.0',
    tslib: '^2.6.0',
  },

  // React (Module Federation - Singleton)
  react: {
    react: '~18.2.0', // Tilde for tight version control
    reactDom: '~18.2.0',
  },

  // MUI (Design System)
  mui: {
    material: '^5.14.0',
    system: '^5.14.0',
    emotionReact: '^11.11.1',
    emotionStyled: '^11.11.0',
  },

  // Module Federation
  moduleFederation: {
    enhancedRspack: '^0.1.1',
  },

  // Build Tools
  buildTools: {
    rspackCli: '^0.5.0',
    rspackCore: '^0.5.0',
    typescript: '^5.3.3',
    tsNode: '^10.9.1',
    concurrently: '^8.2.0',
    serve: '^14.2.1',
  },

  // Browser Polyfills (for rspack)
  polyfills: {
    buffer: '^6.0.3',
    cryptoBrowserify: '^3.12.0',
    streamBrowserify: '^3.0.0',
    streamHttp: '^3.2.0',
    httpsBrowserify: '^1.0.0',
    pathBrowserify: '^1.0.1',
    osBrowserify: '^0.3.0',
    assert: '^2.1.0',
    process: '^0.11.10',
    events: '^3.3.0',
    url: '^0.11.3',
    util: '^0.12.5',
  },
};

/**
 * Plugin configuration defaults
 */
export const DEFAULT_MESH_PLUGINS = {
  // Always include (performance critical)
  responseCache: {
    ttl: 300000, // 5 minutes
    invalidate: { ttl: 0 },
  },

  // Production observability (standard tier)
  prometheus: {
    enabled: true,
    port: 9090,
    endpoint: '/metrics',
  },

  // Optional (advanced tier)
  opentelemetry: {
    enabled: false,
    sampling: { probability: 0.1 },
  },
};

/**
 * Transform configuration defaults
 */
export const DEFAULT_MESH_TRANSFORMS = {
  // Always include (API consistency)
  namingConvention: {
    typeNames: 'PascalCase',
    fieldNames: 'camelCase',
  },

  // Optional (advanced tier)
  rateLimit: {
    enabled: false,
  },

  filterSchema: {
    enabled: false,
  },
};
```

**Update**: `extractManifestVars()` function

```typescript
export function extractManifestVars(manifest: DSLManifest) {
  const className = manifest.name.replace(/[^a-zA-Z0-9]/g, '') + 'MFE';
  const inputTypeName = className + 'Inputs';
  const outputTypeName = className + 'Outputs';
  const port = manifest.endpoint ? Number(manifest.endpoint.split(':').pop()) : 3001;
  const muiVersion =
    manifest.dependencies?.['design-system']?.['@mui/material'] || DEPENDENCY_VERSIONS.mui.material;
  const remotes = manifest.dependencies?.mfes || {};

  // Extract performance/observability config from manifest (NEW)
  const performanceConfig = manifest.performance || {};
  const observabilityConfig = performanceConfig.observability || {};

  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    port,
    muiVersion,
    remotes,
    className,
    inputTypeName,
    outputTypeName,
    manifest,
    capabilities: [], // populated later in generateAllFiles
    lifecycleHooks: [], // populated later in generateAllFiles

    // NEW: Dependency versions for templates
    dependencyVersions: DEPENDENCY_VERSIONS,

    // NEW: Plugin/transform configs
    meshPlugins: {
      responseCache:
        performanceConfig.caching?.enabled !== false ? DEFAULT_MESH_PLUGINS.responseCache : null,
      prometheus:
        observabilityConfig.prometheus?.enabled !== false
          ? {
              ...DEFAULT_MESH_PLUGINS.prometheus,
              ...observabilityConfig.prometheus,
            }
          : null,
      opentelemetry: observabilityConfig.opentelemetry?.enabled
        ? {
            ...DEFAULT_MESH_PLUGINS.opentelemetry,
            ...observabilityConfig.opentelemetry,
          }
        : null,
    },

    meshTransforms: {
      namingConvention: DEFAULT_MESH_TRANSFORMS.namingConvention,
      rateLimit: performanceConfig.rateLimit?.enabled ? performanceConfig.rateLimit : null,
      filterSchema: performanceConfig.filterSchema?.enabled ? performanceConfig.filterSchema : null,
      customTransforms: manifest.transforms || [],
    },
  };
}
```

---

### 1.2 Update BFF Package Template

**File**: `src/codegen/templates/bff/package.json.ejs`

**Replace** dependencies section:

```json
{
  "name": "<%= name %>",
  "version": "<%= version %>",
  "description": "GraphQL BFF generated by seans-mfe-tool (ADR-046, ADR-062)",
  "type": "commonjs",
  "scripts": {
    "start": "concurrently \"rspack serve\" \"npm run bff:dev\"",
    "build": "rspack build && npm run bff:build",
    "serve": "serve dist -p <%= port %>",
    "bff:dev": "ts-node server.ts",
    "bff:build": "mesh build",
    "mesh:validate": "mesh validate",
    "test": "jest",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@graphql-mesh/cli": "<%= dependencyVersions.graphqlMesh.cli %>",
    "@graphql-mesh/openapi": "<%= dependencyVersions.graphqlMesh.openapi %>",
    "@graphql-mesh/serve-runtime": "<%= dependencyVersions.graphqlMesh.serveRuntime %>",
    "@graphql-tools/delegate": "<%= dependencyVersions.graphqlTools.delegate %>",
    "@graphql-tools/utils": "<%= dependencyVersions.graphqlTools.utils %>",
    "@graphql-tools/wrap": "<%= dependencyVersions.graphqlTools.wrap %>",
    <% if (meshPlugins.responseCache) { %>
    "@graphql-mesh/plugin-response-cache": "<%= dependencyVersions.meshPlugins.responseCache %>",
    <% } %>
    <% if (meshPlugins.prometheus) { %>
    "@graphql-mesh/plugin-prometheus": "<%= dependencyVersions.meshPlugins.prometheus %>",
    <% } %>
    <% if (meshPlugins.opentelemetry) { %>
    "@graphql-mesh/plugin-opentelemetry": "<%= dependencyVersions.meshPlugins.opentelemetry %>",
    <% } %>
    <% if (meshTransforms.rateLimit) { %>
    "@graphql-mesh/transform-rate-limit": "<%= dependencyVersions.meshTransforms.rateLimit %>",
    <% } %>
    <% if (meshTransforms.filterSchema) { %>
    "@graphql-mesh/transform-filter-schema": "<%= dependencyVersions.meshTransforms.filterSchema %>",
    <% } %>
    "@graphql-mesh/transform-naming-convention": "<%= dependencyVersions.meshTransforms.namingConvention %>",
    "@graphql-mesh/transform-resolvers-composition": "<%= dependencyVersions.meshTransforms.resolversComposition %>",
    "@module-federation/enhanced-rspack": "<%= dependencyVersions.moduleFederation.enhancedRspack %>",
    "cors": "<%= dependencyVersions.core.cors %>",
    "express": "<%= dependencyVersions.core.express %>",
    "graphql": "<%= dependencyVersions.core.graphql %>",
    "helmet": "<%= dependencyVersions.core.helmet %>",
    "tslib": "<%= dependencyVersions.core.tslib %>",
    "react": "<%= dependencyVersions.react.react %>",
    "react-dom": "<%= dependencyVersions.react.reactDom %>"
  },
  "devDependencies": {
    "@rspack/cli": "<%= dependencyVersions.buildTools.rspackCli %>",
    "@rspack/core": "<%= dependencyVersions.buildTools.rspackCore %>",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/react": "^18.0.28",
    "@types/react-dom": "^18.0.11",
    "concurrently": "<%= dependencyVersions.buildTools.concurrently %>",
    "eslint": "^8.55.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "ts-node": "<%= dependencyVersions.buildTools.tsNode %>",
    "typescript": "<%= dependencyVersions.buildTools.typescript %>",
    "serve": "<%= dependencyVersions.buildTools.serve %>",
    "buffer": "<%= dependencyVersions.polyfills.buffer %>",
    "crypto-browserify": "<%= dependencyVersions.polyfills.cryptoBrowserify %>",
    "stream-browserify": "<%= dependencyVersions.polyfills.streamBrowserify %>",
    "stream-http": "<%= dependencyVersions.polyfills.streamHttp %>",
    "https-browserify": "<%= dependencyVersions.polyfills.httpsBrowserify %>",
    "path-browserify": "<%= dependencyVersions.polyfills.pathBrowserify %>",
    "os-browserify": "<%= dependencyVersions.polyfills.osBrowserify %>",
    "assert": "<%= dependencyVersions.polyfills.assert %>",
    "process": "<%= dependencyVersions.polyfills.process %>",
    "events": "<%= dependencyVersions.polyfills.events %>",
    "url": "<%= dependencyVersions.polyfills.url %>",
    "util": "<%= dependencyVersions.polyfills.util %>"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Key Changes**:

- ✅ Remove `"type": "module"` (use CommonJS)
- ✅ Use `<%= dependencyVersions.* %>` pattern
- ✅ Conditional plugin includes based on DSL config
- ✅ React versions use tilde (`~18.2.0`)
- ✅ Remove deprecated @types/helmet

---

### 1.3 Update BFF Server Template

**File**: `src/codegen/templates/bff/server.ts.ejs`

**Replace** GraphQL handler section (lines ~49-66):

```typescript
// GraphQL BFF endpoint (from Mesh v0.100.x)
// Following REQ-BFF-003: JWT Authentication Forwarding
// Following ADR-062: Mesh v0.100.x with createBuiltMeshHTTPHandler
import { createBuiltMeshHTTPHandler } from './.mesh';
import type { Request, Response, NextFunction } from 'express';

interface MeshContext {
  jwt?: string;
  requestId: string;
  userId?: string;
}

const meshHandler = createBuiltMeshHTTPHandler<MeshContext>();

// Add context middleware before GraphQL handler
app.use(
  '/graphql',
  (req: Request, res: Response, next: NextFunction) => {
    // Attach context to request for Mesh
    (req as any).meshContext = {
      jwt: req.headers.authorization?.replace('Bearer ', ''),
      requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
      userId: extractUserIdFromToken(req.headers.authorization as string),
    };
    next();
  },
  meshHandler
);
```

**Remove** old imports:

```typescript
// DELETE these lines:
import { getMesh } from '@graphql-mesh/runtime';
import { findAndParseConfig } from '@graphql-mesh/cli';
import { graphqlHTTP } from 'express-graphql';
```

**Key Changes**:

- ✅ Use `createBuiltMeshHTTPHandler()` from generated `.mesh`
- ✅ Middleware pattern for context injection
- ✅ Remove runtime mesh initialization
- ✅ Remove express-graphql dependency

---

### 1.4 Update BFF TypeScript Config

**File**: `src/codegen/templates/bff/tsconfig.json`

**Replace** entire file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": ".",
    "declaration": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "lib": ["ES2022"]
  },
  "include": ["*.ts", "src/**/*.ts"],
  "exclude": ["node_modules", "dist", ".mesh"]
}
```

**Key Changes**:

- ✅ `"module": "commonjs"` (was NodeNext)
- ✅ `"moduleResolution": "node"` (was NodeNext)
- ✅ Add `"lib": ["ES2022"]`

---

### 1.5 Update Base-MFE Package Template

**File**: `src/codegen/templates/base-mfe/package.json.ejs`

**Apply same dependency pattern** as BFF template (use `<%= dependencyVersions.* %>`)

**Key additions**:

```json
{
  "dependencies": {
    // ... mesh deps same as BFF ...
    "@mui/material": "<%= dependencyVersions.mui.material %>",
    "@mui/system": "<%= dependencyVersions.mui.system %>",
    "@emotion/react": "<%= dependencyVersions.mui.emotionReact %>",
    "@emotion/styled": "<%= dependencyVersions.mui.emotionStyled %>"
  }
}
```

---

### 1.6 Update Mesh Config Template (NEW)

**File**: `src/codegen/templates/bff/meshrc.yaml.ejs`

**Create** new template for plugin/transform injection:

```yaml
# .meshrc.yaml - Auto-generated from DSL manifest data section
# REQ-BFF-001: DSL as Single Source of Truth
# ADR-046: GraphQL Mesh with DSL-embedded config
# ADR-062: Mesh v0.100.x with production plugins

# GraphQL Mesh Configuration
sources:
<%# Sources come from manifest.data.sources %>
<%= meshConfigYaml %>

# Plugins (Performance & Observability)
<% if (meshPlugins.responseCache || meshPlugins.prometheus || meshPlugins.opentelemetry) { %>
plugins:
<% if (meshPlugins.responseCache) { %>
  - responseCache:
      ttl: <%= meshPlugins.responseCache.ttl %>
      invalidate:
        ttl: <%= meshPlugins.responseCache.invalidate.ttl %>
<% } %>
<% if (meshPlugins.prometheus) { %>
  - prometheus:
      port: <%= meshPlugins.prometheus.port %>
      endpoint: <%= meshPlugins.prometheus.endpoint %>
      labels:
        service: <%= name %>
        version: <%= version %>
        environment: ${NODE_ENV:-development}
<% } %>
<% if (meshPlugins.opentelemetry) { %>
  - opentelemetry:
      serviceName: <%= name %>-bff
      sampling:
        probability: <%= meshPlugins.opentelemetry.sampling.probability %>
<% } %>
<% } %>

# Transforms (Schema Manipulation)
<% if (meshTransforms.namingConvention || meshTransforms.rateLimit || meshTransforms.filterSchema || meshTransforms.customTransforms.length > 0) { %>
transforms:
<% if (meshTransforms.namingConvention) { %>
  - namingConvention:
      typeNames: <%= meshTransforms.namingConvention.typeNames %>
      fieldNames: <%= meshTransforms.namingConvention.fieldNames %>
<% } %>
<% if (meshTransforms.rateLimit) { %>
  - rateLimit:
      config: <%= JSON.stringify(meshTransforms.rateLimit.config || []) %>
<% } %>
<% if (meshTransforms.filterSchema) { %>
  - filterSchema:
      filters: <%= JSON.stringify(meshTransforms.filterSchema.filters || []) %>
<% } %>
<% meshTransforms.customTransforms.forEach(transform => { %>
  - resolversComposition:
      <%- transform %>
<% }); %>
<% } %>
```

---

## Part 2: DSL Schema Extensions

### 2.1 Add Performance/Observability Schema

**File**: `src/dsl/schema.ts`

**Add** after DataConfig schema (around line 184):

```typescript
// =============================================================================
// Performance & Observability Schemas (ADR-062)
// =============================================================================

/** Caching configuration */
export const CachingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttl: z.number().default(300000), // 5 minutes
  strategies: z
    .array(
      z.object({
        type: z.string(),
        field: z.string(),
        ttl: z.number(),
      })
    )
    .optional(),
});
export type CachingConfig = z.infer<typeof CachingConfigSchema>;

/** Prometheus observability configuration */
export const PrometheusConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().default(9090),
  endpoint: z.string().default('/metrics'),
});
export type PrometheusConfig = z.infer<typeof PrometheusConfigSchema>;

/** OpenTelemetry observability configuration */
export const OpenTelemetryConfigSchema = z.object({
  enabled: z.boolean().default(false),
  serviceName: z.string().optional(),
  sampling: z
    .object({
      probability: z.number().min(0).max(1).default(0.1),
    })
    .optional(),
  exporters: z
    .array(
      z.object({
        type: z.string(),
        endpoint: z.string(),
      })
    )
    .optional(),
});
export type OpenTelemetryConfig = z.infer<typeof OpenTelemetryConfigSchema>;

/** Observability configuration */
export const ObservabilityConfigSchema = z.object({
  prometheus: PrometheusConfigSchema.optional(),
  opentelemetry: OpenTelemetryConfigSchema.optional(),
});
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;

/** Rate limiting configuration */
export const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(false),
  config: z.array(
    z.object({
      type: z.string(),
      field: z.string(),
      max: z.number(),
      ttl: z.number(),
      identifyContext: z.string().optional(),
    })
  ),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/** Filter schema configuration */
export const FilterSchemaConfigSchema = z.object({
  enabled: z.boolean().default(false),
  filters: z.array(z.string()),
});
export type FilterSchemaConfig = z.infer<typeof FilterSchemaConfigSchema>;

/** Performance configuration */
export const PerformanceConfigSchema = z.object({
  caching: CachingConfigSchema.optional(),
  observability: ObservabilityConfigSchema.optional(),
  rateLimit: RateLimitConfigSchema.optional(),
  filterSchema: FilterSchemaConfigSchema.optional(),
});
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;

/** Custom transform configuration (resolvers composition) */
export const CustomTransformSchema = z.string(); // YAML string for resolver composition
export type CustomTransform = z.infer<typeof CustomTransformSchema>;
```

**Update** DSLManifestSchema (around line 203):

```typescript
export const DSLManifestSchema = z.object({
  // ... existing fields ...

  // Core sections
  capabilities: z.array(CapabilityEntrySchema),
  dependencies: DependenciesSchema.optional(),
  data: DataConfigSchema.optional(),

  // NEW: Performance & observability config (ADR-062)
  performance: PerformanceConfigSchema.optional(),
  transforms: z.array(CustomTransformSchema).optional(),

  // Future sections (deferred)
  authorization: z.unknown().optional(), // ADR-041
});
```

---

### 2.2 Example DSL Manifest with New Sections

**File**: Create `examples/e2e2/mfe-manifest-full.yaml` (documentation example)

```yaml
name: csv-analyzer
version: 1.0.0
type: tool
language: typescript
description: CSV data analysis with GraphQL BFF
endpoint: http://localhost:3002
remoteEntry: http://localhost:3002/remoteEntry.js

capabilities:
  - load:
      type: platform
      description: Load the analyzer module
      inputs:
        - name: context
          type: object
      outputs:
        - name: initialized
          type: boolean

# Data layer (GraphQL Mesh - ADR-046)
data:
  sources:
    - name: PetStoreAPI
      handler:
        openapi:
          source: ./pet-store-api.yaml
          operationHeaders:
            Authorization: Bearer {context.jwt}
    - name: UserAPI
      handler:
        openapi:
          source: ./benefit-model.yaml

# NEW: Performance & Observability (ADR-062)
performance:
  # Caching configuration
  caching:
    enabled: true
    ttl: 300000 # 5 minutes default
    strategies:
      - type: Query
        field: user
        ttl: 60000 # 1 minute for user queries
      - type: Query
        field: pets
        ttl: 300000 # 5 minutes for pet queries

  # Observability configuration
  observability:
    # Prometheus metrics (always enabled by default)
    prometheus:
      enabled: true
      port: 9090
      endpoint: /metrics

    # OpenTelemetry tracing (opt-in)
    opentelemetry:
      enabled: false
      serviceName: csv-analyzer-bff
      sampling:
        probability: 0.1
      exporters:
        - type: jaeger
          endpoint: http://jaeger:14268/api/traces

  # Rate limiting (opt-in for public APIs)
  rateLimit:
    enabled: false
    config:
      - type: Query
        field: search
        max: 100
        ttl: 60000 # per minute
        identifyContext: userId

  # Filter schema (hide internal fields)
  filterSchema:
    enabled: false
    filters:
      - Type.!_internal*
      - Query.!admin*

# NEW: Custom transforms (resolvers composition)
transforms:
  - |
    resolver: Query.user
    composer: ./src/platform/bff/composers/auth-check#authCheck
  - |
    resolver: Mutation.*
    composer: ./src/platform/bff/composers/audit-log#auditLog

dependencies:
  runtime:
    graphql: ^16.8.1
    express: ^4.18.2
  design-system:
    '@mui/material': ^5.14.0
```

---

## Part 3: ADR Documentation

### 3.1 Create ADR-062

**File**: `docs/architecture-decisions/ADR-062-mesh-v0100-plugins.md`

````markdown
# ADR-062: GraphQL Mesh v0.100.x with Production Plugins

**Date**: 2025-12-06  
**Status**: Accepted  
**Context**: Template dependency fixes and observability enhancements  
**Supersedes**: Clarifies ADR-046 implementation details

---

## Decision

Use GraphQL Mesh v0.100.21 (latest stable) with production-ready plugins for response caching, observability (Prometheus), and optional distributed tracing (OpenTelemetry). Support custom schema transforms via resolvers composition.

---

## Context

### Problem

Generated BFF projects had dependency issues:

1. Templates used non-existent Mesh v1.0.0 or "latest" (unreliable)
2. Missing peer dependencies (@graphql-tools/\*)
3. No observability/monitoring capabilities out-of-the-box
4. No performance optimization (caching)
5. Old API patterns (express-graphql deprecated)

### Investigation

Analysis of e2e2 project revealed:

- GraphQL Mesh v1.0.0 doesn't exist in stable releases
- Latest stable is v0.100.21 (December 2024)
- Mesh v0.100.x uses different API (`createBuiltMeshHTTPHandler`)
- TypeScript NodeNext resolution incompatible with generated code

Research on Mesh ecosystem identified production-critical plugins:

- **response-cache**: Essential performance optimization
- **prometheus**: Standard observability platform
- **opentelemetry**: Advanced distributed tracing
- **naming-convention**: API consistency
- **rate-limit**: Security for public APIs
- **Custom transforms**: Flexibility via resolvers composition

---

## Decision Details

### 1. Core Dependencies (Always Include)

```json
{
  "@graphql-mesh/cli": "^0.100.21",
  "@graphql-mesh/openapi": "^0.109.26",
  "@graphql-mesh/serve-runtime": "^1.2.4",
  "@graphql-tools/delegate": "^10.2.4",
  "@graphql-tools/utils": "^10.5.7",
  "@graphql-tools/wrap": "^10.0.5",
  "graphql": "^16.8.1",
  "tslib": "^2.6.0"
}
```
````

### 2. Standard Tier Plugins (Production-Ready)

```json
{
  "@graphql-mesh/plugin-response-cache": "^0.104.20",
  "@graphql-mesh/plugin-prometheus": "^2.1.8",
  "@graphql-mesh/transform-naming-convention": "^0.105.19",
  "@graphql-mesh/transform-resolvers-composition": "^0.105.19"
}
```

**Default Configuration**:

```yaml
plugins:
  - responseCache:
      ttl: 300000 # 5 minutes
      invalidate:
        ttl: 0
  - prometheus:
      port: 9090
      endpoint: /metrics

transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase
```

### 3. Advanced Tier Plugins (Opt-In via DSL)

```json
{
  "@graphql-mesh/plugin-opentelemetry": "^1.3.67",
  "@graphql-mesh/transform-rate-limit": "^0.105.19",
  "@graphql-mesh/transform-filter-schema": "^0.105.19"
}
```

### 4. API Pattern Update

**Old** (express-graphql, deprecated):

```typescript
import { getMesh } from '@graphql-mesh/runtime';
import { graphqlHTTP } from 'express-graphql';

const mesh = await getMesh(config);
app.use('/graphql', graphqlHTTP({ schema: mesh.schema }));
```

**New** (v0.100.x pattern):

```typescript
import { createBuiltMeshHTTPHandler } from './.mesh';

const meshHandler = createBuiltMeshHTTPHandler<MeshContext>();

app.use(
  '/graphql',
  (req, res, next) => {
    (req as any).meshContext = { jwt, requestId, userId };
    next();
  },
  meshHandler
);
```

### 5. TypeScript Configuration

**Module Resolution**: CommonJS (not NodeNext)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

**Rationale**: NodeNext resolution incompatible with Mesh v0.100 generated code.

### 6. DSL Extensions for Configuration

**New `performance` section**:

```yaml
performance:
  caching:
    enabled: true
    ttl: 300000
  observability:
    prometheus:
      enabled: true
    opentelemetry:
      enabled: false
  rateLimit:
    enabled: false
  filterSchema:
    enabled: false
```

**New `transforms` section** (custom resolvers):

```yaml
transforms:
  - resolver: Query.user
    composer: ./composers/auth-check#authCheck
```

---

## Consequences

### Positive

1. ✅ **Stability**: Use proven stable versions (v0.100.x)
2. ✅ **Observability**: Prometheus metrics out-of-the-box
3. ✅ **Performance**: Response caching improves latency and reduces backend load
4. ✅ **Consistency**: Naming convention transform ensures GraphQL best practices
5. ✅ **Flexibility**: Custom transforms via resolvers composition
6. ✅ **Correctness**: All generated projects install/build/run successfully
7. ✅ **Extensibility**: DSL-driven plugin configuration

### Negative

1. ⚠️ **Learning Curve**: More configuration options to understand
2. ⚠️ **Migration**: Existing projects need updates (breaking change)
3. ⚠️ **Deprecation**: Some plugins deprecated (e.g., serve-runtime)

### Neutral

1. 📝 **Documentation**: Need to document plugin options
2. 📝 **Examples**: Provide example configurations for common use cases
3. 📝 **Testing**: All new templates must be tested end-to-end

---

## Implementation

### Phase 1: Template Updates

- Update dependency versions in package.json.ejs
- Update server.ts.ejs with new API pattern
- Update tsconfig.json with correct module resolution
- Add version constants to unified-generator.ts

### Phase 2: Plugin Integration

- Add meshrc.yaml.ejs template with plugin injection
- Update unified-generator to pass plugin config
- Create example custom transform composers

### Phase 3: DSL Schema

- Add PerformanceConfig, ObservabilityConfig schemas
- Add CustomTransform schema
- Update DSLManifest to include new sections

### Phase 4: Documentation

- Create ADR-062 (this document)
- Update README with plugin options
- Create migration guide for existing projects
- Add examples/e2e2/mfe-manifest-full.yaml

### Phase 5: Testing

- Test generated BFF-only project
- Test generated full-stack MFE project
- Verify npm install, build, runtime
- Update generator tests

---

## References

- **ADR-046**: GraphQL Mesh for BFF Layer (original decision)
- **E2E2 Resolution**: examples/e2e2/TEST-RESULTS.md
- **Plugin Research**: MESH-PLUGINS-RESEARCH.md
- **GraphQL Mesh Docs**: https://the-guild.dev/graphql/mesh
- **Prometheus**: https://prometheus.io/
- **OpenTelemetry**: https://opentelemetry.io/

---

## Related ADRs

- ADR-046: GraphQL Mesh with DSL-embedded config (original)
- ADR-048: Incremental TypeScript migration
- ADR-041: Authorization (deferred)

---

## Approval

**Approved**: 2025-12-06  
**Reviewers**: Sean (Project Lead)  
**Implementation**: READY FOR IMPLEMENTATION

````

---

### 3.2 Update ADR Index

**File**: `docs/architecture-decisions/architecture-decisions.md`

**Add** to the list (after ADR-046 section):

```markdown
### ADR-062: GraphQL Mesh v0.100.x with Production Plugins

**Decision:** Use GraphQL Mesh v0.100.21 (latest stable) with production plugins for response caching, Prometheus observability, and optional OpenTelemetry tracing. Support custom transforms via resolvers composition.

**Status:** Accepted (2025-12-06). Clarifies ADR-046 implementation with correct versions and observability features.

**Why:**
1. Mesh v1.0.0 doesn't exist in stable releases
2. v0.100.x is actively maintained (December 2024)
3. Response cache critical for production performance
4. Prometheus provides standard observability
5. Custom transforms enable field-level logic (auth, logging, etc.)

**DSL Extensions:**
- `performance.caching` - Configure response cache TTLs
- `performance.observability.prometheus` - Enable/configure metrics
- `performance.observability.opentelemetry` - Optional distributed tracing
- `transforms[]` - Custom resolvers composition

**Template Changes:**
- Use `createBuiltMeshHTTPHandler()` API (v0.100.x pattern)
- CommonJS module resolution (not NodeNext)
- Centralized DEPENDENCY_VERSIONS in unified-generator.ts
- Conditional plugin includes based on DSL config

**See**: docs/architecture-decisions/ADR-062-mesh-v0100-plugins.md
````

---

## Part 4: Testing Strategy

### 4.1 Unit Tests

**File**: `src/codegen/UnifiedGenerator/__tests__/unified-generator.test.ts`

**Add** test cases:

```typescript
describe('DEPENDENCY_VERSIONS', () => {
  it('should export version constants', () => {
    expect(DEPENDENCY_VERSIONS.graphqlMesh.cli).toBe('^0.100.21');
    expect(DEPENDENCY_VERSIONS.react.react).toBe('~18.2.0');
  });
});

describe('extractManifestVars with performance config', () => {
  it('should extract prometheus config from manifest', () => {
    const manifest = {
      name: 'test-mfe',
      version: '1.0.0',
      type: 'tool',
      language: 'typescript',
      capabilities: [],
      performance: {
        observability: {
          prometheus: {
            enabled: true,
            port: 9090,
          },
        },
      },
    };

    const vars = extractManifestVars(manifest);
    expect(vars.meshPlugins.prometheus).toBeTruthy();
    expect(vars.meshPlugins.prometheus.port).toBe(9090);
  });

  it('should disable prometheus if explicitly disabled', () => {
    const manifest = {
      name: 'test-mfe',
      version: '1.0.0',
      type: 'tool',
      language: 'typescript',
      capabilities: [],
      performance: {
        observability: {
          prometheus: { enabled: false },
        },
      },
    };

    const vars = extractManifestVars(manifest);
    expect(vars.meshPlugins.prometheus).toBeNull();
  });
});
```

---

### 4.2 Integration Tests

**Create**: `tests/integration/template-generation.test.ts`

```typescript
describe('Template Generation E2E', () => {
  it('should generate BFF project with correct dependencies', async () => {
    const manifest = loadManifest('examples/e2e2/mfe-manifest.yaml');
    const basePath = '/tmp/test-bff-gen';

    const files = await generateAllFiles(manifest, basePath);

    const packageJson = files.find((f) => f.path.endsWith('package.json'));
    const parsed = JSON.parse(packageJson.content);

    expect(parsed.dependencies['@graphql-mesh/cli']).toBe('^0.100.21');
    expect(parsed.dependencies['@graphql-mesh/plugin-prometheus']).toBeDefined();
    expect(parsed.dependencies['react']).toBe('~18.2.0');
  });

  it('should generate meshrc.yaml with plugins', async () => {
    const manifest = {
      name: 'test',
      version: '1.0.0',
      type: 'bff',
      language: 'typescript',
      capabilities: [],
      data: { sources: [] },
      performance: {
        observability: { prometheus: { enabled: true } },
      },
    };

    const files = await generateAllFiles(manifest, '/tmp/test-mesh');
    const meshrc = files.find((f) => f.path.endsWith('.meshrc.yaml'));

    expect(meshrc.content).toContain('prometheus:');
    expect(meshrc.content).toContain('port: 9090');
  });
});
```

---

### 4.3 Manual Testing Checklist

```bash
# 1. Generate new BFF project
cd /tmp
node /path/to/seans-mfe-tool/bin/seans-mfe-tool.js generate --from examples/e2e2/mfe-manifest.yaml --output test-bff

# 2. Install dependencies
cd test-bff
npm install
# ✅ Should complete without UNMET errors

# 3. Build Mesh
npm run bff:build
# ✅ Should generate .mesh/ directory
# ✅ Should contain index.ts, schema.graphql

# 4. Build frontend
npm run build
# ✅ Should generate dist/remoteEntry.js

# 5. TypeScript compilation
npx tsc --noEmit
# ✅ Should have no errors

# 6. Start server
npm run bff:dev &
sleep 3
curl http://localhost:3002/health
# ✅ Should return {"status": "healthy"}

curl http://localhost:3002/graphql -d '{"query":"{ __typename }"}'
# ✅ Should return GraphQL response

curl http://localhost:9090/metrics
# ✅ Should return Prometheus metrics

# 7. Cleanup
kill %1
```

---

## Part 5: Migration Guide (for Existing Projects)

**File**: `docs/MIGRATION-GUIDE-v0100.md`

````markdown
# Migration Guide: Mesh v0.90/v0.99 → v0.100.x

## Summary

Update existing BFF projects from old Mesh versions to v0.100.21 with production plugins.

## Breaking Changes

1. **API Change**: `getMesh()` → `createBuiltMeshHTTPHandler()`
2. **express-graphql removed**: Use Mesh serve-runtime
3. **TypeScript config**: NodeNext → commonjs
4. **Package versions**: Major updates to Mesh packages

## Step-by-Step Migration

### 1. Update package.json

```bash
npm uninstall express-graphql
npm install \
  @graphql-mesh/cli@^0.100.21 \
  @graphql-mesh/openapi@^0.109.26 \
  @graphql-mesh/serve-runtime@^1.2.4 \
  @graphql-mesh/plugin-response-cache@^0.104.20 \
  @graphql-mesh/plugin-prometheus@^2.1.8 \
  @graphql-mesh/transform-naming-convention@^0.105.19 \
  @graphql-tools/delegate@^10.2.4 \
  @graphql-tools/utils@^10.5.7 \
  @graphql-tools/wrap@^10.0.5 \
  tslib@^2.6.0
```
````

### 2. Update server.ts

**Before**:

```typescript
import { getMesh } from '@graphql-mesh/runtime';
import { graphqlHTTP } from 'express-graphql';

const mesh = await getMesh(config);
app.use('/graphql', graphqlHTTP({ schema: mesh.schema }));
```

**After**:

```typescript
import { createBuiltMeshHTTPHandler } from './.mesh';

const meshHandler = createBuiltMeshHTTPHandler();
app.use(
  '/graphql',
  (req, res, next) => {
    (req as any).meshContext = { jwt, requestId, userId };
    next();
  },
  meshHandler
);
```

### 3. Update tsconfig.json

```diff
{
  "compilerOptions": {
-   "module": "NodeNext",
-   "moduleResolution": "NodeNext",
+   "module": "commonjs",
+   "moduleResolution": "node",
+   "lib": ["ES2022"]
  }
}
```

### 4. Add plugins to .meshrc.yaml

```yaml
plugins:
  - responseCache:
      ttl: 300000
      invalidate:
        ttl: 0
  - prometheus:
      port: 9090
      endpoint: /metrics

transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase
```

### 5. Rebuild

```bash
rm -rf node_modules package-lock.json .mesh
npm install
npm run bff:build
npm run build
npm run bff:dev
```

### 6. Verify

```bash
curl http://localhost:3002/health
curl http://localhost:3002/graphql -d '{"query":"{ __typename }"}'
curl http://localhost:9090/metrics
```

## Troubleshooting

**Error**: `Cannot find module './.mesh'`

- Solution: Run `npm run bff:build` first

**Error**: `Module not found: graphql/jsutils/PromiseOrValue.cjs`

- Solution: Update graphql to ^16.8.1

**Error**: TypeScript errors in .mesh/index.ts

- Solution: Set `"skipLibCheck": true` in tsconfig.json

## Questions?

See docs/architecture-decisions/ADR-062-mesh-v0100-plugins.md

```

---

## Part 6: Implementation Checklist

### Phase 1: Code Changes (2-3 hours)
- [ ] Add DEPENDENCY_VERSIONS to unified-generator.ts
- [ ] Update extractManifestVars() with plugin logic
- [ ] Update bff/package.json.ejs with versioned deps
- [ ] Update bff/server.ts.ejs with new API
- [ ] Update bff/tsconfig.json with commonjs
- [ ] Update base-mfe/package.json.ejs with versioned deps
- [ ] Create bff/meshrc.yaml.ejs template

### Phase 2: DSL Schema (1 hour)
- [ ] Add PerformanceConfig schema to schema.ts
- [ ] Add ObservabilityConfig schema
- [ ] Add CustomTransform schema
- [ ] Update DSLManifestSchema with new fields
- [ ] Export new types

### Phase 3: Documentation (1-2 hours)
- [ ] Create ADR-062-mesh-v0100-plugins.md
- [ ] Update architecture-decisions.md index
- [ ] Create MIGRATION-GUIDE-v0100.md
- [ ] Create examples/e2e2/mfe-manifest-full.yaml
- [ ] Update docs/DSL/dsl-template.yaml with performance/transforms sections
- [ ] Update docs/DSL/dsl.yaml with performance/transforms sections
- [ ] Update docs/DSL/dsl-schema-reference.md with new sections
- [ ] Update README with plugin options

### Phase 4: Testing (2-3 hours)
- [ ] Run existing tests (baseline)
- [ ] Add unit tests for DEPENDENCY_VERSIONS
- [ ] Add unit tests for extractManifestVars with perf config
- [ ] Generate test BFF project
- [ ] Verify npm install succeeds
- [ ] Verify npm run bff:build succeeds
- [ ] Verify npm run build succeeds
- [ ] Verify server starts
- [ ] Verify metrics endpoint works
- [ ] Update generator test snapshots

### Phase 5: Cleanup & Review (30min)
- [ ] Remove any debug logging
- [ ] Format code (prettier)
- [ ] Lint code (eslint)
- [ ] Review all changes
- [ ] Commit with descriptive message

---

## Success Criteria

1. ✅ Generated projects install without UNMET dependencies
2. ✅ Generated projects build without TypeScript errors
3. ✅ BFF servers start and respond to requests
4. ✅ Prometheus metrics endpoint accessible
5. ✅ All existing tests pass
6. ✅ New tests cover plugin configuration
7. ✅ Documentation complete (ADR, migration guide)
8. ✅ e2e2 example updated

---

## Timeline Estimate

- **Code Changes**: 2-3 hours
- **DSL Schema**: 1 hour
- **Documentation**: 1-2 hours
- **Testing**: 2-3 hours
- **Review**: 30 minutes

**Total**: 6.5-9.5 hours (1-2 workdays)

---

## Questions to Resolve Before Implementation

1. ✅ **Version constants centralized?** - YES, in unified-generator.ts
2. ✅ **Plugin defaults?** - YES, Standard tier (cache + prometheus + naming)
3. ✅ **DSL extensions approved?** - YES, performance + transforms sections
4. ✅ **Migration guide needed?** - YES, for existing projects
5. ✅ **ADR number?** - ADR-062

---

## Ready to Proceed?

All dependencies resolved, plan reviewed, ADRs documented, DSL schema defined. Ready for implementation! 🚀
```
