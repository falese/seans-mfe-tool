# GraphQL Code Generation - Requirements Document

**Document Status:** Draft - In Progress  
**Created:** 2025-11-26  
**Parent Feature:** MFE Orchestration System  
**Related Docs:**

- [Orchestration Requirements](./orchestration-requirements.md)
- [Architecture Decisions](./architecture-decisions.md)

---

## Purpose

This document captures requirements for the GraphQL code generation capability that automatically generates GraphQL schemas and resolvers from OpenAPI specifications. This is a critical component of the orchestration system that enables unified data access across all MFE types.

---

## Core Principle

**All MFE data should be exposed as GraphQL, regardless of MFE type (frontend, backend, tool, agent).**

This unified interface enables:

- Backend-only MFEs without UI
- Robust BFF (Backend for Frontend) pattern
- AI agent introspection and data discovery
- Consistent data access patterns
- Self-documenting APIs

---

## Requirements

### R1: OpenAPI to GraphQL Schema Generation

**Must:**

- Accept one or more OpenAPI 3.0+ specifications as input
- Generate valid GraphQL schema (SDL) from OpenAPI schemas
- Map REST paths to GraphQL queries/mutations
- Preserve types, nullability, and descriptions
- Handle arrays, objects, and nested structures
- Support query parameters, path parameters, and request bodies

**Should:**

- Support OpenAPI references ($ref)
- Handle OpenAPI discriminators and oneOf/anyOf
- Generate meaningful field names from REST paths
- Add deprecation notices from OpenAPI
- Support custom naming conventions

**Could:**

- Merge multiple OpenAPI specs into single schema
- Detect and resolve naming conflicts
- Generate unions from oneOf schemas

**Example Transformation:**

```yaml
# Input: OpenAPI spec
/api/v1/users/{id}:
  get:
    operationId: getUserById
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    responses:
      '200':
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/User'

components:
  schemas:
    User:
      type: object
      required: [id, email]
      properties:
        id:
          type: string
        email:
          type: string
        name:
          type: string
        role:
          $ref: '#/components/schemas/UserRole'

    UserRole:
      type: string
      enum: [admin, user, guest]

# Output: GraphQL schema
type Query {
  """Get user by ID"""
  getUserById(id: ID!): User

  """List all users"""
  listUsers(filter: UserFilter, limit: Int, offset: Int): [User!]!
}

type User {
  id: ID!
  email: String!
  name: String
  role: UserRole!
}

enum UserRole {
  ADMIN
  USER
  GUEST
}

input UserFilter {
  email: String
  role: UserRole
}
```

---

### R2: GraphQL Resolver Generation

**Must:**

- Generate resolver functions for all queries/mutations
- Call original REST API endpoints
- Handle authentication (JWT from context)
- Pass parameters correctly (path, query, body)
- Return data in GraphQL format
- Handle HTTP errors and map to GraphQL errors

**Should:**

- Support configurable base URL
- Add request/response logging
- Include retry logic for failed requests
- Cache GET requests appropriately
- Support custom headers

**Could:**

- Batch multiple requests
- Implement DataLoader pattern
- Support subscriptions for webhooks

**Example Generated Resolver:**

