# ADR-062: GraphQL Mesh v0.100.x with Production Plugins & Transforms

## Status

✅ Implemented (2025-12-06)

## Context

The `e2e2` example project revealed dependency conflicts with GraphQL Mesh due to mixing incompatible versions and missing peer dependencies. Initial templates used `latest` versions and lacked production-critical features like response caching, observability (Prometheus/OpenTelemetry), rate limiting, and custom schema transforms. This created a gap between generated projects and production-ready deployments.

### Problems Identified

1. **Version Conflicts**: Mixing Mesh v0.100.x and v1.x packages caused TypeScript compilation errors
2. **Missing Peer Dependencies**: `@graphql-tools/*` packages weren't explicitly declared
3. **No Production Features**: Templates lacked caching, metrics, tracing, or rate limiting
4. **Module Resolution Issues**: `NodeNext` module resolution incompatible with Mesh runtime
5. **Template Rigidity**: No DSL-driven configuration for plugins/transforms

### Key Requirements

- **REQ-BFF-005**: Production-grade BFF with performance optimization
- **REQ-BFF-006**: Observability integration (metrics, tracing, logging)
- **REQ-BFF-007**: Rate limiting and security features
- **REQ-BFF-008**: DSL-driven plugin configuration

## Decision

### 1. Lock to GraphQL Mesh v0.100.x Stable Releases

**Centralized Version Constants** in `src/codegen/UnifiedGenerator/unified-generator.ts`:

```typescript
export const DEPENDENCY_VERSIONS = {
  graphqlMesh: {
    cli: '^0.100.21',           // Stable CLI
    openapi: '^0.109.26',       // OpenAPI handler
    serveRuntime: '^1.2.4',     // Serve runtime (new API)
  },
  graphqlTools: {
    delegate: '^10.2.4',        // Peer dependency
    utils: '^10.5.7',           // Peer dependency
    wrap: '^10.0.5',            // Peer dependency
  },
  meshPlugins: {
    responseCache: '^0.104.20', // Performance
    prometheus: '^2.1.8',       // Metrics
    opentelemetry: '^1.3.67',   // Tracing
  },
  meshTransforms: {
    namingConvention: '^0.105.19',
    rateLimit: '^0.105.19',
    filterSchema: '^0.105.19',
    resolversComposition: '^0.105.19',
    cache: '^0.105.19',
  },
  // ... (React, MUI, build tools, polyfills)
};
```

**Rationale**: Single source of truth prevents version drift across templates.

### 2. New Mesh v0.100.x Runtime API

**Old Pattern (deprecated)**:
```typescript
import { getMesh } from '@graphql-mesh/runtime';
import { findAndParseConfig } from '@graphql-mesh/cli';

const meshConfig = await findAndParseConfig({ dir: __dirname });
const mesh = await getMesh(meshConfig);
app.use('/graphql', graphqlHTTP({ schema: mesh.schema }));
```

**New Pattern (ADR-062)**:
```typescript
import { createBuiltMeshHTTPHandler } from './.mesh';

const meshHandler = createBuiltMeshHTTPHandler<MeshContext>();
app.use('/graphql', meshHandler);
```

**Benefits**:
- No async initialization at startup (Mesh pre-builds artifacts during `mesh build`)
- Type-safe context passing
- Automatic GraphiQL playground
- Middleware-compatible

### 3. Production Plugins (Three-Tier System)

**Always Include (Standard Tier)**:
- **Response Cache**: 5-minute default TTL, per-field override
  ```yaml
  plugins:
    - responseCache:
        ttl: 300000
        invalidate: { ttl: 0 }
  ```

**Production Enabled (Standard Tier)**:
- **Prometheus Metrics**: `/metrics` endpoint on port 9090
  ```yaml
  plugins:
    - prometheus:
        port: 9090
        endpoint: /metrics
  ```

**Opt-In (Advanced Tier)**:
- **OpenTelemetry**: Distributed tracing (10% sampling default)
  ```yaml
  plugins:
    - opentelemetry:
        serviceName: my-mfe-bff
        sampling: { probability: 0.1 }
  ```

