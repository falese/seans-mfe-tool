# GraphQL Mesh Plugins & Transforms Research

## Overview

GraphQL Mesh provides plugins for observability, performance, and transforms for schema manipulation. This document outlines recommended options for our BFF template.

## Recommended Plugins

### 1. Performance & Caching

#### Response Cache Plugin (`@graphql-mesh/plugin-response-cache`)

**Purpose**: Cache GraphQL responses to reduce backend calls
**Version**: Latest stable
**Use Case**: High-traffic APIs, expensive computations, rate-limited upstream APIs

**Configuration Example**:

```yaml
plugins:
  - responseCache:
      ttl: 300000 # 5 minutes in ms
      ttlPerType:
        Query.user: 60000 # 1 minute for user queries
        Query.posts: 300000 # 5 minutes for posts
      ttlPerSchemaCoordinate:
        Query.me: 10000 # 10 seconds for current user
      invalidate:
        ttl: 0 # Invalidate on mutation
```

**Benefits**:

- ✅ Reduces load on upstream APIs
- ✅ Improves response times
- ✅ Configurable per-type/per-field TTL
- ✅ Automatic invalidation on mutations

**Trade-offs**:

- ⚠️ Adds complexity to cache management
- ⚠️ Requires Redis or in-memory store for distributed systems
- ⚠️ May serve stale data if TTL too long

**Recommendation**: **INCLUDE** - Essential for production BFFs

---

### 2. Observability & Monitoring

#### Prometheus Plugin (`@graphql-mesh/plugin-prometheus`)

**Purpose**: Export metrics for Prometheus/Grafana monitoring
**Version**: ^2.1.8
**Use Case**: Production monitoring, SLO tracking, performance analysis

**Configuration Example**:

```yaml
plugins:
  - prometheus:
      port: 9090
      endpoint: /metrics
      labels:
        service: <%= name %>
        environment: ${NODE_ENV}
      metrics:
        - graphql_mesh_request_duration
        - graphql_mesh_request_total
        - graphql_mesh_error_total
```

**Metrics Exported**:

- Request duration histograms
- Request counts by operation
- Error rates
- Source-specific metrics
- Cache hit/miss rates

**Benefits**:

- ✅ Standard observability platform integration
- ✅ Pre-configured dashboards available
- ✅ Alerting on SLO violations
- ✅ Correlate with infra metrics

**Trade-offs**:

- ⚠️ Requires Prometheus setup
- ⚠️ Small performance overhead (~1-2%)

**Recommendation**: **INCLUDE** - Critical for production ops

---

#### OpenTelemetry Plugin (`@graphql-mesh/plugin-opentelemetry`)

**Purpose**: Distributed tracing with OTEL standard
**Version**: Latest stable
**Use Case**: Microservices, complex call chains, debugging latency

**Configuration Example**:

```yaml
plugins:
  - opentelemetry:
      serviceName: <%= name %>-bff
      exporters:
        - type: jaeger
          endpoint: http://jaeger:14268/api/traces
        - type: zipkin
          endpoint: http://zipkin:9411/api/v2/spans
      sampling:
        probability: 0.1 # Sample 10% of requests
```

**Benefits**:

- ✅ Distributed trace visualization
- ✅ Span context propagation to upstream services
- ✅ Standard OTEL format (vendor-agnostic)
- ✅ Integrates with Jaeger, Zipkin, Datadog, etc.

**Trade-offs**:

- ⚠️ Requires tracing backend
- ⚠️ Performance overhead with high sampling
- ⚠️ More complex setup than Prometheus

**Recommendation**: **OPTIONAL** - Include if using microservices architecture

---

### 3. Security & Rate Limiting

#### Rate Limit Transform (`@graphql-mesh/transform-rate-limit`)

**Purpose**: Rate limiting per operation/type/field
**Version**: Latest stable
**Use Case**: Protect against abuse, enforce quotas, prevent DDOS

**Configuration Example**:

```yaml
transforms:
  - rateLimit:
      config:
        - type: Query
          field: user
          max: 100 # 100 requests
          ttl: 60000 # per minute
          identifyContext: userId # Rate limit per user
        - type: Query
          field: search
          max: 10
          ttl: 60000
```

**Benefits**:

- ✅ Granular rate limiting (operation/type/field level)
- ✅ Per-user or global limits
- ✅ Protects backend from overload
- ✅ Returns clear error messages

**Trade-offs**:

