---
id: 0012
title: GraphQL Mesh for BFF Layer with DSL-Embedded Configuration
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [bff, graphql, mesh, dsl]
summary: Use GraphQL Mesh as the BFF passthrough layer with configuration embedded directly in the MFE DSL data section as the single source of configuration truth.
rationale-summary: Mesh provides production-ready GraphQL-to-REST passthrough without custom resolver code; embedding its configuration in the DSL eliminates a separate .meshrc.yaml file and makes the DSL the single source of truth.
long-form: true
---

# ADR-012: GraphQL Mesh for BFF Layer with DSL-Embedded Configuration

## Context

MFEs that aggregate data from multiple REST APIs need a BFF (Backend for Frontend) layer to provide a unified GraphQL endpoint. Building a custom BFF resolver layer is complex and hard to maintain. A separate configuration file (`.meshrc.yaml`) duplicates information already in the DSL.

**Status:** Implemented (2025-11-27). See acceptance criteria in `docs/acceptance-criteria/bff.feature` and CLI commands `bff:build`, `bff:dev`, `bff:validate`.

## Decision

Use GraphQL Mesh as the BFF layer. Embed Mesh configuration directly in the MFE DSL `data:` section. The CLI extracts this configuration and generates a `.meshrc.yaml` at build time.

```yaml
# mfe-manifest.yaml - data section IS the Mesh configuration
data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
          operationHeaders:
            Authorization: 'Bearer {context.jwt}'

    - name: OrdersAPI
      handler:
        openapi:
          source: ./specs/orders.yaml

  transforms:
    - prefix:
        value: User_
        includeRootOperations: true
    - filterSchema:
        filters:
          - Query.!internal*

  plugins:
    - responseCache:
        ttl: 60000
    - rateLimit:
        config:
          - type: Query
            field: '*'
            max: 100
            window: '1m'

  serve:
    endpoint: /graphql
    playground: true
```

**CLI extracts Mesh config from DSL at build time:**

```typescript
async function generateBFF(mfeManifest: MFEManifest) {
  const meshConfig = {
    sources: mfeManifest.data.sources,
    transforms: mfeManifest.data.transforms,
    plugins: mfeManifest.data.plugins,
    serve: mfeManifest.data.serve,
  };

  await writeYaml('.meshrc.yaml', meshConfig);
  await execSync('mesh build');
}
```

**JWT authentication forwarding:**

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
```

## Consequences

**Positive:**
- Production-tested by The Guild ecosystem
- Zero custom resolver code for passthrough
- Single source of truth — DSL defines both MFE contract and Mesh config
- DSL validation catches Mesh config errors early
- Registry can index data sources for discovery

**Negative:**
- External dependency on GraphQL Mesh (mature, well-maintained)
- DSL becomes larger (but self-contained)

## References

- REQ-BFF-001 through REQ-BFF-008
- ADR-001: GraphQL Data Standardization
- ADR-011: GeneratedFrom Traceability
- ADR-027: GraphQL Mesh v0.100.x (production evolution)
- Replaces custom code generation approach from R1-R8 draft