### 4. Schema Transforms (DSL-Configurable)

**Always Include**:
- **Naming Convention**: Enforce PascalCase types, camelCase fields
  ```yaml
  transforms:
    - namingConvention:
        typeNames: PascalCase
        fieldNames: camelCase
  ```

**Opt-In via DSL**:
- **Rate Limiting**: Per-field request limits
- **Filter Schema**: Hide internal fields
- **Resolvers Composition**: Custom resolver logic (auth, audit, masking)

### 5. DSL Schema Extensions

Added to `src/dsl/schema.ts`:

```typescript
// New top-level DSL sections
export const PerformanceConfigSchema = z.object({
  caching: CachingConfigSchema.optional(),
  observability: ObservabilityConfigSchema.optional(),
  rateLimit: RateLimitConfigSchema.optional(),
  filterSchema: FilterSchemaConfigSchema.optional(),
});

export const DSLManifestSchema = z.object({
  // ... existing fields ...
  performance: PerformanceConfigSchema.optional(),
  transforms: z.array(CustomTransformSchema).optional(),
});
```

**Example DSL Manifest**:
```yaml
performance:
  caching:
    enabled: true
    ttl: 300000
    strategies:
      - type: Query
        field: getUser
        ttl: 60000
  observability:
    prometheus:
      enabled: true
    opentelemetry:
      enabled: true
      sampling: { probability: 0.1 }
  rateLimit:
    enabled: true
    config:
      - type: Query
        field: '*'
        max: 100
        ttl: 60000
        identifyContext: userId

transforms:
  - |
    resolver: Query.getUser
    composer: ./src/platform/bff/composers/auth-check#authCheck
```

### 6. Template Updates

**Files Modified**:
1. `src/codegen/templates/bff/package.json.ejs`:
   - Versioned dependencies from `DEPENDENCY_VERSIONS`
   - Conditional plugin/transform packages
   
2. `src/codegen/templates/bff/server.ts.ejs`:
   - New `createBuiltMeshHTTPHandler()` API
   - Context middleware pattern
   
3. `src/codegen/templates/bff/tsconfig.json`:
   - Changed `module: "commonjs"` (was `NodeNext`)
   - Changed `moduleResolution: "node"` (was `NodeNext`)
   
4. `src/codegen/templates/bff/meshrc.yaml.ejs`:
   - Dynamic plugin injection from DSL
   - Dynamic transform injection from DSL

### 7. Unified Generator Integration

`src/codegen/UnifiedGenerator/unified-generator.ts`:

```typescript
export function extractManifestVars(manifest: DSLManifest) {
  const performanceConfig = manifest.performance || {};
  const observabilityConfig = performanceConfig.observability || {};
  
  return {
    // ... existing vars ...
    dependencyVersions: DEPENDENCY_VERSIONS,
    
    meshPlugins: {
      responseCache: performanceConfig.caching?.enabled !== false 
        ? DEFAULT_MESH_PLUGINS.responseCache : null,
      prometheus: observabilityConfig.prometheus?.enabled !== false
        ? { ...DEFAULT_MESH_PLUGINS.prometheus, ...observabilityConfig.prometheus }
        : null,
      opentelemetry: observabilityConfig.opentelemetry?.enabled
        ? { ...DEFAULT_MESH_PLUGINS.opentelemetry, ...observabilityConfig.opentelemetry }
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

## Consequences

### Positive

1. **Dependency Stability**: Locked versions prevent future conflicts
2. **Production-Ready**: Response caching, metrics, tracing included out-of-the-box
3. **DSL-Driven**: Performance tuning via manifest, no code changes
4. **Type Safety**: New Mesh API provides better TypeScript support
5. **Maintainability**: Centralized version constants simplify updates
6. **Observability**: Prometheus/OpenTelemetry enable production monitoring
7. **Performance**: Response caching reduces backend load
8. **Security**: Rate limiting prevents API abuse

### Negative

1. **Breaking Change**: Projects using old Mesh API must migrate
2. **Build Requirement**: `mesh build` must run before `tsc`
3. **Complexity**: More configuration options = steeper learning curve
4. **Version Lock**: Must manually update versions (no `latest`)

### Neutral

1. **Plugin Ecosystem**: Mesh v0.100.x plugin availability vs v1.x
2. **Migration Path**: Existing projects need documented upgrade process

## Migration Guide

### For Existing Projects

**Step 1: Update package.json**
```bash
npm install --save \
  @graphql-mesh/cli@^0.100.21 \
  @graphql-mesh/openapi@^0.109.26 \
  @graphql-mesh/serve-runtime@^1.2.4 \
  @graphql-tools/delegate@^10.2.4 \
  @graphql-tools/utils@^10.5.7 \
  @graphql-tools/wrap@^10.0.5 \
  @graphql-mesh/plugin-response-cache@^0.104.20 \
  @graphql-mesh/plugin-prometheus@^2.1.8
