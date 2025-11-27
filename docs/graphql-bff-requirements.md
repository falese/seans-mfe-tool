# GraphQL BFF Layer - Requirements Document

**Document Status:** Active  
**Created:** 2025-11-26  
**Updated:** 2025-11-27 (Session 7 - Pivoted to GraphQL Mesh)
**Parent Feature:** MFE Orchestration System  
**Related Docs:**

- [Orchestration Requirements](./orchestration-requirements.md)
- [Architecture Decisions](./architecture-decisions.md) - ADR-046
- [DSL Contract Requirements](./dsl-contract-requirements.md)

---

## Purpose

This document captures requirements for the GraphQL BFF (Backend for Frontend) layer that provides a pure passthrough from GraphQL to REST APIs. Following ADR-046, we use **GraphQL Mesh** with configuration embedded directly in the MFE DSL.

---

## Core Principle

**The MFE DSL `data:` section IS the GraphQL Mesh configuration.**

Single source of truth benefits:

- No separate `.meshrc.yaml` to maintain
- DSL validation catches config errors early
- Version control tracks all config in one place
- CLI extracts and generates Mesh artifacts
- Registry can index data sources for discovery

---

## Requirements

### REQ-BFF-001: DSL Data Section as Mesh Configuration

**Must:**

- The `data:` section of `mfe-manifest.yaml` contains Mesh-compatible configuration
- Support `sources`, `transforms`, `plugins`, and `serve` subsections
- CLI extracts `data:` section and writes to `.meshrc.yaml`
- Validation ensures Mesh config is syntactically correct

**DSL Structure:**

```yaml
# mfe-manifest.yaml
name: user-dashboard
version: 1.0.0
type: feature
language: typescript

data:
  # === Mesh Sources (one or more OpenAPI specs) ===
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
          operationHeaders:
            Authorization: 'Bearer {context.jwt}'
            X-Request-ID: '{context.requestId}'

    - name: InventoryAPI
      handler:
        openapi:
          source: https://inventory.internal/swagger.json

    - name: OrdersAPI
      handler:
        openapi:
          source: ./specs/orders.yaml

  # === Mesh Transforms (optional schema shaping) ===
  transforms:
    - prefix:
        value: User_
        includeRootOperations: true
    - filterSchema:
        filters:
          - Query.!internal*
          - Mutation.!admin*

  # === Mesh Plugins (optional production concerns) ===
  plugins:
    - responseCache:
        ttl: 60000
    - rateLimit:
        config:
          - type: Query
            field: '*'
            max: 100
            window: '1m'

  # === Mesh Server Config ===
  serve:
    endpoint: /graphql
    playground: true

  # === Data Lineage (from ADR-045) ===
  generatedFrom:
    - openapi: ./specs/user-api.yaml
      service: user-service
      version: 2.1.0
```

**Reference:** ADR-046

---

### REQ-BFF-002: Multi-Source Support (Multiple OpenAPI Specs)

**Must:**

- Accept multiple OpenAPI specifications in `sources` array
- Each source can have its own transforms (prefix, rename, filter)
- Mesh merges all sources into unified GraphQL schema
- Handle naming conflicts via `prefix` or `encapsulate` transforms

**Example - Three APIs Merged:**

```yaml
data:
  sources:
    - name: UserService
      handler:
        openapi:
          source: ./specs/users.yaml
      transforms:
        - prefix:
            value: User_

    - name: OrderService
      handler:
        openapi:
          source: ./specs/orders.yaml
      transforms:
        - prefix:
            value: Order_

    - name: InventoryService
      handler:
        openapi:
          source: https://inventory.internal/swagger.json
# Results in unified schema:
# Query {
#   User_getUserById(id: ID!): User_User
#   User_listUsers: [User_User!]!
#   Order_getOrder(id: ID!): Order_Order
#   getInventoryItem(sku: String!): InventoryItem
# }
```

**Conflict Resolution Strategies:**

| Strategy       | Use Case                              |
| -------------- | ------------------------------------- |
| `prefix`       | Namespace all types/queries by source |
| `encapsulate`  | Nest under source-named field         |
| `filterSchema` | Remove unwanted fields                |
| `rename`       | Fix specific naming conflicts         |

---

### REQ-BFF-003: JWT Authentication Forwarding

**Must:**

- Forward JWT from GraphQL context to REST API calls
- Support `operationHeaders` for header injection
- Support `customFetch` for complex authentication logic
- Context receives JWT from Express/Fastify middleware

**Standard JWT Forwarding:**

```yaml
data:
  sources:
    - name: SecureAPI
      handler:
        openapi:
          source: ./api.yaml
          operationHeaders:
            Authorization: 'Bearer {context.jwt}'
            X-Request-ID: '{context.requestId}'
            X-User-ID: '{context.userId}'
```