- ⚠️ Requires state management (Redis for distributed)
- ⚠️ May frustrate legitimate users if limits too low

**Recommendation**: **OPTIONAL** - Include if BFF is public-facing

---

## Recommended Transforms

### 1. Schema Manipulation

#### Naming Convention Transform (`@graphql-mesh/transform-naming-convention`)

**Purpose**: Standardize field naming across sources (camelCase, snake_case, etc.)
**Version**: Latest stable
**Use Case**: Normalize APIs with different naming conventions

**Configuration Example**:

```yaml
transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase
      enumValues: UPPER_CASE
      fieldArgumentNames: camelCase
```

**Benefits**:

- ✅ Consistent API surface
- ✅ Better developer experience
- ✅ Aligns with GraphQL best practices

**Recommendation**: **INCLUDE** - Improves API consistency

---

#### Filter Schema Transform (`@graphql-mesh/transform-filter-schema`)

**Purpose**: Remove types/fields from schema
**Version**: Latest stable
**Use Case**: Hide internal fields, comply with GDPR, reduce schema size

**Configuration Example**:

```yaml
transforms:
  - filterSchema:
      filters:
        - Type.!_internal* # Remove internal fields
        - Query.!admin* # Remove admin queries
        - Mutation.!dangerousOperation
```

**Benefits**:

- ✅ Security - hide sensitive operations
- ✅ Compliance - remove fields per data regulations
- ✅ Simplicity - smaller schema for consumers

**Recommendation**: **OPTIONAL** - Include if exposing third-party APIs

---

#### Prefix/Encapsulate Transform

**Purpose**: Namespace types from different sources
**Version**: Latest stable
**Use Case**: Multiple sources with conflicting type names

**Configuration Example**:

```yaml
sources:
  - name: Users
    transforms:
      - prefix:
          value: Users_
  - name: Products
    transforms:
      - prefix:
          value: Products_
```

**Result**: `User` → `Users_User`, `Product` → `Products_Product`

**Recommendation**: **OPTIONAL** - Only needed with multiple conflicting sources

---

#### Federation Transform (`@graphql-mesh/transform-federation`)

**Purpose**: Convert to Apollo Federation schema
**Version**: Latest stable
**Use Case**: Integrate with Apollo Gateway

**Recommendation**: **EXCLUDE** - Not using Apollo Federation

---

### 2. Performance Optimization

#### Cache Transform (`@graphql-mesh/transform-cache`)

**Purpose**: Cache resolver results (in addition to response cache)
**Version**: Latest stable
**Use Case**: Expensive field resolvers, computed fields

**Configuration Example**:

```yaml
transforms:
  - cache:
      field: User.posts
      cacheKey: userId-{args.userId}
      ttl: 300000
```

**Benefits**:

- ✅ Granular field-level caching
- ✅ Reduces resolver execution time
- ✅ Works with response cache

**Trade-offs**:

- ⚠️ Two-level cache adds complexity
- ⚠️ Memory usage increases

**Recommendation**: **OPTIONAL** - Advanced optimization

---

#### Hoist Field Transform (`@graphql-mesh/transform-hoist-field`)

**Purpose**: Flatten nested structures for easier querying
**Version**: Latest stable
**Use Case**: Simplify deeply nested REST API responses

**Configuration Example**:

```yaml
transforms:
  - hoistField:
      typeName: Query
      pathConfig:
        - path: [user, profile, name]
          newFieldName: userName
```

**Result**: `query { user { profile { name } } }` → `query { userName }`

**Recommendation**: **OPTIONAL** - Use case specific

---

## Proposed Template Configuration

### Minimal (Always Include)

```yaml
plugins:
  - responseCache:
      ttl: 300000 # 5 minutes default
      invalidate:
        ttl: 0

transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase
```

**Rationale**: Response cache + naming conventions are universally beneficial.

---

### Standard (Production-Ready)

```yaml
plugins:
  - responseCache:
      ttl: 300000
      invalidate:
        ttl: 0

  - prometheus:
      port: 9090
      endpoint: /metrics
      labels:
        service: <%= name %>

transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase
```

**Rationale**: Add observability for production monitoring.

---

### Advanced (Full-Featured)

```yaml
plugins:
  - responseCache:
      ttl: 300000
      ttlPerType: {} # Configure per manifest
      invalidate:
        ttl: 0

  - prometheus:
      port: 9090
      endpoint: /metrics
      labels:
        service: <%= name %>
        environment: ${NODE_ENV}

  - opentelemetry:
      serviceName: <%= name %>-bff
      sampling:
        probability: 0.1

transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase

  - rateLimit:
      config: [] # Configure per manifest

  - filterSchema:
      filters: [] # Configure per manifest
```