```

**Step 2: Update tsconfig.json**
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

**Step 3: Update server.ts**
```typescript
// OLD: Remove getMesh/findAndParseConfig
import { createBuiltMeshHTTPHandler } from './.mesh';

const meshHandler = createBuiltMeshHTTPHandler();
app.use('/graphql', meshHandler);
```

**Step 4: Update package.json scripts**
```json
{
  "scripts": {
    "bff:build": "mesh build",
    "build": "rspack build && npm run bff:build"
  }
}
```

**Step 5: Add performance config to mfe-manifest.yaml** (optional)
```yaml
performance:
  caching:
    enabled: true
  observability:
    prometheus:
      enabled: true
```

**Step 6: Rebuild**
```bash
npm run bff:build
npm run build
```

## Implementation Checklist

- ✅ Add `DEPENDENCY_VERSIONS` to `unified-generator.ts`
- ✅ Update `extractManifestVars()` with plugin/transform logic
- ✅ Update `bff/package.json.ejs` with versioned dependencies
- ✅ Update `bff/server.ts.ejs` with new Mesh API
- ✅ Update `bff/tsconfig.json` with commonjs module resolution
- ✅ Update `bff/meshrc.yaml.ejs` with plugin/transform injection
- ✅ Add performance schemas to `src/dsl/schema.ts`
- ✅ Update `DSLManifestSchema` with new fields
- ✅ Create `examples/e2e2/mfe-manifest-full.yaml`
- ✅ Test schema validation (1153 tests passing)
- ✅ Test build process (TypeScript compiles)
- ✅ Document ADR-062
- ✅ Update architecture index

## Traceability

### Related ADRs
- **ADR-046**: GraphQL Mesh with DSL (foundation)
- **ADR-048**: Incremental TypeScript migration
- **ADR-058**: Platform Handler Library (observability patterns)

### Related Requirements
- **REQ-BFF-001**: DSL as single source of truth
- **REQ-BFF-003**: JWT authentication forwarding
- **REQ-BFF-004**: BFF + static assets same deployable
- **REQ-BFF-005**: Production-grade performance
- **REQ-BFF-006**: Observability integration
- **REQ-BFF-007**: Rate limiting and security
- **REQ-BFF-008**: DSL-driven plugin configuration

### Implementation Files
- `src/codegen/UnifiedGenerator/unified-generator.ts`
- `src/codegen/templates/bff/package.json.ejs`
- `src/codegen/templates/bff/server.ts.ejs`
- `src/codegen/templates/bff/tsconfig.json`
- `src/codegen/templates/bff/meshrc.yaml.ejs`
- `src/dsl/schema.ts`
- `examples/e2e2/mfe-manifest-full.yaml`

## References

- [GraphQL Mesh v0.100.x Documentation](https://the-guild.dev/graphql/mesh/docs)
- [Mesh Plugins](https://the-guild.dev/graphql/mesh/docs/plugins/overview)
- [Mesh Transforms](https://the-guild.dev/graphql/mesh/docs/transforms/overview)
- [e2e2 Dependency Resolution Issue #123](../IMPLEMENTATION-PLAN.md)

## Decision Date

2025-12-06

## Decision Makers

- Architecture Team
- Backend Team
- DevOps Team