```typescript
// Generated file: resolvers.generated.ts
import { GraphQLResolvers } from './types.generated';

export const resolvers: GraphQLResolvers = {
  Query: {
    getUserById: async (_, { id }, context) => {
      // Validate authentication
      if (!context.token) {
        throw new Error('Unauthorized');
      }

      // Call original REST API
      const response = await fetch(`${context.apiBaseUrl}/api/v1/users/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${context.token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': context.requestId,
        },
      });

      // Handle errors
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      // Return data
      const data = await response.json();
      return data;
    },

    listUsers: async (_, { filter, limit = 10, offset = 0 }, context) => {
      if (!context.token) {
        throw new Error('Unauthorized');
      }

      // Build query string
      const params = new URLSearchParams();
      if (filter?.email) params.set('email', filter.email);
      if (filter?.role) params.set('role', filter.role);
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const response = await fetch(`${context.apiBaseUrl}/api/v1/users?${params}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${context.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.items || data; // Handle different response formats
    },
  },
};
```

---

### R3: Type Generation

**Must:**

- Generate TypeScript types from GraphQL schema
- Generate types for resolvers (args, return types)
- Include context type definition
- Export all generated types

**Should:**

- Generate input validation helpers
- Include JSDoc comments from OpenAPI
- Support custom scalar types

**Example Generated Types:**

```typescript
// Generated file: types.generated.ts
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

export type User = {
  __typename?: 'User';
  id: string;
  email: string;
  name?: Maybe<string>;
  role: UserRole;
};

export enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
  Guest = 'GUEST',
}

export type UserFilter = {
  email?: Maybe<string>;
  role?: Maybe<UserRole>;
};

export type QueryGetUserByIdArgs = {
  id: string;
};

export type QueryListUsersArgs = {
  filter?: Maybe<UserFilter>;
  limit?: Maybe<number>;
  offset?: Maybe<number>;
};

export type GraphQLContext = {
  token: string;
  apiBaseUrl: string;
  requestId: string;
};

export type GraphQLResolvers = {
  Query: {
    getUserById: (
      parent: unknown,
      args: QueryGetUserByIdArgs,
      context: GraphQLContext
    ) => Promise<User>;
    listUsers: (
      parent: unknown,
      args: QueryListUsersArgs,
      context: GraphQLContext
    ) => Promise<User[]>;
  };
};
```

---

### R4: CLI Integration

**Must:**

- Add `mfe generate graphql` command
- Accept OpenAPI file path(s) as input
- Generate schema, resolvers, and types
- Place generated files in standard location
- Update MFE configuration automatically

**Command Interface:**

```bash
# Generate from single OpenAPI spec
mfe generate graphql --openapi ./openapi.yaml

# Generate from multiple specs (merged)
mfe generate graphql \
  --openapi ./api-v1.yaml \
  --openapi ./api-v2.yaml

# With custom output location
mfe generate graphql \
  --openapi ./openapi.yaml \
  --output ./src/graphql

# Specify base URL
mfe generate graphql \
  --openapi ./openapi.yaml \
  --base-url http://localhost:3001

# Watch mode (regenerate on changes)
mfe generate graphql \
  --openapi ./openapi.yaml \
  --watch
```

**Generated File Structure:**

```
src/
  graphql/
    schema.generated.graphql       # GraphQL schema (SDL)
    types.generated.ts             # TypeScript types
    resolvers.generated.ts         # Resolver implementations
    server.generated.ts            # GraphQL server setup (Apollo/Express)
    client.generated.ts            # GraphQL client helpers
```

---

### R5: MFE DSL Integration

**Must:**

- Update MFE DSL to reference GraphQL endpoint
- Include introspection support flag
- Specify authentication requirements

**DSL Extension:**

```yaml
name: user-management
type: api
version: 1.0.0
owner: identity-team

# GraphQL data exposure
data:
  type: graphql
  endpoint: /graphql
  introspection: true
  authentication:
    required: true
    type: jwt

  # Reference to generated schema
  schema:
    file: ./src/graphql/schema.generated.graphql
    source: openapi
    sourceFiles:
      - ./openapi/users.yaml
      - ./openapi/auth.yaml

  # Optional: Custom resolvers
  customResolvers:
    - ./src/graphql/custom-resolvers.ts

  # Data capabilities exposed via GraphQL
  capabilities:
    queries:
      - getUserById: 'Fetch user by ID'
      - listUsers: 'List users with filtering'
      - searchUsers: 'Full-text search users'

    mutations:
      - createUser: 'Create new user'
      - updateUser: 'Update existing user'
      - deleteUser: 'Delete user'
```

---

### R6: Orchestration Discovery

**Must:**

- Orchestration can discover GraphQL endpoint from DSL
- Support introspection queries
- Cache schema for performance
- Handle schema updates/versions

**Discovery Flow:**

```typescript
// Orchestration runtime discovers MFE capabilities
class MFEDataDiscovery {
  async discoverDataCapabilities(mfeId: string): Promise<DataCapabilities> {
    const mfe = await this.registry.getMFE(mfeId);

    if (mfe.data.type === 'graphql') {
      // Fetch schema via introspection
      const schema = await this.introspectSchema(mfe.data.endpoint);

      return {
        type: 'graphql',
        endpoint: mfe.data.endpoint,
        queries: this.extractQueries(schema),
        mutations: this.extractMutations(schema),
        types: this.extractTypes(schema),
        schema: schema,
      };
    }
  }

  async introspectSchema(endpoint: string): Promise<GraphQLSchema> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: getIntrospectionQuery(),
      }),
    });

    const result = await response.json();
    return buildClientSchema(result.data);
  }
}
```

---

### R7: Code Generation Workflow

**Workflow:**

```
1. Developer creates/updates OpenAPI spec
   └─> openapi/users.yaml

2. Developer runs code generation
   └─> mfe generate graphql --openapi openapi/users.yaml

3. CLI generates:
   ├─> src/graphql/schema.generated.graphql
   ├─> src/graphql/types.generated.ts
   ├─> src/graphql/resolvers.generated.ts
   └─> src/graphql/server.generated.ts

4. CLI updates mfe.config.yaml
   └─> Adds data.schema references

5. Developer optionally adds custom resolvers
   └─> src/graphql/custom-resolvers.ts

6. MFE starts GraphQL server
   └─> Merges generated + custom resolvers

7. Orchestration discovers via introspection
   └─> Caches schema and capabilities

8. AI agents query available data
   └─> Uses introspection to understand types
```

---

### R8: Testing & Validation

**Must:**

- Generate GraphQL schema validation tests
- Test resolver can call REST APIs
- Validate type mappings
- Test authentication integration

**Generated Tests:**

```typescript
// Generated file: resolvers.test.ts
import { resolvers } from './resolvers.generated';
import { buildSchema } from 'graphql';
import nock from 'nock';

describe('Generated Resolvers', () => {
  it('getUserById calls REST API correctly', async () => {
    // Mock REST API
    const scope = nock('http://localhost:3001').get('/api/v1/users/123').reply(200, {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    });

    // Execute resolver
    const result = await resolvers.Query.getUserById(
      {},
      { id: '123' },
      {
        token: 'test-token',
        apiBaseUrl: 'http://localhost:3001',
        requestId: 'test-123',
      }
    );

    expect(result).toEqual({
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    });

    expect(scope.isDone()).toBe(true);
  });
});
```

---

## Success Criteria

1. ✅ Developer can generate GraphQL layer from any OpenAPI spec in < 30 seconds
2. ✅ Generated resolvers correctly call original REST APIs
3. ✅ All MFE types (frontend, backend, tool) can expose data via GraphQL
4. ✅ AI agents can discover and query MFE data using introspection
5. ✅ Zero manual GraphQL code needed for basic CRUD operations
6. ✅ Custom resolvers can be added alongside generated code
7. ✅ Generated code is type-safe and fully typed
8. ✅ Orchestration can cache and version schemas efficiently

---

## Non-Goals (For Now)

- ❌ GraphQL subscriptions (real-time data) - future enhancement
- ❌ GraphQL federation - may add later for schema stitching
- ❌ Custom directives - keep simple initially
- ❌ Automatic DataLoader optimization - add if needed
- ❌ GraphQL-to-REST reverse generation - not needed
- ❌ Schema versioning beyond basic caching - future enhancement

---

## Dependencies

- OpenAPI 3.0+ specification files
- GraphQL libraries (graphql-js, Apollo Server, etc.)
- Code generation templates (Handlebars/EJS)
- TypeScript compiler
- MFE CLI infrastructure

---

## Related ADRs

- ADR-005: GraphQL as Unified Data Layer
- ADR-006: OpenAPI to GraphQL Code Generation
- ADR-009: BFF Pattern for All MFEs

---

## Next Steps

1. **Design Phase:**

   - Create OpenAPI parser module
   - Design schema generation templates
   - Design resolver generation templates
   - Create type generation module

2. **Implementation Phase:**

   - Build OpenAPI → GraphQL schema generator
   - Build resolver generator
   - Build type generator
   - Integrate with CLI

3. **Testing Phase:**

   - Test with various OpenAPI specs
   - Validate type safety
   - Test resolver execution
   - Performance testing

4. **Documentation Phase:**
   - Create developer guide
   - Add examples for common patterns
   - Document customization options
   - Create migration guide

---

## Questions to Resolve

### Q1: Handling Complex OpenAPI Features

How should we handle:

- Request/response middleware?
- API versioning in URLs?
- Different authentication per endpoint?
- Rate limiting headers?

**Suggested approach:** Start simple, enhance iteratively based on real usage.

---

### Q2: Custom Resolver Integration

How do developers add custom logic alongside generated resolvers?

**Option A:** Separate files, merged at runtime

```typescript
// custom-resolvers.ts
export const customResolvers = {
  Query: {
    // Override or extend generated resolver
    getUserById: async (parent, args, context) => {
      const user = await generatedResolvers.Query.getUserById(parent, args, context);
      // Add custom logic
      user.fullName = `${user.firstName} ${user.lastName}`;
      return user;
    },
  },
};
```

**Option B:** Hooks in generated code

```typescript
// Generated with hooks
export const resolvers = {
  Query: {
    getUserById: async (parent, args, context) => {
      await beforeHooks.getUserById?.(args, context);
      const result = await fetchUser(args.id, context);
      return (await afterHooks.getUserById?.(result, context)) || result;
    },
  },
};
```

**Decision:** Option A - cleaner separation, easier to maintain.

---

### Q3: Schema Caching Strategy

How should orchestration cache GraphQL schemas?

**Requirements:**

- Fast lookup (< 5ms)
- Version aware
- Invalidation on updates
- Memory efficient

**Suggested approach:**

- In-memory cache with TTL
- Keyed by `${mfeId}:${version}`
- Background refresh on TTL expiry
- Webhook for explicit invalidation

---

## Revision History

| Date       | Version | Changes       | Author |
| ---------- | ------- | ------------- | ------ |
| 2025-11-26 | 0.1     | Initial draft | Sean   |