**Custom Fetch for Complex Auth:**

```yaml
data:
  sources:
    - name: SecureAPI
      handler:
        openapi:
          source: ./api.yaml
          customFetch: ./src/auth-fetch.ts
```

```typescript
// src/auth-fetch.ts - Generated template
export default async function authFetch(url: string, options: RequestInit, context: MeshContext) {
  // Refresh token if expired
  const token = await ensureValidToken(context.jwt);

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
```

**Context Setup (Generated Server):**

```typescript
// Generated in server.ts
app.use(
  '/graphql',
  createBuiltMeshHTTPHandler({
    context: (req) => ({
      jwt: req.headers.authorization?.replace('Bearer ', ''),
      requestId: req.headers['x-request-id'] || crypto.randomUUID(),
      userId: extractUserIdFromToken(req.headers.authorization),
    }),
  })
);
```

---

### REQ-BFF-004: BFF + Static Assets Same Deployable

**Must:**

- Single Docker container serves both GraphQL BFF and static MFE assets
- Express/Fastify handles both `/graphql` and static file serving
- Generated Dockerfile builds both Mesh artifacts and MFE bundle

**Generated Server Structure:**

```typescript
// server.ts - Generated by CLI
import express from 'express';
import path from 'path';
import { createBuiltMeshHTTPHandler } from './.mesh';

const app = express();

// GraphQL BFF endpoint (from Mesh)
const meshHandler = createBuiltMeshHTTPHandler({
  context: (req) => ({
    jwt: req.headers.authorization?.replace('Bearer ', ''),
    requestId: req.headers['x-request-id'],
  }),
});
app.use('/graphql', meshHandler);

// Static MFE assets
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`BFF + Static serving on port ${port}`);
});
```

**Generated Dockerfile:**

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build MFE static assets
COPY . .
RUN npm run build

# Build Mesh artifacts
RUN npm run mesh:build

# Production image
FROM node:20-slim

WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm ci --production

COPY --from=builder /app/.mesh ./.mesh
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
```

---

### REQ-BFF-005: CLI Command Integration

**Must:**

- Add `mfe bff <name>` command OR integrate into existing commands
- Extract `data:` section from DSL to `.meshrc.yaml`
- Run `mesh build` to generate artifacts
- Generate server wrapper with static asset serving

**CLI Options:**

```bash
# Generate BFF project from scratch
mfe bff user-dashboard --specs ./specs/users.yaml ./specs/orders.yaml

# Or: Generate BFF for existing MFE with data: section in DSL
mfe bff:build
# Reads mfe-manifest.yaml, extracts data:, runs mesh build

# Development mode
mfe bff:dev
# Runs mesh dev with hot reload

# Validate Mesh config without building
mfe bff:validate
# Parses DSL data: section, validates against Mesh schema
```

**Generated Files:**

```
my-mfe/
├── mfe-manifest.yaml       # DSL with data: section (source of truth)
├── .meshrc.yaml            # Extracted Mesh config (generated)
├── .mesh/                  # Mesh build artifacts (generated)
│   ├── index.ts
│   ├── schema.graphql
│   └── sources/
├── server.ts               # Express + Mesh + static (generated)
├── Dockerfile              # Combined BFF + static (generated)
├── docker-compose.yaml     # Local development (generated)
├── dist/                   # Built MFE assets
└── specs/                  # OpenAPI specifications
    └── users.yaml
```

---

### REQ-BFF-006: Production Plugins

**Must:**

- Support response caching via `@graphql-mesh/plugin-response-cache`
- Support rate limiting via `@graphql-mesh/plugin-rate-limit`
- Support monitoring via Prometheus/StatsD plugins
- All configured via `plugins:` in DSL

**Plugin Configuration:**

```yaml
data:
  plugins:
    # Response caching
    - responseCache:
        ttl: 60000 # 1 minute default
        cacheKey: '{context.userId}:{operationName}'
        invalidateViaMutation: true

    # Rate limiting
    - rateLimit:
        config:
          - type: Query
            field: '*'
            max: 100
            window: '1m'
          - type: Mutation
            field: '*'
            max: 20
            window: '1m'

    # Prometheus metrics
    - prometheus:
        endpoint: /metrics

    # Query depth limiting
    - depthLimit:
        maxDepth: 10

    # CSRF prevention
    - csrf:
        requestHeaders: ['x-csrf-token']