**Rationale**: Full observability + security + flexibility.

---

## Custom Schema Transforms - YES!

GraphQL Mesh supports custom transforms via:

### 1. Built-in Transform API

```typescript
// src/platform/bff/transforms/my-transform.ts
import { MeshTransform } from '@graphql-mesh/types';

export const myCustomTransform: MeshTransform = {
  transformSchema(schema, config) {
    // Modify schema using graphql-tools
    return transformedSchema;
  },
};
```

### 2. Resolvers Composition Transform

```yaml
transforms:
  - resolversComposition:
      - resolver: Query.user
        composer: ./src/platform/bff/composers/auth-check#authCheck
```

```typescript
// src/platform/bff/composers/auth-check.ts
export const authCheck = (next) => async (root, args, context, info) => {
  if (!context.userId) throw new Error('Unauthorized');
  return next(root, args, context, info);
};
```

**Use Cases**:

- Custom authorization logic
- Field-level access control
- Data transformation/enrichment
- Logging/auditing
- Error handling/retry logic

---

## Recommendation Summary

### Must Include (Template Defaults)

1. ✅ **response-cache** - Performance critical
2. ✅ **naming-convention** - API consistency

### Should Include (DSL-Configurable)

3. ✅ **prometheus** - Production observability
4. ✅ **Custom transforms support** - Flexibility

### Optional (User Opt-In via DSL)

5. ⚠️ **opentelemetry** - Advanced tracing
6. ⚠️ **rate-limit** - Public APIs
7. ⚠️ **filter-schema** - Security/compliance

### Package Versions (for template)

```json
{
  "@graphql-mesh/plugin-response-cache": "^1.0.0",
  "@graphql-mesh/plugin-prometheus": "^2.1.8",
  "@graphql-mesh/transform-naming-convention": "^0.100.0",
  "@graphql-mesh/transform-resolvers-composition": "^0.100.0"
}
```

---

## Implementation in Templates

### 1. Update package.json.ejs

Add conditional includes based on DSL manifest:

```json
{
  "dependencies": {
    "@graphql-mesh/plugin-response-cache": "^1.0.0",
    "<% if (observability.prometheus) { %>
    "@graphql-mesh/plugin-prometheus": "^2.1.8",
    <% } %>
    "@graphql-mesh/transform-naming-convention": "^0.100.0"
  }
}
```

### 2. Update meshrc.yaml.ejs

Generate plugins/transforms from DSL manifest:

```yaml
plugins:
  - responseCache:
      ttl: <%= cacheConfig.ttl || 300000 %>

<% if (observability.prometheus) { %>
  - prometheus:
      port: 9090
      endpoint: /metrics
<% } %>

transforms:
  - namingConvention:
      typeNames: PascalCase
      fieldNames: camelCase

<% if (customTransforms) { %>
<% customTransforms.forEach(transform => { %>
  - resolversComposition:
      <%= transform %>
<% }); %>
<% } %>
```

### 3. Support in DSL Manifest

```yaml
name: my-mfe
version: 1.0.0
# ... existing fields ...

# NEW: Performance & observability config
performance:
  caching:
    enabled: true
    ttl: 300000
    strategies:
      - type: Query
        field: user
        ttl: 60000

  observability:
    prometheus:
      enabled: true
      port: 9090
    opentelemetry:
      enabled: false

# NEW: Custom transforms
transforms:
  - type: resolversComposition
    resolvers:
      - Query.user: ./composers/auth-check#authCheck
      - Mutation.*: ./composers/audit-log#auditLog
```

---

## Next Steps

1. ✅ Add version constants for recommended plugins
2. ✅ Update BFF template with default plugins
3. ✅ Add DSL schema for performance/observability config
4. ✅ Update unified-generator to pass plugin config to templates
5. ✅ Create example custom transform in template
6. ✅ Document plugin options in generated README

---

## References

- GraphQL Mesh Plugins: https://the-guild.dev/graphql/mesh/docs/plugins
- GraphQL Mesh Transforms: https://the-guild.dev/graphql/mesh/docs/transforms
- Prometheus Metrics: https://prometheus.io/docs/concepts/metric_types/
- OpenTelemetry: https://opentelemetry.io/docs/