```

---

### REQ-BFF-007: Transforms for Schema Shaping

**Must:**

- Support `prefix` to namespace types/queries
- Support `filterSchema` to remove unwanted fields
- Support `rename` to fix naming issues
- Support `encapsulate` to nest under source field

**Transform Examples:**

```yaml
data:
  sources:
    - name: LegacyAPI
      handler:
        openapi:
          source: ./legacy.yaml
      transforms:
        # Remove internal endpoints
        - filterSchema:
            filters:
              - Query.!internal*
              - Mutation.!admin*

        # Fix ugly names from legacy API
        - rename:
            renames:
              - from:
                  type: Query
                  field: API_V1_GetUserById
                to:
                  type: Query
                  field: getUser

        # Add prefix to avoid conflicts
        - prefix:
            value: Legacy_
            includeRootOperations: true
```

---

### REQ-BFF-008: Discovery and Introspection

**Must:**

- GraphQL introspection enabled by default (disable in production via config)
- GraphiQL playground available in development
- Registry can index `data.sources` for MFE discovery

**Discovery Integration:**

```typescript
// Orchestration can discover data sources
class MFEDataDiscovery {
  async discoverDataSources(mfeId: string): Promise<DataSource[]> {
    const manifest = await this.fetchManifest(mfeId);

    return manifest.data.sources.map((source) => ({
      name: source.name,
      type: 'openapi',
      spec: source.handler.openapi.source,
      mfeId,
    }));
  }

  async findMFEsByDataSource(specPath: string): Promise<string[]> {
    // Query registry for MFEs using this spec
    // Enables impact analysis for API changes
  }
}
```

---

## Success Criteria

1. ✅ DSL `data:` section validates as Mesh-compatible configuration
2. ✅ `mfe bff:build` extracts config and generates Mesh artifacts
3. ✅ Single container serves both GraphQL BFF and static MFE assets
4. ✅ JWT forwarded from GraphQL context to REST API calls
5. ✅ Multiple OpenAPI specs merge into unified GraphQL schema
6. ✅ Zero custom resolver code needed for pure passthrough
7. ✅ Response caching and rate limiting configurable via DSL
8. ✅ Registry can index data sources for discovery

---

## Non-Goals (For Now)

- ❌ GraphQL subscriptions (real-time) - future enhancement
- ❌ Custom resolvers beyond passthrough - use `additionalResolvers` if needed
- ❌ GraphQL federation - may add later for cross-MFE schema composition
- ❌ Non-OpenAPI sources (gRPC, SOAP) - focus on REST first
- ❌ Schema versioning - rely on OpenAPI versioning

---

## Dependencies

- **GraphQL Mesh** - `@graphql-mesh/cli`, `@graphql-mesh/openapi`
- **Mesh Plugins** - `@graphql-mesh/plugin-response-cache`, `@graphql-mesh/plugin-rate-limit`
- **Express/Fastify** - Server wrapper for combined serving
- **Docker** - Container for deployment

---

## Migration from Draft R1-R8

| Old Requirement               | New Approach                       |
| ----------------------------- | ---------------------------------- |
| R1: OpenAPI→Schema Generation | Mesh handles automatically         |
| R2: Resolver Generation       | Not needed - pure passthrough      |
| R3: Type Generation           | Mesh generates `.mesh/` artifacts  |
| R4: CLI Integration           | `mfe bff:build` wraps `mesh build` |
| R5: DSL Integration           | `data:` section IS Mesh config     |
| R6: Discovery                 | Registry indexes `data.sources`    |
| R7: Workflow                  | Extract → Build → Serve            |
| R8: Testing                   | Use Mesh snapshot plugin           |

---

## Related ADRs

- **ADR-046:** GraphQL Mesh with DSL-embedded configuration
- **ADR-022:** GraphQL data standardization
- **ADR-045:** GeneratedFrom traceability (data lineage)

---

## Open Questions

### Q1: Mesh Version Strategy

GraphQL Mesh v0 vs v1?

**Analysis:**

- v0 is stable, well-documented
- v1 migration path documented
- Recommend: Start with v0, migration path available

**Decision:** Use Mesh v0 for initial implementation, plan v1 migration later.

---

### Q2: Schema Caching in Registry

Should registry cache generated GraphQL schemas?

**Options:**

- A: Cache in registry (Redis) for fast discovery
- B: Fetch on-demand via introspection
- C: Cache schema hash only, validate freshness

**Decision:** Deferred - start with on-demand introspection.

---

## Revision History

| Date       | Version | Changes                                  | Author |
| ---------- | ------- | ---------------------------------------- | ------ |
| 2025-11-26 | 0.1     | Initial draft (R1-R8 code generation)    | Sean   |
| 2025-11-27 | 1.0     | Pivoted to GraphQL Mesh (ADR-046)        | Sean   |
| 2025-11-27 | 1.1     | DSL-embedded config, single source truth | Sean   |
