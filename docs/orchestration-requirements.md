# Orchestration Feature - Requirements Elicitation Plan

**Document Status:** Draft - In Progress  
**Created:** 2025-11-26  
**Owner:** Sean  
**Feature:** MFE Orchestration System  
**Related Docs:**

- [GraphQL Code Generation Requirements](./graphql-codegen-requirements.md)
- [Architecture Decisions](./architecture-decisions.md)
- [Session 2 Summary](./SESSION-2-SUMMARY.md)

---

## Purpose

This document captures requirements for adding orchestration capabilities to the MFE Development Tool. The orchestration feature will manage coordination, lifecycle, and communication between multiple MFE applications (shells, remotes, and APIs).

**Note:** GraphQL code generation requirements have been moved to a [separate document](./graphql-codegen-requirements.md) for detailed technical specifications.

---

## Requirements Gathering Sessions

### Session 1: Vision & Core Objectives

**Goal:** Understand the high-level vision and primary use cases for orchestration.

**Questions:**

1. What problem does orchestration solve for your MFE development workflow?
2. What are the key scenarios where you need orchestration? (e.g., starting multiple services, coordinating deployments, managing dependencies)
3. Who are the primary users of this feature? (developers, DevOps, both?)
4. What does success look like for this feature?
5. Are there any existing tools or patterns you want to emulate or avoid?

**To Document:**

- [x] Primary use cases and user stories
- [x] Success criteria and KPIs
- [x] Target users and their workflows
- [x] Constraints and non-goals

**Status:** ✅ COMPLETE

---

### Session 3: Data Layer & GraphQL Integration

**Goal:** Define how MFEs expose and access data through standardized interfaces.

**Status:** ✅ COMPLETE

**Summary:**
All MFEs will expose data via GraphQL, generated automatically from OpenAPI specifications. This provides:

- Unified interface for all MFE types (frontend, backend, tool, agent)
- Backend-only MFEs without UI components
- Robust BFF (Backend for Frontend) pattern
- AI agent introspection and discovery
- Self-documenting data layer

**Detailed requirements moved to:** [GraphQL Code Generation Requirements](./graphql-codegen-requirements.md)

**Key Decisions:**

- ✅ All MFE data exposed as GraphQL
- ✅ GraphQL resolvers auto-generated from OpenAPI specs
- ✅ Generic data handler with lifecycle events (loading, error, etc.)
- ✅ Same BFF pattern for frontend and backend MFEs
- ✅ Authorization at MFE and capability level (not per-field)
- ✅ Agent introspection for data discovery

---

## Session 3: Data Layer & GraphQL Integration - RESPONSES

**Date:** 2025-11-26

### Question 1: Data Metadata

**Response:**

**Metadata to include:**

- **tags** - Searchable/filterable keywords for data discovery
- **category** - Logical grouping (e.g., "user-data", "analytics", "configuration")
- **owner** - Team/person responsible for this data

These should be included at the MFE level and optionally at individual data type level for fine-grained discovery.

**Example in DSL:**

```yaml
name: user-management
type: api
owner: identity-team
tags: [user, authentication, profile]
category: user-data

data:
  schema:
    types:
      - User:
          owner: identity-team
          tags: [pii, gdpr]
          fields:
            - id: ID!
            - email: String!
```

---

### Question 2: Data Exposure - GraphQL for All MFEs

**Response:**

**Key Decision: All MFE data exposed as GraphQL**

> "We should expose all MFE data as GraphQL. This will make it easier to provide 'backend only' MFEs. Plus it will provide a much more robust BFF approach for MFEs that provide user experience."

**Why GraphQL:**

1. **Unified interface** - Same query pattern for all MFE types (frontend, backend, tool, agent)
2. **Backend-only MFEs** - Services can expose data without UI
3. **Better BFF** - Frontend MFEs get optimized data access
4. **Self-documenting** - Introspection built-in
5. **Type safety** - Schema validation
6. **Agent-friendly** - AI agents already understand GraphQL

**Implementation Strategy:**

**Generate GraphQL resolvers from OpenAPI:**

```bash
# Code generation flow
1. Developer provides OpenAPI spec (one or many APIs)
2. CLI generates GraphQL schema from OpenAPI
3. CLI generates resolvers that call APIs
4. MFE exposes unified GraphQL endpoint
5. Orchestration discovers via introspection
```

**Example Mapping:**

```yaml
# OpenAPI spec
/api/users:
  get:
    parameters:
      - name: id
        in: query
    responses:
      200:
        schema:
          $ref: '#/components/schemas/User'

# Generated GraphQL
type Query {
  user(id: ID!): User
  users(filter: UserFilter): [User!]!
}

type User {
  id: ID!
  name: String!
  email: String!
}
```

**Resolver Generation:**

```typescript
// Generated resolver
const resolvers = {
  Query: {
    user: async (_, { id }, context) => {
      // Calls original REST API
      const response = await fetch(`${API_BASE}/users?id=${id}`, {
        headers: { Authorization: context.token },
      });
      return response.json();
    },
    users: async (_, { filter }, context) => {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        body: JSON.stringify(filter),
        headers: { Authorization: context.token },
      });
      return response.json();
    },
  },
};
```

**Benefits:**

- **No API rewrites** - Keep REST APIs, add GraphQL layer
- **Progressive adoption** - Can wrap existing APIs
- **Code generation** - Automated from OpenAPI spec
- **Consistency** - All MFEs speak GraphQL
- **Flexibility** - Can manually enhance generated resolvers

---

### Question 3: Data Access - Generic Handler

**Response:**

**Decision: Provide generic data handler for all MFEs**

> "We should provide a generic handler that interacts with each BFF. We should also define similar lifecycle events like for the other capabilities as we could standardize loading experiences, error handling and other cross cutting concerns."

**Generic Data Handler Pattern:**

```typescript
// Platform-provided handler (part of orchestration runtime)
class MFEDataHandler {
  async query(mfeId: string, query: string, variables?: object): Promise<any> {
    const mfe = await this.orchestration.getMFE(mfeId);

    // Before lifecycle
    await this.lifecycle.trigger('data.before', { mfeId, query });

    try {
      // Loading state
      this.lifecycle.trigger('data.loading', { mfeId });

      // Execute query via standard interface
      const result = await mfe.executeQuery(this.context.token, query, variables);

      // After lifecycle
      await this.lifecycle.trigger('data.after', { mfeId, result });

      return result.data;
    } catch (error) {
      // Error lifecycle
      await this.lifecycle.trigger('data.error', { mfeId, error });
      throw error;
    }
  }
}

// Usage in application
const data = await orchestration.data.query(
  'csv-analyzer',
  `query GetAnalysis($id: ID!) {
    getAnalysis(id: $id) {
      id
      fileName
      results
    }
  }`,
  { id: '123' }
);
```

**Lifecycle Events for Data:**

```yaml
# Standard data lifecycle events (platform-level)
dataLifecycle:
  - before:
      # Called before any data operation
      - validateToken
      - checkRateLimit
      - logDataAccess

  - loading:
      # Called when data fetch starts
      - showLoadingIndicator
      - cacheCheck

  - after:
      # Called after successful data operation
      - cacheResponse
      - hideLoadingIndicator
      - trackDataUsage

  - error:
      # Called on data operation failure
      - logError
      - showErrorNotification
      - retryLogic
```

**Cross-Cutting Concerns Standardized:**

1. **Loading states** - Consistent spinner/skeleton UIs
2. **Error handling** - Unified error messages and retry logic
3. **Caching** - Automatic based on query signatures
4. **Authorization** - JWT validation before every query
5. **Logging** - Data access audit trail
6. **Rate limiting** - Protection against abuse
7. **Telemetry** - Performance monitoring

**Example - Generated Loading Experience:**

```typescript
// MFE can provide custom loading UI
// Or use platform default
const LoadingUI = mfe.ui?.loading || DefaultLoadingSpinner;

orchestration.data.onLifecycle('loading', (event) => {
  if (event.mfeId === 'csv-analyzer') {
    renderUI(<LoadingUI message="Loading analysis..." />);
  }
});
```

---

### Question 4: Authorization at Data vs Capability Level

**Response:**

**Decision: Authorization at MFE and capability level, not granular data fields**

> "I don't think we want to get granular on the graph level. Let's keep the auth to the MFE and particular functions within the MFE."

**Authorization Model:**

```yaml
# Authorization hierarchy
1. MFE Level
- Can user access this MFE at all?
- Checked via authorizeAccess() standard method

2. Capability Level
- Can user execute this specific capability?
- Checked per capability in DSL

3. NOT Field Level
- We do NOT do field-level authorization in GraphQL
- Too granular, adds complexity
- Handle in resolver if absolutely needed
```

**Example DSL with Auth:**

```yaml
name: user-management
type: api

# MFE-level authorization (required for all access)
authorization:
  required: true
  method: authorizeAccess
  requires: user.authenticated

data:
  queries:
    # Capability-level authorization
    - getUser:
        args:
          - id: ID!
        returns: User
        authorization: user.permission.read_users

    - getUserSensitive:
        args:
          - id: ID!
        returns: UserWithPII
        authorization: user.role.admin OR user.owns.resource

    - listAllUsers:
        returns: [User!]!
        authorization: user.role.admin
```

**Authorization Check Flow:**

```typescript
// 1. Check MFE access (platform enforced)
if (!(await mfe.authorizeAccess(token))) {
  throw new UnauthorizedError('Cannot access MFE');
}

// 2. Check capability access (platform enforced via DSL)
const capability = mfe.dsl.data.queries.find((q) => q.name === 'getUser');
if (!checkAuthorization(capability.authorization, token)) {
  throw new UnauthorizedError('Cannot execute this query');
}

// 3. Execute query (MFE handles internal logic)
const result = await mfe.executeQuery(token, query);
```

**Benefits:**

- **Simple authorization model** - Two levels, not N levels
- **Performance** - No per-field checks
- **Clear boundaries** - MFE owns its authorization logic
- **Flexible** - MFE can still do field-level internally if needed
- **Agent-friendly** - Easy for AI to understand access rules

---

### Question 5: Frontend vs Backend MFE Data Patterns

**Response:**

**Decision: Same BFF for all MFE types**

> "No, exact same. The BFF a 'front end MFE' utilizes would be the same BFF a backend MFE utilizes."

**Unified BFF Architecture:**

```
┌─────────────────────┐
│  Frontend MFE       │
│  (React Component)  │
│  - UI rendering     │
│  - User interaction │
└──────────┬──────────┘
           │
           │ GraphQL query
           ▼
┌─────────────────────┐
│   MFE BFF Layer     │◄─────────┐
│   (GraphQL)         │          │
│   - Schema          │          │ Same BFF!
│   - Resolvers       │          │
│   - Authorization   │          │
└──────────┬──────────┘          │
           │                     │
           │ REST/gRPC           │
           ▼                     │
┌─────────────────────┐          │
│   APIs              │          │
│   (Existing)        │          │
└─────────────────────┘          │
                                 │
┌─────────────────────┐          │
│  Backend MFE        │          │
│  (Service/Tool)     │          │
│  - No UI            │          │
│  - Business logic   │──────────┘
└─────────────────────┘
```

**Frontend MFE Example:**

```typescript
// Frontend MFE uses its BFF
const DashboardMFE = () => {
  const { data } = useQuery(gql`
    query GetDashboardData {
      recentAnalyses(limit: 5) {
        id
        fileName
        timestamp
      }
      userStats {
        totalAnalyses
        lastLogin
      }
    }
  `);

  return <Dashboard data={data} />;
};
```

**Backend MFE Example:**

```python
# Backend MFE exposes same GraphQL interface
class AnalyzerMFE(BaseMFE):
    async def introspect_schema(self) -> str:
        return """
        type Query {
          analyzeFile(file: Upload!): AnalysisResult!
          getAnalysis(id: ID!): AnalysisResult
        }
        """

    async def execute_query(self, token: str, query: str):
        # Same GraphQL execution as frontend MFE
        return await self.schema.execute(query, context={'token': token})
```

**Agent Usage (treats both the same):**

```typescript
// Agent doesn't care if MFE is frontend or backend
const agent = {
  async discoverData(mfeId: string) {
    // Same introspection for all MFEs
    const schema = await orchestration.introspect(mfeId);
    return schema.queries;
  },

  async fetchData(mfeId: string, query: string) {
    // Same query execution for all MFEs
    return await orchestration.data.query(mfeId, query);
  },
};
```

**Key Insight:**

Every MFE type (UI component, tool, agent, API service) exposes data the same way through GraphQL. The BFF layer is consistent regardless of whether the MFE renders UI or not.

---

### Question 6: Data Relationships Between MFEs

**Response:**

**Decision: No explicit relationships, enable introspection instead**

> "I don't think we care about relations between data. We should enable the same methods to fetch data and easy to understand types where possible. We could enable the agents to introspect each MFE to understand its data and interpret from that."

**No Foreign Key Declarations:**

```yaml
# We DON'T do this:
data:
  types:
    - Order:
        fields:
          - userId: ID!
            relatesTo: user-management.User # ❌ No explicit relations
```

**Instead: Agent-Driven Discovery:**

```typescript
// Agent introspects and infers relationships
class DataDiscoveryAgent {
  async findRelatedData(entityType: string, fieldName: string) {
    // 1. Introspect all MFEs
    const allSchemas = await Promise.all(mfeIds.map((id) => orchestration.introspect(id)));

    // 2. Find types by name/structure similarity
    const relatedTypes = allSchemas.flatMap((schema) =>
      schema.types.filter(
        (type) =>
          type.name === fieldName ||
          type.fields.some((f) => f.name === 'id' && f.type === fieldName)
      )
    );

    // 3. Agent can now query both MFEs and join data
    const orderData = await orchestration.data.query('orders', orderQuery);
    const userData = await orchestration.data.query('users', userQuery);

    // Agent joins the data
    return this.joinData(orderData, userData, 'userId');
  }
}
```

**Benefits:**

- **Loose coupling** - MFEs don't need to know about each other
- **Flexibility** - Relationships can be inferred dynamically
- **Agent intelligence** - AI determines how to connect data
- **Schema simplicity** - Each MFE describes only its own data
- **Scalability** - No cross-MFE schema coordination needed

**Example - Agent Joins Data:**

```typescript
// Agent queries multiple MFEs and joins results
const enrichedOrders = await agent.execute(`
  Find all orders from the orders-mfe,
  then fetch user details from user-management-mfe,
  and combine them into a single view
`);

// Agent does:
// 1. Query orders-mfe: getOrders()
// 2. Extract userIds from orders
// 3. Query user-management-mfe: getUsers(ids: [userIds])
// 4. Join orders + users by userId
// 5. Return enriched data
```

---

## Key Architectural Decisions - Data Layer

### ADR-004: GraphQL as Universal Data Interface

**Status:** Accepted  
**Date:** 2025-11-26

**Context:**

MFEs need a standardized way to expose data that works for:

- Frontend MFEs rendering UI
- Backend MFEs providing services
- Agent MFEs querying data
- Tool MFEs with no UI

**Decision:**

All MFEs expose data via GraphQL regardless of type. Generate GraphQL schemas and resolvers from OpenAPI specifications.

**Rationale:**

- **Unified interface** - Same query pattern everywhere
- **Self-documenting** - Introspection built-in
- **Type safe** - Schema validation
- **Industry standard** - Well understood
- **Agent friendly** - AI agents understand GraphQL
- **Progressive adoption** - Can wrap existing REST APIs

**Consequences:**

- ✅ Consistent data access across all MFE types
- ✅ Code generation from OpenAPI reduces manual work
- ✅ Agents can introspect any MFE's data
- ⚠️ Adds GraphQL layer (small performance overhead)
- ⚠️ Team must learn GraphQL (but common skill)

---

### ADR-005: BFF Pattern for All MFEs

**Status:** Accepted  
**Date:** 2025-11-26

**Context:**

Frontend and backend MFEs both need data access. Question is whether they should use different patterns.

**Decision:**

Every MFE (frontend or backend) has identical BFF (Backend for Frontend) pattern with GraphQL interface.

**Rationale:**

- **Consistency** - Same data access everywhere
- **Abstract class** - All MFEs implement same interface
- **Flexibility** - Backend-only MFEs can expose data without UI
- **Orchestration simplicity** - One pattern to manage

**Consequences:**

- ✅ Backend MFEs are first-class data citizens
- ✅ Agents treat all MFEs identically
- ✅ Simpler orchestration (one data pattern)
- ⚠️ Even simple MFEs need GraphQL setup

---

### ADR-006: No Cross-MFE Data Relationships

**Status:** Accepted  
**Date:** 2025-11-26

**Context:**

Data often relates across MFEs (e.g., Order.userId → User). Should we declare these relationships in DSL?

**Decision:**

No explicit cross-MFE relationships in DSL. Agents introspect schemas and infer relationships dynamically.

**Rationale:**

- **Loose coupling** - MFEs independent
- **Agent intelligence** - AI determines connections
- **Simpler DSL** - Each MFE describes only its data
- **Scalability** - No coordination needed
- **Flexibility** - Relationships can be dynamic

**Consequences:**

- ✅ MFEs fully independent
- ✅ Agents must be smart enough to join data
- ✅ Schema changes don't cascade
- ⚠️ No compile-time relationship validation
- ⚠️ Agents may infer incorrect relationships

---

### ADR-007: Authorization at MFE/Capability Level Only

**Status:** Accepted  
**Date:** 2025-11-26

**Context:**

GraphQL supports field-level authorization. Should we use it?

**Decision:**

Authorization only at MFE level and capability (query/mutation) level. Not at field level.

**Rationale:**

- **Simplicity** - Two-level auth is sufficient
- **Performance** - No per-field checks
- **Clear boundaries** - MFE owns internal logic
- **Agent friendly** - Simple rules to understand
- **Flexibility** - MFE can still do field-level internally

**Consequences:**

- ✅ Simple authorization model
- ✅ Better performance
- ✅ Clear security boundaries
- ⚠️ Cannot hide individual fields via platform
- ⚠️ MFE must handle sensitive fields internally if needed

---

### ADR-008: Generic Data Handler with Lifecycle Events

**Status:** Accepted  
**Date:** 2025-11-26

**Context:**

Every data operation needs loading states, error handling, caching, etc. Should each MFE implement this?

**Decision:**

Platform provides generic data handler with lifecycle events (before, loading, after, error) that all MFEs use.

**Rationale:**

- **DRY** - Don't repeat data access logic
- **Consistency** - Same loading/error UX everywhere
- **Cross-cutting concerns** - Caching, logging, telemetry standardized
- **Easy adoption** - MFEs get this for free

**Consequences:**

- ✅ Standardized loading/error experiences
- ✅ Less code in each MFE
- ✅ Centralized telemetry
- ⚠️ Less control for MFEs (can be overridden)
- ⚠️ Platform responsibility grows

---

## Updated DSL - Data Section

Based on Session 3 decisions, the data section of DSL should be:

```yaml
name: csv-analyzer
type: tool
owner: analytics-team
tags: [data-analysis, csv, statistics]
category: data-processing

# Data exposure (GraphQL)
data:
  # Single endpoint for all operations
  endpoint: /graphql

  # GraphQL schema (generated from OpenAPI or manually defined)
  schema:
    types:
      - AnalysisResult:
          owner: analytics-team
          tags: [pii-possible]
          fields:
            - id: ID!
            - fileName: String!
            - analysisType: AnalysisType!
            - results: JSON!
            - timestamp: DateTime!
            - userId: String

      - AnalysisType:
          enum: [SUMMARY, CORRELATION, REGRESSION]

      - AnalysisHistory:
          fields:
            - items: [AnalysisResult!]!
            - totalCount: Int!
            - hasMore: Boolean!

    queries:
      - getAnalysis:
          description: Retrieve specific analysis by ID
          args:
            - id: ID!
          returns: AnalysisResult
          authorization: user.owns.resource OR user.role.admin

      - listAnalyses:
          description: List analyses for current user
          args:
            - limit: Int = 10
            - offset: Int = 0
            - filter: AnalysisFilter
          returns: AnalysisHistory
          authorization: user.authenticated

    mutations:
      - createAnalysis:
          description: Create new analysis
          args:
            - input: AnalysisInput!
          returns: AnalysisResult
          authorization: user.permission.create_analysis

      - deleteAnalysis:
          description: Delete analysis
          args:
            - id: ID!
          returns: Boolean
          authorization: user.owns.resource OR user.role.admin

    subscriptions:
      - analysisProgress:
          description: Real-time progress updates
          args:
            - analysisId: ID!
          returns: ProgressUpdate
          authorization: user.owns.resource

  # Generated from OpenAPI (optional)
  generatedFrom:
    - openapi: ./api-spec.yaml
      service: analysis-api
      baseUrl: http://analysis-api:8080
```

**Key Fields Explained:**

1. **endpoint** - Always `/graphql` (single endpoint pattern)
2. **schema** - GraphQL type system
3. **queries/mutations/subscriptions** - Operations with authorization
4. **generatedFrom** - Links to OpenAPI specs (for code generation)
5. **authorization** - Capability-level auth rules
6. **owner/tags** - Metadata for discovery

---

## Next Steps After Session 3

1. **Update DSL schema** - Add data section validation
2. **Create GraphQL generator** - OpenAPI → GraphQL transformer
3. **Implement generic data handler** - Platform-level data access
4. **Define lifecycle events** - Loading, error, caching hooks
5. **Update orchestration service** - Add schema introspection API
6. **Document BFF pattern** - Examples for different MFE types

---

### Session 2: Scope & Architecture

**Goal:** Define what orchestration encompasses and how it fits into the existing tool.

**Questions:**

1. Which components should orchestration manage? (shells, remotes, APIs, databases, other services?)
2. Should orchestration be:
   - A new CLI command (`mfe orchestrate`)?
   - Part of existing commands (enhanced `deploy`)?
   - A separate daemon/service?
   - Configuration-driven (YAML/JSON)?
3. What lifecycle states need management? (start, stop, restart, health check, scale, update?)
4. Should orchestration support different environments? (development, staging, production)
5. How should it integrate with existing features (build, analyze, deploy)?

**To Document:**

- [x] Component scope and boundaries
- [x] CLI command structure
- [x] Configuration format and schema
- [x] Integration points with existing commands
- [x] Environment strategy

**Status:** ✅ COMPLETE

---

## Session 2: Scope & Architecture - RESPONSES

**Date:** 2025-11-26

### Question 1: Component Scope

**Response:**

**Architecture Separation:**

- **Orchestration** = Runtime component in shell managing MFE lifecycle and discovery
- **CLI/CodeGen** = Development tooling for generating and building MFEs
- **Shared Kernel** = DSL registry and validation

**Component Scope - IN SCOPE:**

- Shell applications (orchestration lives here)
- Remote MFEs (UI components)
- Tool MFEs (capabilities for agents)
- Agent MFEs (AI agents)
- API MFEs (backend services)

**Component Scope - OUT OF SCOPE:**

- Databases (owned by APIs, not orchestrated)
- API internals (but APIs expose DSL methods for data interrogation)
- Build artifacts (deferred to deployment discussion)
- Static assets/CDN (deferred to deployment discussion)
- Monitoring/observability/logging (deferred)
- CI/CD pipelines (deferred)
- Starting services (that's CLI, not orchestration)

**Key Design Principle:**

> "Orchestration is runtime discovery and coordination. CLI is development and generation."

**API Data Interrogation Pattern:**
Each MFE (especially APIs) should expose standard methods in DSL to allow direct data queries:

```yaml
capabilities:
  - data-query:
      description: Query user data
      handler: queryUsers
      inputs:
        - name: filter
          type: object
      outputs:
        - name: results
          type: array
```

**Design System Strategy - DEFERRED for deeper discussion:**

- Acknowledge: "big bang visual design challenges" concern
- Teams won't want forced upgrades
- Need gradual migration path
- Consider: optional shared vs. versioned vs. MFE-owned strategies

---

### Question 2: CLI Command Structure & Separation

**Response:**

**Architecture Clarity:**

```
┌─────────────────────────────────────────┐
│          CLI (Development)              │
│  - Code generation                      │
│  - Project scaffolding                  │
│  - Build orchestration                  │
│  - Service starting/stopping            │
│  - DSL validation                       │
│  └─── mfe register <mfe>                │  ← Shared kernel
└────────────────┬────────────────────────┘
                 │
                 │ Registers DSL
                 ▼
┌─────────────────────────────────────────┐
│   Orchestration Service (Registry)      │
│  - DSL storage                          │
│  - MFE discovery                        │
│  - Health monitoring                    │
│  - Query APIs (A/C/B phases)            │
└────────────────┬────────────────────────┘
                 │
                 │ WebSocket sync
                 ▼
┌─────────────────────────────────────────┐
│   Shell Runtime (Orchestration)         │
│  - Dynamic MFE loading                  │
│  - Module Federation execution          │
│  - Local registry cache                 │
│  - Agent coordination                   │
└─────────────────────────────────────────┘
```

**CLI Command Proposal:**

```bash
# CLI handles code generation and development
mfe remote my-tool              # Generate MFE
mfe shell my-app                # Generate shell
mfe api my-service              # Generate API

# Shared kernel: CLI registers DSL with orchestration
mfe register my-tool            # Validate and register DSL
mfe register --validate-only    # Just validate, don't register
mfe unregister my-tool          # Remove from registry

# CLI can start services (not orchestration's job)
mfe dev                         # Start all local services
mfe dev my-tool                 # Start specific MFE
```

**Orchestration Service:**

- Separate architecture from CLI
- Standalone service (Express/Fastify)
- REST API + WebSocket
- Registry storage
- No code generation, no building, no starting

**Shared Kernel:**

- DSL validation logic (used by both CLI and orchestration)
- Registry client library
- Common types/interfaces

**Key Decision:**

> CLI command `mfe register` is the bridge between CLI and orchestration

---

### Question 3: Platform-Level DSL Standard Methods

**Response:**

**Abstract MFE Class Concept:**
All MFEs conform to same abstract contract regardless of type (UI/Tool/Agent/API). Same methods, same orchestration patterns.

**Platform-Required Standard Methods (ALL MFEs):**

```yaml
# Standard capabilities - REQUIRED for all MFEs
standardCapabilities:
  # Authorization check - can user/agent access this MFE?
  - authorizeAccess:
      handler: checkAuthorization
      inputs:
        - name: token
          type: jwt
          required: true
        - name: context
          type: object
          required: false
      outputs:
        - name: authorized
          type: boolean
        - name: permissions
          type: array
          items: string
      description: >
        Validates JWT token and determines if requester can access MFE.
        Equivalent to authorization needed for user to see/use MFE.

  # Health check
  - health:
      handler: checkHealth
      outputs:
        - name: status
          type: enum
          values: [healthy, degraded, unhealthy]
        - name: details
          type: object

  # Self-description (introspection)
  - describe:
      handler: describeSelf
      outputs:
        - name: dsl
          type: object
          description: Full DSL document
        - name: runtime
          type: object
          description: Runtime info (uptime, version, etc)

  # Schema introspection (GraphQL-style)
  - schema:
      handler: introspectSchema
      outputs:
        - name: schema
          type: object
          format: graphql-schema
          description: >
            GraphQL-style schema describing all available
            queries, mutations, types

  # Generic query interface (GraphQL-style)
  - query:
      handler: executeQuery
      inputs:
        - name: token
          type: jwt
          required: true
        - name: query
          type: string
          format: graphql-query
          required: true
        - name: variables
          type: object
          required: false
      outputs:
        - name: data
          type: object
        - name: errors
          type: array
      description: >
        Execute GraphQL-style query against MFE.
        Works for data queries (APIs), capability queries (Tools),
        UI state queries (Components)
```

**Key Design Decisions:**

1. **authorizeAccess is standard** - Every MFE checks JWT token
2. **Same contract for all types** - UI/Tool/Agent/API all implement same methods
3. **JWT-based authentication** - Token passed to all capability invocations
4. **GraphQL-style introspection** - Schema follows GraphQL patterns for familiarity
5. **Abstract MFE class** - Implementation can be in any language, but conforms to contract

**GraphQL Alignment Benefits:**

- Industry-standard introspection
- Well-understood query language
- Type system for validation
- Tools/ecosystem available
- Agents already understand GraphQL

**Example - API MFE Schema (GraphQL):**

```graphql
type Query {
  users(filter: UserFilter): [User!]!
  user(id: ID!): User
}

type User {
  id: ID!
  name: String!
  email: String!
}

input UserFilter {
  name: String
  role: String
}
```

**Example - Tool MFE Schema (GraphQL):**

```graphql
type Query {
  analyzeFile(file: Upload!, type: AnalysisType): AnalysisReport!
}

type AnalysisReport {
  summary: JSON!
  correlations: [Correlation!]!
}

enum AnalysisType {
  SUMMARY
  CORRELATION
  REGRESSION
}
```

**Abstract MFE Implementation Pattern:**

```typescript
// Abstract base class (TypeScript example)
abstract class BaseMFE {
  // Standard methods ALL MFEs must implement
  abstract async authorizeAccess(token: JWT, context?: object): Promise<AuthResult>;
  abstract async checkHealth(): Promise<HealthStatus>;
  abstract async describeSelf(): Promise<DSLDocument>;
  abstract async introspectSchema(): Promise<GraphQLSchema>;
  abstract async executeQuery(token: JWT, query: string, variables?: object): Promise<QueryResult>;

  // MFE-specific capabilities defined in subclass
  abstract async execute<T, R>(capability: string, params: T): Promise<R>;
}

// Concrete MFE implementation
class CsvAnalyzerMFE extends BaseMFE {
  async authorizeAccess(token: JWT): Promise<AuthResult> {
    // Validate JWT, check permissions
    const decoded = verifyJWT(token);
    return {
      authorized: decoded.permissions.includes('data.read'),
      permissions: decoded.permissions,
    };
  }

  async introspectSchema(): Promise<GraphQLSchema> {
    return buildSchema(`
      type Query {
        analyzeFile(file: Upload!, type: AnalysisType): AnalysisReport!
      }
      ...
    `);
  }

  async executeQuery(token: JWT, query: string): Promise<QueryResult> {
    // Execute GraphQL query against this MFE's capabilities
    return graphql({ schema: this.schema, source: query, contextValue: { token } });
  }

  // MFE-specific capability
  async execute(capability: string, params: any) {
    if (!(await this.authorizeAccess(params.token))) {
      throw new UnauthorizedError();
    }
    // Execute capability
  }
}
```

**Python Example:**

```python
from abc import ABC, abstractmethod

class BaseMFE(ABC):
    @abstractmethod
    async def authorize_access(self, token: str, context: dict = None) -> AuthResult:
        pass

    @abstractmethod
    async def check_health(self) -> HealthStatus:
        pass

    @abstractmethod
    async def introspect_schema(self) -> str:
        """Return GraphQL schema as string"""
        pass

    @abstractmethod
    async def execute_query(self, token: str, query: str, variables: dict = None) -> QueryResult:
        pass

class CsvAnalyzerMFE(BaseMFE):
    async def authorize_access(self, token: str, context: dict = None) -> AuthResult:
        # JWT validation
        decoded = jwt.decode(token)
        return AuthResult(
            authorized='data.read' in decoded.permissions,
            permissions=decoded.permissions
        )

    async def introspect_schema(self) -> str:
        return """
        type Query {
          analyzeFile(file: Upload!, type: AnalysisType): AnalysisReport!
        }
        """

    async def execute_query(self, token: str, query: str, variables: dict = None):
        # Execute with strawberry/graphene
        return await schema.execute(query, variable_values=variables)
```

**Consequences:**

- Consistent contract across all MFE types and languages
- Agents can interrogate any MFE the same way
- Security built-in (JWT everywhere)
- Leverages GraphQL ecosystem
- Self-documenting via introspection

---

### Question 4: Orchestration Service Generation & Deployment

**Response:**

**Decision: Option A - CLI Generates Orchestration Service**

```bash
mfe shell my-app
# Generates shell with embedded orchestration service:
# - src/
#   - orchestration-service/
#     - server.ts (Express/Fastify)
#     - registry.ts (storage)
#     - websocket.ts (real-time sync)
#     - api/
#       - register.ts
#       - discover.ts
#       - health.ts
# - docker-compose.yml (shell + orchestration service)
# - Dockerfile.orchestration
```

**Key Architecture Decision:**

> **Orchestration service is generated in EVERY shell**

**Rationale:**

1. **Shell owns its orchestration** - natural coupling
2. **Docker Compose elegance** - shell + orchestration as single deployable unit
3. **Host → Remote workflow** - clean deployment pattern
4. **Self-contained shells** - each shell has its own registry
5. **Deploy simplicity** - one docker-compose up brings everything
6. **Consistent with tool philosophy** - generate everything, including orchestration

**Shell Generation Pattern:**

```
my-app/
├── src/
│   ├── App.tsx                    # Shell UI
│   ├── orchestration-runtime/     # Runtime in browser
│   │   ├── registry-cache.ts
│   │   ├── mfe-loader.ts
│   │   ├── discovery.ts
│   │   └── websocket-client.ts
│   └── ...
├── orchestration-service/         # Service (separate process)
│   ├── server.ts
│   ├── registry/
│   │   ├── storage.ts
│   │   └── sync.ts
│   ├── api/
│   │   ├── register.ts
│   │   ├── discover.ts
│   │   └── query.ts
│   └── websocket/
│       └── broadcast.ts
├── docker-compose.yml             # Shell + Orchestration
├── Dockerfile.shell
├── Dockerfile.orchestration
└── package.json
```

**Docker Compose Pattern:**

```yaml
# Generated docker-compose.yml
version: '3.8'
services:
  orchestration-service:
    build:
      context: .
      dockerfile: Dockerfile.orchestration
    ports:
      - '3100:3100'
    environment:
      - REGISTRY_STORAGE=redis
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  shell:
    build:
      context: .
      dockerfile: Dockerfile.shell
    ports:
      - '3000:3000'
    environment:
      - ORCHESTRATION_SERVICE_URL=http://orchestration-service:3100
    depends_on:
      - orchestration-service

  redis:
    image: redis:alpine
    ports:
      - '6379:6379'
```

**Deployment Workflow:**

```bash
# Developer workflow
mfe shell my-app                    # Generate shell with orchestration
cd my-app
mfe remote feature-a                # Generate remote (in workspace or separate repo)
mfe remote feature-b

# Local development
npm run dev                         # Starts shell + orchestration service + remotes
# OR
docker-compose up                   # Everything in containers

# Production deployment
docker-compose up -d                # Deploy shell + orchestration
# Remotes auto-register when they start
```

**Host → Remote Flow:**

```
1. Generate shell (includes orchestration service)
2. Generate remotes (include auto-registration)
3. Deploy shell + orchestration (docker-compose)
4. Deploy remotes (they register with orchestration)
5. Shell receives registry updates via WebSocket
6. Remotes available dynamically in shell
```

**Benefits:**

- One command deploys shell + orchestration
- Natural ownership model (shell owns its registry)
- Multiple shells can have independent orchestrations
- Or multiple shells can share one orchestration (via config)
- Docker Compose handles service discovery automatically
- Elegant local development experience

---

### Question 5: mfe init Scope

**Response:**

**Decision: mfe init scaffolds workspace with remotes only**

```bash
mfe init my-workspace
# Generates:
my-workspace/
├── packages/
│   ├── remote-a/
│   ├── remote-b/
│   └── remote-c/
├── package.json (workspace root)
├── tsconfig.base.json
└── README.md

# Does NOT generate:
# - Shell (use separate: mfe shell)
# - Orchestration service (generated with shell)
```

**Rationale:**

1. **init = workspace setup** - structure and shared config
2. **Shell is intentional** - developer explicitly creates: `mfe shell my-app`
3. **Orchestration tied to shell** - generated together
4. **Remotes are workspace citizens** - multiple remotes per workspace
5. **Flexibility** - workspace can have 0 or many shells

**Typical Workflow:**

```bash
# Setup workspace
mfe init my-project
cd my-project

# Create shell (includes orchestration)
mfe shell main-app
cd main-app
npm run dev:orchestration  # Start orchestration service

# Create remotes (in workspace or elsewhere)
cd ../packages
mfe remote feature-dashboard
mfe remote feature-analytics
mfe remote tool-csv-analyzer

# Remotes auto-register with orchestration on startup
cd feature-dashboard
npm run dev  # Auto-registers with localhost:3100
```

**Alternative: Monorepo Style**

```bash
mfe init my-monorepo
cd my-monorepo
mfe shell apps/main-shell
mfe remote packages/feature-a
mfe remote packages/feature-b
mfe remote packages/tool-x

# docker-compose.yml at root orchestrates all
docker-compose up
```

---

### Question 6: Shell Runtime vs Service Relationship

**Response:**

Since orchestration service is generated in shell, clarify the relationship:

**Shell Contains TWO orchestration components:**

1. **Orchestration Service** (Node.js backend)

   - Registry storage
   - REST API
   - WebSocket server
   - Runs as separate process
   - Port 3100 (default)

2. **Shell Runtime** (React frontend)
   - Local registry cache
   - Module Federation loader
   - WebSocket client
   - Discovery logic
   - Runs in browser

**Communication Flow:**

```
Remote MFE (Port 3002)
    │
    │ POST /api/register
    ▼
Orchestration Service (Port 3100)
    │
    │ WebSocket broadcast
    ▼
Shell Runtime (Browser)
    │
    │ Fetch DSL on-demand
    ▼
Remote MFE (Port 3002)
    │
    │ Load via Module Federation
    ▼
Shell renders remote
```

**Both components generated by: `mfe shell my-app`**

---

### Question 7: Environment Strategy

**Response:**

**Decision: All orchestration in Docker containers across all environments**

**Key Principle:**

> "Orchestration/service always in Docker. Dev servers reserved for MFEs only."

**Architecture:**

```
Local Development:
┌─────────────────────────────────────────┐
│  Docker Compose (Shell + Orchestration) │
│  - shell:3000                           │
│  - orchestration-service:3100           │
│  - redis:6379                           │
└─────────────────────────────────────────┘
         ▲
         │ Register with orchestration
         │
┌────────┴──────┬──────────┬──────────┐
│               │          │          │
Dev Server      Dev Server Dev Server Dev Server
feature-a:3001  feature-b:3002  tool-x:3003  api:3004
(Hot reload)    (Hot reload)    (Hot reload)    (Hot reload)
```

**Workflow:**

```bash
# 1. Start shell + orchestration (Docker)
cd my-shell
docker-compose up -d
# Shell runs in container
# Orchestration service runs in container

# 2. Start MFEs in dev mode (NOT Docker, for hot reload)
cd ../feature-a
npm run dev  # Port 3001, registers with docker:3100

cd ../feature-b
npm run dev  # Port 3002, registers with docker:3100

cd ../tool-x
npm run dev  # Port 3003, registers with docker:3100
```

**Benefits:**

- **Consistent deployment model** - same docker-compose for dev/staging/prod
- **Hot reload where it matters** - MFEs get fast refresh during development
- **Orchestration stability** - container isolation, production-like
- **Clean separation** - infrastructure (orchestration) vs application code (MFEs)
- **No hybrid confusion** - everything is either container or dev server, never mixed

**Environment Configs:**

```yaml
# docker-compose.yml (development)
services:
  orchestration-service:
    build: ./orchestration-service
    ports:
      - "3100:3100"
    environment:
      - NODE_ENV=development
      - REGISTRY_STORAGE=memory  # Fast for dev

  shell:
    build: ./shell
    ports:
      - "3000:3000"
    environment:
      - ORCHESTRATION_URL=http://orchestration-service:3100

# docker-compose.prod.yml (production)
services:
  orchestration-service:
    environment:
      - NODE_ENV=production
      - REGISTRY_STORAGE=redis
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data
```

**Cross-Environment:**

```bash
# Development
docker-compose up

# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Service Discovery:**

- Local dev: MFEs register to `http://localhost:3100`
- Docker network: MFEs use `http://orchestration-service:3100`
- Kubernetes: Service names via DNS `http://orchestration-service.default.svc.cluster.local:3100`

**Registry Isolation:**

- Development: Each developer has own orchestration container (isolated registry)
- Staging: Shared orchestration service (shared registry for team)
- Production: Shared orchestration service (production registry)

**Environment-Specific MFE Registration:**

```typescript
// Auto-generated registration code
const orchestrationUrl =
  process.env.ORCHESTRATION_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'http://orchestration-service:3100'
    : 'http://localhost:3100');
```

---

### Question 8: Integration with Existing Commands

**Response:**

**`mfe build` Integration:**

```bash
mfe build
# For shells: Builds both shell + orchestration service
# Output:
# - dist/shell/
# - dist/orchestration-service/
# - Dockerfile.shell
# - Dockerfile.orchestration
# - docker-compose.yml

# For remotes: Just builds the remote
# Output:
# - dist/
# - Dockerfile
```

**`mfe deploy` Integration:**

```bash
mfe deploy
# For shells:
# 1. Build shell + orchestration
# 2. Generate/update docker-compose
# 3. Tag images
# 4. Push to registry (if configured)
# 5. Deploy to target environment

# For remotes:
# 1. Build remote
# 2. Auto-register with orchestration on startup (via ENV var)
# 3. Deploy

# Options:
mfe deploy --env staging       # Use staging docker-compose overlay
mfe deploy --env production    # Use production docker-compose overlay
```

**`mfe analyze` Integration:**

```bash
mfe analyze
# Queries orchestration registry (if running)
# Shows:
# - All registered MFEs
# - Dependency graph
# - Health status
# - DSL validation results
# - Shared dependency conflicts

# If orchestration not running, analyzes local files
mfe analyze --offline
```

**New Commands:**

```bash
mfe validate <mfe-name>
# Validates MFE DSL against platform schema
# Checks:
# - Required fields present
# - GraphQL schema valid
# - Standard capabilities implemented

mfe register <mfe-name>
# Validates and registers MFE with orchestration service
# Can be used manually or auto-generated in MFE

mfe registry status
# Shows current registry state (queries orchestration)
# Lists all MFEs, health, versions
```

**Integration Pattern:**

```bash
# Full workflow
mfe shell my-app                # Generate shell with orchestration
cd my-app
mfe build                       # Build shell + orchestration
docker-compose up -d            # Start containers

# In another terminal
cd ../
mfe remote feature-a            # Generate remote
cd feature-a
npm run dev                     # Dev server, auto-registers

# Validate everything
mfe analyze                     # Check registry, dependencies
mfe validate feature-a          # Validate specific MFE DSL
```

---

### Session 3: Configuration & Topology

**Goal:** Define how users describe their MFE architecture and dependencies.

**Questions:**

1. How should users define their MFE topology? (config file, CLI flags, interactive prompts?)
2. What metadata is needed for each service? (name, type, port, dependencies, health endpoints?)
3. How should dependencies between services be expressed?
4. Should there be support for service groups or tags?
5. How do we handle dynamic vs static configuration?
6. Should configuration support templating or variables?

**To Document:**

- [ ] Configuration file format (example structure)
- [ ] Required vs optional fields for each service type
- [ ] Dependency specification syntax
- [ ] Variable/templating system
- [ ] Validation rules

---

### Session 4: Service Management & Lifecycle

**Goal:** Define how orchestration manages service lifecycles.

**Questions:**

1. How should services be started? (sequential, parallel, dependency-ordered?)
2. What startup options are needed? (ports, environment variables, build modes?)
3. How should orchestration handle service failures? (retry, fail-fast, circuit breaker?)
4. What health check mechanisms should be supported?
5. How should services be stopped? (graceful shutdown, timeout, force kill?)
6. Should there be support for service restart/reload without full restart?
7. How should logs be aggregated and displayed?

**To Document:**

- [ ] Startup strategies and ordering
- [ ] Health check specifications
- [ ] Failure handling policies
- [ ] Shutdown procedures
- [ ] Log management approach
- [ ] Process management strategy

---

### Session 5: Development Experience

**Goal:** Ensure orchestration enhances developer productivity.

**Questions:**

1. How should developers interact with orchestration? (CLI commands, config files, UI?)
2. What status/monitoring information is needed during development?
3. Should there be hot reload/watch mode support across services?
4. How should developers debug individual services within orchestration?
5. What commands are needed for day-to-day work? (status, logs, restart single service?)
6. Should there be profiles or presets for common scenarios?

**To Document:**

- [ ] CLI command reference
- [ ] Developer workflows
- [ ] Monitoring and status display
- [ ] Debugging capabilities
- [ ] Common profiles/presets

---

### Session 6: Deployment & Production

**Goal:** Determine production deployment requirements.

**Questions:**

1. Should orchestration support production deployments or just development?
2. If production: Docker Compose, Kubernetes, both, or something else?
3. How does orchestration relate to the existing `deploy` command?
4. What deployment strategies are needed? (rolling, blue-green, canary?)
5. How should environment-specific configuration be handled?
6. What about secrets management?
7. Should there be support for service discovery?

**To Document:**

- [ ] Deployment targets and strategies
- [ ] Production configuration approach
- [ ] Secrets management integration
- [ ] Service discovery mechanisms
- [ ] Relationship to existing deploy command

---

### Session 7: Testing & Quality

**Goal:** Ensure orchestration supports testing workflows.

**Questions:**

1. How should orchestration support integration testing across services?
2. Should there be test-specific configurations or modes?
3. How should test data be managed across services?
4. What about mocking or stubbing remote services?
5. How does orchestration interact with CI/CD pipelines?

**To Document:**

- [ ] Testing strategies and modes
- [ ] Test data management
- [ ] CI/CD integration approach
- [ ] Mock/stub capabilities

---

### Session 8: Advanced Features & Extensions

**Goal:** Identify advanced capabilities and future extensibility.

**Questions:**

1. Should orchestration support service scaling (multiple instances)?
2. What about load balancing or proxying between services?
3. Should there be plugin/extension support for custom orchestrators?
4. How about service templates or blueprints?
5. Should orchestration integrate with monitoring/observability tools?
6. What about inter-service communication patterns (events, queues)?

**To Document:**

- [ ] Scaling capabilities
- [ ] Load balancing/proxy features
- [ ] Plugin architecture
- [ ] Observability integration
- [ ] Communication patterns

---

## Requirements Template

For each requirement identified, document:

```markdown
### REQ-XXX: [Requirement Title]

**Priority:** [Critical | High | Medium | Low]
**Category:** [Core | Configuration | CLI | Deployment | Testing | Advanced]
**Status:** [Proposed | Accepted | Implemented | Deferred]

**Description:**
[Clear description of what is needed]

**Rationale:**
[Why this requirement exists]

**Acceptance Criteria:**

- [ ] Criterion 1
- [ ] Criterion 2

**Dependencies:**
[Other requirements or features this depends on]

**Technical Notes:**
[Implementation considerations, constraints, alternatives]
```

---

## Requirements Catalog

### Core Requirements

#### REQ-001: Runtime Dynamic MFE Composition

**Priority:** Critical  
**Category:** Core  
**Status:** Accepted

**Description:**
System must support runtime loading and composition of MFEs without requiring build-time configuration or shell redeployment. MFEs can be dynamically added, removed, or updated while the system is running.

**Rationale:**
Eliminates development bottleneck where all features must be "built in everything" upfront. Enables true scalability and team independence.

**Acceptance Criteria:**

- [ ] New MFE available to agents/users within 5 seconds of deployment
- [ ] No shell rebuild required when adding new MFE
- [ ] Support for 100+ MFEs without performance degradation
- [ ] MFEs can be added/removed without affecting other running MFEs

**Dependencies:**

- REQ-002 (Orchestration Service)
- REQ-005 (DSL Specification)

**Technical Notes:**

- Leverage Module Federation for web MFEs
- REST/gRPC endpoints for non-web MFEs
- WebSocket for real-time registry updates

---

#### REQ-002: Centralized Orchestration Service

**Priority:** Critical  
**Category:** Core  
**Status:** Accepted

**Description:**
Separate orchestration service that maintains registry of all available MFEs, handles registration/deregistration, provides discovery APIs, and manages health checks.

**Rationale:**
Provides single source of truth for MFE availability across multiple shells. Enables centralized management while maintaining distributed runtime execution.

**Acceptance Criteria:**

- [ ] REST API for MFE registration/deregistration
- [ ] WebSocket support for real-time registry updates
- [ ] Health check monitoring for registered MFEs
- [ ] Query API supporting all three discovery phases (A/C/B)
- [ ] Lightweight registry storing only metadata + DSL endpoints

**Dependencies:**

- REQ-003 (Shell Runtime Orchestration)

**Technical Notes:**

- Stateless service for horizontal scaling
- Consider Redis for registry storage
- Health check polling every 30s with circuit breaker

---

#### REQ-003: Shell Runtime Orchestration

**Priority:** Critical  
**Category:** Core  
**Status:** Accepted

**Description:**
Shell application includes runtime orchestration capabilities for dynamic MFE loading, local registry caching, Module Federation execution, and UI rendering.

**Rationale:**
Distributed runtime execution provides performance, offline capability, and reduced latency compared to centralized-only approach.

**Acceptance Criteria:**

- [ ] WebSocket connection to orchestration service
- [ ] Local registry cache with real-time updates
- [ ] Dynamic Module Federation loading
- [ ] On-demand DSL fetch from MFE endpoints
- [ ] Lifecycle management (initialize, execute, cleanup)

**Dependencies:**

- REQ-002 (Orchestration Service)
- REQ-006 (Module Federation Integration)

**Technical Notes:**

- Cache strategy: store index locally, fetch DSL on-demand
- Fallback mode if orchestration service unavailable

---

#### REQ-004: AI Agent as First-Class Consumer

**Priority:** Critical  
**Category:** Core  
**Status:** Accepted

**Description:**
AI agents must be able to discover, evaluate, select, and invoke MFEs programmatically through machine-readable DSL declarations.

**Rationale:**
Primary use case (Scenario B) - enables self-building capability where tools can generate and use other tools. Foundation for autonomous system evolution.

**Acceptance Criteria:**

- [ ] Agent can query all available MFEs
- [ ] Agent can parse and evaluate DSL documents
- [ ] Agent can invoke MFE handlers programmatically
- [ ] Usage telemetry captured and made available
- [ ] Support for all three discovery phases (A→C→B)

**Dependencies:**

- REQ-005 (DSL Specification)
- REQ-010 (Telemetry System)

**Technical Notes:**

- DSL must be LLM-friendly (clear, semantic)
- Consider JSON-LD for semantic enhancement
- Telemetry helps agents learn from usage patterns

---

#### REQ-005: Language-Agnostic DSL Specification

**Priority:** Critical  
**Category:** Configuration  
**Status:** Accepted

**Description:**
Define declarative DSL (YAML/JSON) for MFE capability declaration that can be implemented in any language. DSL must describe capabilities, inputs/outputs, lifecycle hooks, handlers, and authorization requirements.

**Rationale:**
Enables polyglot MFE ecosystem where MFEs can be built in JavaScript, Python, Go, etc., all conforming to same orchestration contracts.

**Acceptance Criteria:**

- [ ] Schema defined with JSON Schema validation
- [ ] Support for capabilities, lifecycle hooks, handlers
- [ ] Input/output contract specification
- [ ] Authorization declaration (Zanzibar-style for future)
- [ ] Dependency declaration support
- [ ] Module Federation integration fields

**Dependencies:**

- REQ-007 (Platform-Level Contract)

**Technical Notes:**

- Reference implementation: `/docs/dsl.yaml`
- JSON Schema for validation
- Must be machine-readable for AI agents

---

### Configuration Requirements

#### REQ-006: Module Federation Integration

**Priority:** High  
**Category:** Configuration  
**Status:** Accepted

**Description:**
MFE DSL must support Module Federation v5 configuration including remoteEntry URLs, shared dependencies, and dynamic remote containers.

**Rationale:**
Web MFEs use Module Federation for native browser loading. Must integrate seamlessly with existing MF infrastructure.

**Acceptance Criteria:**

- [ ] DSL includes remoteEntry field
- [ ] Support for shared dependency declaration
- [ ] Version compatibility specification
- [ ] Dynamic remote loading in shell

**Dependencies:**

- REQ-005 (DSL Specification)
- REQ-012 (Shared Dependencies)

**Technical Notes:**

- Leverage existing rspack Module Federation setup
- Consider Module Federation v2 for future

---

#### REQ-007: Platform-Level DSL Contract

**Priority:** Critical  
**Category:** Configuration  
**Status:** Accepted

**Description:**
Define minimum required fields that ALL MFEs must provide regardless of type or implementation language to be "orchestration-ready".

**Rationale:**
Ensures consistent integration across heterogeneous MFE ecosystem. Provides universal contract for orchestration layer.

**Acceptance Criteria:**

- [ ] Required fields documented (name, version, type, description, capabilities)
- [ ] Endpoint specification (REST/gRPC for services, remoteEntry for web)
- [ ] Health check endpoint standard
- [ ] DSL endpoint location (/.well-known/mfe-manifest.yaml)
- [ ] Validation rules for platform contract

**Dependencies:**

- REQ-005 (DSL Specification)

**Technical Notes:**

- Use .well-known convention for discoverability
- Consider OpenAPI 3.x alignment for REST APIs

---

### CLI Requirements

#### REQ-008: Auto-Generated Registration Code

**Priority:** Critical  
**Category:** CLI  
**Status:** Accepted

**Description:**
CLI commands (`mfe remote`, `mfe api`, etc.) must automatically generate registration code that executes on MFE startup and shutdown.

**Rationale:**
Zero manual configuration requirement. Developers should not write orchestration integration code manually.

**Acceptance Criteria:**

- [ ] Registration code generated in all MFE templates
- [ ] Automatic registration on startup
- [ ] Automatic de-registration on shutdown (SIGTERM)
- [ ] Re-registration on subsequent deploys
- [ ] Configuration from environment variables

**Dependencies:**

- REQ-002 (Orchestration Service)
- REQ-009 (CLI Orchestration Commands)

**Technical Notes:**

- Use environment variable for orchestration service URL
- Graceful handling if service unavailable
- Retry logic with exponential backoff

---

#### REQ-009: CLI Orchestration Commands

**Priority:** High  
**Category:** CLI  
**Status:** Proposed

**Description:**
Add CLI commands for managing orchestration: starting orchestration service, querying registry, testing MFE registration, viewing health status.

**Rationale:**
Developers need tools to work with orchestration during development and debugging.

**Acceptance Criteria:**

- [ ] `mfe orchestrate start` - start orchestration service
- [ ] `mfe orchestrate status` - view registry and health
- [ ] `mfe orchestrate list` - list all registered MFEs
- [ ] `mfe orchestrate query <criteria>` - test discovery phases
- [ ] `mfe orchestrate validate <mfe>` - validate DSL

**Dependencies:**

- REQ-002 (Orchestration Service)

**Technical Notes:**

- Commands should work in development environment
- Consider `mfe init` integration for workspace setup

---

### Advanced Requirements

#### REQ-010: Usage Telemetry System

**Priority:** High  
**Category:** Advanced  
**Status:** Proposed

**Description:**
Platform-level telemetry capturing MFE invocations, performance metrics, success/failure rates, and usage patterns. Data made available through orchestration layer.

**Rationale:**
Enables context building for AI agents. Helps agents learn which MFEs work well for specific tasks. Supports system self-improvement.

**Acceptance Criteria:**

- [ ] Capture: invocation count, latency, success/failure
- [ ] Context: which agent, what task, which MFE, outcome
- [ ] Query API for telemetry data
- [ ] Privacy-preserving aggregation
- [ ] Configurable retention policies

**Dependencies:**

- REQ-002 (Orchestration Service)
- REQ-004 (AI Agent Integration)

**Technical Notes:**

- Use platform-level DSL (separate from MFE DSL)
- Consider time-series database (InfluxDB, TimescaleDB)
- OpenTelemetry for instrumentation

---

#### REQ-011: Multi-Phase Discovery

**Priority:** High  
**Category:** Core  
**Status:** Accepted

**Description:**
Support three discovery phases: (A) Probabilistic - return all DSLs for agent reasoning, (C) Semantic - natural language query with ranking, (B) Deterministic - precise query DSL filtering.

**Rationale:**
"Go from probabilistic to deterministic" - enables dynamic experiences first, becoming more prescriptive as needed. Different phases for different confidence levels.

**Acceptance Criteria:**

- [ ] Phase A: GET /api/mfes returns lightweight registry
- [ ] Phase A: Agent fetches full DSLs on-demand
- [ ] Phase C: POST /api/mfes/search with NL query, returns ranked results
- [ ] Phase B: GET /api/mfes?filter=<query> with query DSL
- [ ] Agent can choose phase based on context

**Dependencies:**

- REQ-002 (Orchestration Service)
- REQ-005 (DSL Specification)

**Technical Notes:**

- Phase C requires embedding/vector search (pgvector, Pinecone)
- Phase B requires query language parser (consider GraphQL)
- Phase A is foundation, implement first

---

#### REQ-012: Shared Dependencies Management

**Priority:** Critical  
**Category:** Configuration  
**Status:** Proposed

**Description:**
Strategy for managing shared dependencies (design systems, utility libraries) across 100+ MFEs while optimizing for independence, quality, and performance.

**Rationale:**
Critical boundary condition identified in Session 1. Balance MFE independence with consistency and bundle size optimization.

**Acceptance Criteria:**

- [ ] MFEs can declare shared dependencies in DSL
- [ ] Module Federation handles deduplication
- [ ] Version conflict detection and warning
- [ ] Optional: MFE can opt-out of sharing
- [ ] Design system as shared singleton

**Dependencies:**

- REQ-006 (Module Federation)
- REQ-007 (Platform Contract)

**Technical Notes:**

- Design principle: "Optimize for independence while maintaining quality and performance"
- MFEs CAN work standalone, SHOULD use shared design system
- Investigate Module Federation shared config strategies
- Consider semantic versioning ranges

---

#### REQ-013: Self-Building Capability

**Priority:** High  
**Category:** Advanced  
**Status:** Accepted

**Description:**
System must support "drinking our own wine" - tools that can generate other tools/MFEs that are immediately usable within the same ecosystem.

**Rationale:**
Ultimate validation of orchestration design. Enables autonomous system evolution and extension.

**Acceptance Criteria:**

- [ ] Code generator MFE can create new MFE projects
- [ ] Generated MFEs conform to platform DSL contract
- [ ] Generated MFEs auto-register on deployment
- [ ] Circular validation: generated MFE can generate more MFEs
- [ ] No manual intervention required

**Dependencies:**

- REQ-001 (Runtime Composition)
- REQ-008 (Auto-Registration)
- REQ-009 (CLI Commands)

**Technical Notes:**

- First tool to build: MFE generator MFE
- Use existing CLI as template generation engine
- Validate with dogfooding approach

---

### Testing Requirements

<!-- To be populated in Session 7 -->

---

### Deployment Requirements

<!-- To be populated in Session 6 -->

### Advanced Requirements

<!-- Requirements will be added here -->

---

## Decision Log

### Decisions Pending

- [x] ~~Registry storage backend~~ → **RESOLVED: ADR-033** (Neo4j + Redis)
- [x] ~~DSL Schema Validation strategy~~ → **RESOLVED: ADR-032** (Hybrid validation)
- [x] ~~Health check frequency~~ → **RESOLVED: ADR-034** (5 minutes)
- [x] ~~Discovery strategy default~~ → **RESOLVED: ADR-035** (Phase B deterministic)
- [ ] Orchestration service implementation language (Node.js, Go, Python?)
- [ ] Semantic search implementation for Phase C (pgvector, Pinecone, other?)
- [ ] Query DSL syntax for Phase B (GraphQL, custom, OData?)
- [ ] Telemetry storage solution (InfluxDB, TimescaleDB, Prometheus?)
- [ ] Module Federation version strategy for 100+ MFEs
- [ ] Design system versioning and update strategy
- [ ] Error handling and retry policies
- [ ] Security: API authentication for orchestration service
- [ ] Scaling: multi-instance orchestration service strategy

### Decisions Made

**DEC-001: Hybrid Architecture**

- Date: 2025-11-26
- Decision: Centralized orchestration service (Option B) + Shell runtime orchestration (Option A)
- Rationale: Balance single source of truth with distributed performance

**DEC-002: Discovery Phase Order**

- Date: 2025-11-26
- Decision: Support A→C→B (Probabilistic → Semantic → Deterministic)
- Rationale: "Go from probabilistic to deterministic" enables dynamic experiences first

**DEC-003: Lightweight Registry**

- Date: 2025-11-26
- Decision: Store only metadata + DSL endpoint pointers, not full DSL documents
- Rationale: Keeps registry nimble, supports unpredictable DSL sizes

**DEC-004: Push Registration**

- Date: 2025-11-26
- Decision: MFEs push register on startup, auto-generated by CLI
- Rationale: Zero manual configuration, immediate availability

**DEC-005: WebSocket + On-Demand**

- Date: 2025-11-26
- Decision: WebSocket for real-time registry updates + separate endpoint for exact DSL fetch
- Rationale: Balance real-time awareness with performance

**DEC-006: Language-Agnostic DSL**

- Date: 2025-11-26
- Decision: YAML/JSON DSL with JSON Schema validation
- Rationale: Enable polyglot MFE ecosystem (JS, Python, Go, etc.)

**DEC-007: Authorization Deferred**

- Date: 2025-11-26
- Decision: Security/auth policies are future work (Zanzibar-based)
- Rationale: Focus on orchestration mechanics first, auth layer second

**DEC-008: Primary Users V1**

- Date: 2025-11-26
- Decision: Developers as V1 primary users, AI agents as secondary
- Rationale: Validate tooling through dogfooding before AI-driven experiences

**DEC-009: Success Metrics**

- Date: 2025-11-26
- Decision: <5s availability, 100+ MFE scale, zero config, self-documenting, self-building
- Rationale: Clear, measurable acceptance criteria for V1

**DEC-010: Lifecycle Hooks**

- Date: 2025-11-26
- Decision: DSL includes before/main/after/error lifecycle phases
- Rationale: Clear execution model for orchestration and agent understanding

**DEC-011: DSL Schema Validation Strategy**

- Date: 2025-11-26
- Decision: Hybrid validation - strict on required fields (name, version, type, remoteEntry), environment-based on optional fields
- Rationale: Balance early error detection with development flexibility
- Reference: ADR-032

**DEC-012: Registry Storage - Neo4j + Redis**

- Date: 2025-11-26
- Decision: Neo4j for graph storage (MFE relationships, Zanzibar auth tuples), Redis for <10ms caching
- Rationale: Graph database natural fit for MFE relationships and authorization patterns
- Reference: ADR-033

**DEC-013: Health Check and Replacement Strategy**

- Date: 2025-11-26
- Decision: 5-minute health checks, auto-replacement via capability matching, WebSocket notifications
- Rationale: Balance monitoring overhead with timely failure detection, enable graceful degradation
- Reference: ADR-034

**DEC-014: Discovery Strategy Default**

- Date: 2025-11-26
- Decision: Phase B (deterministic) as default, no AI infrastructure required, progressive enhancement to C/A
- Rationale: Developers and agents are primary users; deterministic queries work without AI
- Reference: ADR-035

**DEC-015: MFE Type Enum**

- Date: 2025-11-26
- Decision: MFE types are `tool | agent | feature | service`
- Rationale: Clear distinction between capabilities (tool), AI agents (agent), UI features (feature), and backend services (service)
- Reference: ADR-032

---

## Next Steps

1. **Schedule Session 1** - Discuss vision and objectives
2. Review and refine this elicitation plan based on Session 1 feedback
3. Proceed through remaining sessions in sequence
4. Document requirements in catalog as they are identified
5. Create architectural design document after requirements are complete
6. Update ENHANCEMENT-PLAN.md with orchestration phase

---

## References

- Project README: `/README.md`
- Enhancement Plan: `/ENHANCEMENT-PLAN.md`
- Architecture Decisions: `/docs/architecture-decisions.md`
- Existing Commands: `shell`, `remote`, `api`, `init`, `deploy`, `build`, `analyze`

---

## Notes & Open Questions

_(Space for capturing ad-hoc thoughts during requirements gathering)_

---

## Session 1: Vision & Core Objectives - RESPONSES

**Date:** 2025-11-26

### Question 1: What problem does orchestration solve for your MFE development workflow?

**Response:**
The orchestration feature aims to enable **dynamic, runtime consumption of MFEs and AI Agents/Tools/Skills as MFEs** through a standardized, declarative approach. Key problems being solved:

1. **Runtime Dynamic Composition**: Move beyond static build-time MFE configuration to allow user or machine-driven selection of which MFEs to load at runtime
2. **Non-Code Integration**: Eliminate the need for developers to write integration code by providing a DSL-based approach for declaring MFE capabilities
3. **Capability Discovery**: Enable MFEs (including AI agents/tools) to advertise their capabilities in a standard way
4. **Development Bottleneck**: Current MFE consumption requires "building in everything" upfront - orchestration should eliminate this constraint
5. **Scale Challenge**: Support dynamic scaling where MFEs can be added/removed without rebuilding the entire application
6. **AI-as-MFE Pattern**: Treat AI agents, tools, and skills as first-class MFEs that can be orchestrated alongside traditional UI components

**Key Insight:** This is about **runtime orchestration** (dynamic loading/composition) not just **development orchestration** (starting services). The code generation and runtime orchestration must be tightly coupled - generation creates MFEs that conform to orchestration contracts.

**Architecture Implications:**

- DSL for capability declaration
- Runtime registry/discovery mechanism
- Dynamic module loading (beyond static Module Federation config)
- Standard contracts for MFE capabilities (especially AI agents/tools)
- User and machine (programmatic) selection mechanisms

---

### Question 2: What are the key scenarios where you need orchestration?

**Response:**
Confirmed all four runtime scenarios are in scope:

1. **User-Driven Selection**: Users select needed capabilities from a menu/catalog at runtime
2. **AI Agent-Driven Composition**: AI agents determine which tools/MFEs they need and load them dynamically
3. **Role-Based Configuration**: Admins configure which MFEs are available for different user roles
4. **Context-Aware Adaptation**: System adapts MFE availability based on context (permissions, environment, usage patterns)

**Concrete Scenarios Needed:**

- Awaiting 2-3 specific user journey examples to illustrate the workflow

**Scenario A - Developer adds new feature:**

- Developer runs `mfe remote my-new-tool --capabilities=...`
- MFE auto-registers with the orchestration layer
- Shell is made aware of new features immediately (no redeploy)
- Available for users to consume dynamically

**Scenario B - AI agent discovers and uses tools (PRIMARY FOCUS):**

- Agent receives a task
- Agent queries orchestration layer: "What MFEs are available?"
- Agent examines MFE DSL declarations to determine capabilities and alignment
- Agent loads appropriate MFE(s)
- Agent invokes MFE functionality
- **Tool usage telemetry reported back through orchestration layer**
- Context about MFE usage is captured and made available
- **This enables self-improvement: tools can build more tools**

**Key Insight:** Scenario B is the **foundation** because:

1. Defines abstract MFE contract that can be implemented in **any language**
2. Enables **language-agnostic** MFE development
3. Creates **self-building capability** - "drinking our own wine"
4. MFEs become tools that can generate more MFEs
5. Orchestration layer becomes the universal integration point

**Scenario C - User customizes workspace:**

- User logs in and sees available MFE/capability catalog
- User selects which to load
- Preferences persisted via user profile
- Defined experiences can be updated

---

### Question 3: MFE Capabilities DSL

**Key Requirements Emerging:**

- DSL must be **language-agnostic** (JSON/YAML based, not code)
- Must describe MFE capabilities in machine-readable format for AI agents
- Must support telemetry/usage reporting back through orchestration
- Should enable abstract base contract that any language can implement

**Proposed DSL Structure** (see `/docs/dsl.yaml`):

Key innovations in the proposed DSL:

1. **Capabilities are first-class with nested inputs/outputs**: Each capability declares its own I/O contract
2. **Lifecycle hooks**: `before`, `main`, `after`, `error` phases for execution pipeline
3. **Handler-based execution**: Each lifecycle step has a named handler function
4. **Authorization at the handler level**: Fine-grained permissions per operation
5. **Required inputs tracked per handler**: Explicit data flow requirements
6. **Module Federation integration**: `remoteEntry` field for MF5 compatibility
7. **Dependency declaration**: Shared dependencies like design systems

**Critical Design Elements:**

- **Capabilities array**: Single MFE can offer multiple capabilities (data-analysis, file-processing, etc.)
- **Nested structure**: capabilities > lifecycle > handlers creates clear execution model
- **Authorization model**: `user.permission.true`, `system.permission.admin` style permissions
- **Language field**: Declares implementation language (javascript, python, go, etc.)
- **Endpoint + remoteEntry**: Supports both REST API and Module Federation loading

**Questions for deeper exploration:**

1. Should capabilities support sub-capabilities or composition?
2. How do we handle async operations in lifecycle?
3. What's the schema format for complex inputs/outputs?
4. How do handlers get discovered/invoked across languages?
5. How does authorization integrate with existing auth systems?
6. Should there be capability discovery/search metadata (tags, categories)?

**Answers - Handler Discovery & Invocation:**

- **Web MFEs**: Use Module Federation to load and invoke functions directly
- **Functions can render UI**: Each handler can return UI components in addition to data
- **Non-web MFEs**: Expose REST/gRPC endpoints that conform to the contract
- **Platform-level DSL**: Define contract that ALL MFEs must conform to (regardless of implementation)
- This creates a **hybrid execution model**: native for web, API for services

**Answers - Authorization:**

- Pattern after **Google Zanzibar tuples** (simple, infinitely scalable)
- Authorization will be a **separate feature** to be defined after orchestration is established
- Authorization system deferred to future work

**Answers - Schema & Telemetry:**

- **Schema format**: JSON Schema for simplicity and broad tooling support
- **Telemetry**: Should be **platform-level DSL** (not MFE-specific)
- Focus on **use case rationalization first**, telemetry details come later

---

### Question 4: Platform-Level DSL Contract

You mentioned "platform level DSL that all MFEs must conform to" - this is critical. What must EVERY MFE provide regardless of type?

Thinking out loud, all MFEs might need:

- Identity (name, version, type)
- Discovery metadata (description, capabilities)
- Health/readiness endpoints
- Registration mechanism
- Standard error responses
- Lifecycle conformance (initialize, execute, cleanup?)

**What are the core contracts that make an MFE "orchestration-ready"?**

---

### Question 4A: Data Standardization & Access Patterns

**Requirement:** The ability to fetch data should be standardized whether this is a backend MFE or a full-blown federated module. This data should be normalized to a schema and should enable a single endpoint for all data (GraphQL pattern).

**Key Principles:**

1. **Single Data Endpoint:** Every MFE exposes a single `/graphql` endpoint for all data operations
2. **Schema-First:** Data structures are defined in GraphQL schema format
3. **Unified Query Interface:** Same query patterns for UI MFEs, backend MFEs, tools, and agents
4. **Type Safety:** All data operations are typed and validated against schema
5. **Authorization Embedded:** Every query/mutation respects JWT-based authorization

**Standard Data Contract (ALL MFEs):**

```yaml
data:
  endpoint: /graphql # Single endpoint - REQUIRED

  schema:
    # Define types using GraphQL SDL
    types:
      - ResourceType:
          fields:
            - fieldName: Type!
            - ...

    # Queries - read operations
    queries:
      - queryName:
          description: 'What this query does'
          args:
            - argName: Type!
          returns: ReturnType
          authorization: 'authorization rule'

    # Mutations - write operations
    mutations:
      - mutationName:
          description: 'What this mutation does'
          args:
            - argName: Type!
          returns: ReturnType
          authorization: 'authorization rule'

    # Subscriptions - real-time updates (optional)
    subscriptions:
      - subscriptionName:
          description: 'What this subscription provides'
          args:
            - argName: Type!
          returns: StreamType
          authorization: 'authorization rule'
```

**Why GraphQL Pattern:**

- **Single Endpoint:** `/graphql` handles all data operations (no REST endpoint sprawl)
- **Introspectable:** Schema is self-documenting and queryable
- **Flexible:** Clients request exactly what they need
- **Typed:** Strong typing prevents runtime errors
- **Familiar:** Industry standard that agents/developers already understand
- **Efficient:** Batch operations, avoid over-fetching

**Example - Backend API MFE:**

```yaml
name: user-service
type: api
data:
  endpoint: /graphql
  schema:
    types:
      - User:
          fields:
            - id: ID!
            - name: String!
            - email: String!
            - role: String!
      - UserConnection:
          fields:
            - items: [User!]!
            - totalCount: Int!
    queries:
      - getUser:
          args:
            - id: ID!
          returns: User
          authorization: user.authenticated
      - listUsers:
          args:
            - limit: Int
            - offset: Int
          returns: UserConnection
          authorization: user.role.admin
    mutations:
      - createUser:
          args:
            - input: CreateUserInput!
          returns: User
          authorization: user.role.admin
```

**Example - Frontend MFE (with data):**

```yaml
name: dashboard-widget
type: remote
data:
  endpoint: /graphql # Same pattern!
  schema:
    types:
      - WidgetState:
          fields:
            - config: JSON!
            - data: JSON!
            - lastRefresh: DateTime
    queries:
      - getWidgetState:
          args:
            - widgetId: String!
          returns: WidgetState
          authorization: user.owns.widget
    mutations:
      - updateWidgetConfig:
          args:
            - widgetId: String!
            - config: JSON!
          returns: WidgetState
          authorization: user.owns.widget
```

**Benefits for AI Agents:**

1. **Consistent Interface:** Agent queries data the same way regardless of MFE type
2. **Self-Discovery:** Agent can introspect schema to understand available data
3. **Type Validation:** Agent knows what types to expect/provide
4. **Authorization Clarity:** Agent sees authorization requirements in schema
5. **Composability:** Agent can compose data from multiple MFEs in single query

**Implementation Requirements:**

- Code generator must scaffold GraphQL endpoint for all MFEs
- Orchestration service aggregates schemas from all MFEs
- Shell can execute federated queries across multiple MFEs
- Standard GraphQL tooling (introspection, validation) just works

---

### Question 5: AI Agent Query & Selection Mechanism

**Response:**
Multi-phase selection strategy - **probabilistic to deterministic progression**:

**Phase A (Probabilistic - Dynamic)**:

- Return ALL MFE DSL documents to the agent
- Agent uses its own reasoning/LLM to evaluate matches
- Most flexible, enables emergent behaviors
- Surfaces dynamic experiences first

**Phase C (Semantic - Assisted)**:

- Agent describes need in natural language
- Orchestration layer returns ranked/scored matches
- Hybrid approach: structured + intelligent

**Phase B (Deterministic - Precise)**:

- Query DSL: `type=tool AND capabilities.includes('data-analysis')`
- Exact filtering, repeatable results
- Most prescriptive, used when precision is required

**Key Insight:** "Go from probabilistic to deterministic" - start with maximum flexibility and agent autonomy, progressively add more structure when needed. This enables **dynamic experiences first**, becoming more **prescriptive** as requirements solidify.

**Implementation Implications:**

- Orchestration layer must support all three query modes
- Phase A is the foundation (simplest: return all DSL)
- Phase C requires semantic indexing/embedding of MFE capabilities
- Phase B requires query language parser and DSL field indexing
- Agent chooses which phase based on task confidence and context

---

### Question 6: Registration & Discovery Flow

**Deferred** - Need to establish orchestration layer architecture first

---

### Question 7: Orchestration Layer Architecture

**Response:**
**Hybrid architecture combining centralized service with distributed runtime:**

**Option B - Centralized Orchestration Service:**

- Separate orchestration service (registry/API)
- Central source of truth for all available MFEs
- Handles registration, discovery, health checks
- Provides query APIs (Phase A/B/C)
- Manages MFE lifecycle state
- Stores DSL documents
- Potentially handles telemetry aggregation

**Option A - Shell Runtime Orchestration:**

- Shell application contains runtime orchestration
- Browser-based registry/cache of available MFEs
- Handles dynamic loading via Module Federation
- Manages local MFE state (loaded, active, etc.)
- Executes MFE invocations
- Renders MFE UI components

**Combined Architecture:**

```
┌─────────────────────────────────────┐
│   Orchestration Service (Option B)  │
│   - Central registry                 │
│   - MFE discovery/health             │
│   - DSL storage                      │
│   - Query API (A/C/B phases)         │
└───────────────┬─────────────────────┘
                │
                │ REST API
                ▼
┌─────────────────────────────────────┐
│   Shell App (Option A)               │
│   - Runtime orchestration            │
│   - Module Federation loading        │
│   - Local MFE execution              │
│   - UI rendering                     │
│   - Cached registry                  │
└─────────────────────────────────────┘
```

**Benefits:**

- **Centralized**: Single source of truth, easier management, cross-shell visibility
- **Distributed runtime**: Performance, offline capability, reduced latency
- **Separation of concerns**: Service manages state, shell manages execution
- **Scalability**: Multiple shells can share one orchestration service

**Key Questions:**

1. Should registration be push (MFE → Service) or pull (Service → MFE)?
2. How does shell sync with orchestration service? (polling, websocket, event-driven?)
3. What happens if orchestration service is unavailable? (cached registry, degraded mode?)
4. Should orchestration service be part of this tool's generated code or separate deploy?

---

### Question 8: MFE Registration Mechanism

**Response:**
**Push registration on MFE start and deploy**

**Answers:**

1. **CLI auto-generates registration code**: YES - `mfe remote my-tool` generates registration logic automatically
2. **Automatic registration on startup**: YES - MFE registers itself immediately on startup
3. **Handle updates**: On subsequent deploys, MFE re-registers (update existing entry)
4. **De-registration on shutdown**: YES - MFE de-registers when shutting down

**Registration Flow:**

```javascript
// Auto-generated by CLI in every MFE
async function registerWithOrchestration() {
  await fetch('http://orchestration-service/api/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'csv-analyzer',
      version: '1.0.0',
      endpoint: 'http://localhost:3002',
      remoteEntry: 'http://localhost:3002/remoteEntry.js',
      dslEndpoint: 'http://localhost:3002/.well-known/mfe-manifest.yaml',
      healthCheck: 'http://localhost:3002/health',
    }),
  });
}

// On MFE startup
registerWithOrchestration();

// On MFE shutdown
process.on('SIGTERM', async () => {
  await deregisterFromOrchestration();
});
```

**Key Design Decision: Lightweight Registry**
Instead of storing full DSL in orchestration service, store **only metadata + DSL endpoint**. This keeps the registry nimble and allows for large/complex DSL documents without bloating the service.

---

### Question 9: Shell-to-Service Synchronization

**Response:**
**Hybrid approach: WebSocket + On-Demand**

**Option 2 - WebSocket for real-time updates:**

- Shell maintains WebSocket connection to orchestration service
- Receives real-time notifications when MFEs register/deregister/update
- Keeps local registry index current (just metadata, not full DSL)

**Option 3 - On-Demand DSL fetch:**

- Separate endpoint for exact fetch: `GET /mfe/{name}/dsl`
- When agent/user needs MFE details, shell fetches DSL directly from MFE
- OR orchestration service proxies: `GET /api/mfe/{name}/dsl` → fetches from MFE's `dslEndpoint`

**Architecture:**

```
MFE registers → Orchestration Service stores {name, endpoint, dslEndpoint, health}
                         ↓ (WebSocket notification)
Shell receives update → Updates local index {name, endpoint, dslEndpoint}
                         ↓ (when needed)
Shell/Agent needs DSL → Fetch directly: GET {dslEndpoint}
                         ↓
Returns full DSL document for agent evaluation
```

**Benefits:**

- **Nimble runtime**: Registry only stores pointers, not full DSL
- **Unpredictable DSL size**: No problem, fetched on-demand
- **Real-time awareness**: Shell knows what MFEs exist immediately
- **Lazy loading**: Full DSL only loaded when actually needed
- **Direct interrogation**: Can query MFE's DSL endpoint directly

**Registry Entry Example:**

```json
{
  "name": "csv-analyzer",
  "version": "1.0.0",
  "type": "tool",
  "endpoint": "http://localhost:3002",
  "remoteEntry": "http://localhost:3002/remoteEntry.js",
  "dslEndpoint": "http://localhost:3002/.well-known/mfe-manifest.yaml",
  "healthCheck": "http://localhost:3002/health",
  "status": "healthy",
  "lastSeen": "2025-11-26T20:20:00Z"
}
```

**Implementation for Phase A (probabilistic):**

```javascript
// Shell-side: Agent wants all MFEs
const registry = await orchestrationService.getRegistry(); // Gets lightweight index
const allDSLs = await Promise.all(
  registry.map((mfe) => fetch(mfe.dslEndpoint).then((r) => r.json()))
);
// Agent now has all full DSL documents to evaluate
```

---

### Question 10: Success Criteria

**Response:**
All five criteria confirmed as success metrics:

1. ✅ **Speed**: Developer generates new MFE, it's available to agents in < 5 seconds
2. ✅ **Scale**: Agent can discover and use 100+ MFEs without performance degradation
3. ✅ **Zero config**: Zero manual configuration needed to integrate new MFEs
4. ✅ **Self-documenting**: System is self-documenting (DSL is the documentation)
5. ✅ **Self-building**: Tools can generate tools that are immediately usable ("drinking our own wine")

**These are the V1 acceptance criteria for orchestration success.**

---

### Question 11: Primary Users

**Response:**
**Primary focus: Developers**

**Target personas in priority order:**

1. **Developers** (V1 Primary): Creating MFEs, testing code generation tools
   - Use case: Build the tools that build the system
   - Validation: Dogfooding - developers use the system to extend itself
2. **AI Agents** (V1 Secondary, V2+ Primary): Runtime MFE discovery and invocation
   - Driven by end users and designers
   - Agents as the interface between humans and MFE ecosystem
3. **End Users & Designers** (V2+): Indirect users via AI agents

**Strategy:** Start with developers to validate the tooling and patterns, then extend to AI-driven experiences for end users.

---

### Question 12: Non-Goals & Constraints

**Response:**

**Explicit Non-Goals (Out of Scope):**

- ❌ **Not a deployment tool**: Use separate `deploy` command
- ❌ **Not a build tool**: Use separate `build` command
- ❌ **Not handling data persistence**: MFEs own their data
- ⚠️ **Security/Auth policies**: Future work (Zanzibar-based auth system)

**Critical Boundaries & Design Considerations:**

**Design Systems & Shared Dependencies:**

- Major concern for ecosystem health
- Challenge: Balance **independence** vs **consistency**
- Runtime orchestration must optimize for:
  - **Independence**: MFEs can evolve independently
  - **Quality**: Shared design system ensures UX consistency
  - **Performance**: Avoid duplicate dependencies, optimize bundle size

**Shared Dependency Strategy Questions:**

1. How do MFEs declare design system dependencies in DSL?
2. How does Module Federation handle shared deps across 100+ MFEs?
3. Should orchestration layer enforce dependency versions?
4. How do we detect/prevent version conflicts?
5. Can MFEs opt-out of shared dependencies if needed?

**Design Principle:**

> "Optimize for independence while maintaining quality and performance"

This suggests:

- MFEs CAN work standalone (loose coupling)
- MFEs SHOULD use shared design system (consistent UX)
- Runtime orchestration MUST handle dependency sharing efficiently (no bloat)
- System SHOULD detect and warn about conflicts (but not block)

---

## Session 1 Summary

**Status:** ✅ COMPLETE

**Key Decisions Made:**

1. **Vision**: Runtime capability marketplace for dynamic MFE composition, treating AI agents/tools as first-class MFEs
2. **Core Problem**: Enable user and machine-driven selection of MFEs at runtime without build-time coupling
3. **Primary Scenario**: AI agents discover, evaluate, and invoke MFEs dynamically using DSL declarations
4. **Architecture**: Hybrid - centralized orchestration service + distributed shell runtime
5. **Discovery Strategy**: Phased (A→C→B): Probabilistic → Semantic → Deterministic
6. **Registration**: Push-based, auto-generated, with lightweight registry storing pointers not full DSL
7. **Sync Mechanism**: WebSocket for real-time + on-demand exact fetch for DSL documents
8. **Success Metrics**: <5s availability, 100+ MFE scale, zero config, self-documenting, self-building
9. **Primary Users**: Developers (V1), AI Agents (V2+)
10. **Critical Design Concern**: Balance MFE independence with design system consistency and performance

**Next Steps:**

- Proceed to Session 2: Scope & Architecture (detailed component design)
- Deep dive into DSL schema and validation
- Design orchestration service API contract
- Address shared dependency management strategy

---

---

## Requirements Summary

### From Session 1: Problem & Vision

**REQ-001: Dynamic MFE Discovery and Loading**

- Priority: P0 (Critical)
- Category: Core Orchestration
- Status: Requirements Defined
- Description: Enable runtime discovery and dynamic loading of MFEs without compile-time coupling
- Rationale: Support user/agent-driven selection of capabilities at runtime
- Acceptance Criteria:
  - MFEs auto-register on deployment
  - Shell discovers available MFEs via orchestration API
  - Module Federation loads MFEs on-demand
  - <5 second availability after MFE deployment
- Dependencies: REQ-002 (Registry), REQ-003 (Discovery)
- Technical Notes: Following ADR-009 (Hybrid orchestration), ADR-010 (Lightweight registry), ADR-012 (Push registration)

**REQ-002: Centralized MFE Registry**

- Priority: P0 (Critical)
- Category: Core Orchestration
- Status: Requirements Defined
- Description: Maintain registry of all available MFEs with metadata and DSL endpoints
- Rationale: Single source of truth for MFE availability and capabilities
- Acceptance Criteria:
  - Registry stores: name, version, type, endpoint, dslEndpoint, health
  - Registry supports 100+ MFEs without performance degradation
  - Registry provides Phase A discovery (get all)
  - Registry updates propagate to shells via WebSocket <5 seconds
  - Registry persists in Redis for staging/prod, in-memory for dev
- Dependencies: REQ-001 (Discovery), REQ-007 (WebSocket Sync)
- Technical Notes: Following ADR-010 (Lightweight registry - metadata only, not full DSL)

**REQ-003: Three-Phase Discovery (A/C/B)**

- Priority: P0 (Critical)
- Category: Agent Integration
- Status: Requirements Defined
- Description: Support probabilistic, semantic, and deterministic discovery modes
- Rationale: Enable agent autonomy while providing precision when needed
- Acceptance Criteria:
  - Phase A: Return all MFEs, agent reasons about selection
  - Phase C: Natural language query, return ranked results (V2)
  - Phase B: Query DSL with exact filtering (V2)
  - Agent can choose phase based on task confidence
- Dependencies: REQ-002 (Registry), REQ-010 (Semantic Search for Phase C)
- Technical Notes: Following ADR-011 (Three-phase discovery strategy)

**REQ-004: Language-Agnostic DSL Contract**

- Priority: P0 (Critical)
- Category: Platform Contract
- Status: Requirements Defined
- Description: Define MFE capabilities using YAML/JSON DSL with JSON Schema validation
- Rationale: Enable polyglot ecosystem (JavaScript, Python, Go, etc.)
- Acceptance Criteria:
  - DSL defines capabilities, inputs/outputs, lifecycle hooks
  - JSON Schema validates DSL documents
  - GraphQL schema for introspection
  - CLI validates DSL before registration
  - Works across all MFE types (UI/Tool/Agent/API)
- Dependencies: REQ-005 (GraphQL Introspection), REQ-015 (Abstract Base Class)
- Technical Notes: Following ADR-013 (Language-agnostic DSL), ADR-018 (GraphQL schema)

**REQ-005: Module Federation Dynamic Loading**

- Priority: P0 (Critical)
- Category: Runtime Integration
- Status: Requirements Defined
- Description: Load and execute remote MFEs via Webpack Module Federation
- Rationale: Enable true runtime composition without rebuild
- Acceptance Criteria:
  - Shell loads remote via remoteEntry URL
  - Shared dependencies handled automatically
  - Error isolation (one MFE failure doesn't crash shell)
  - Hot reload support in development
- Dependencies: REQ-001 (Discovery), REQ-002 (Registry)
- Technical Notes: Following ADR-007 (Module Federation loading), ADR-017 (Dev servers for MFEs)

**REQ-006: Zero-Config Integration**

- Priority: P1 (High)
- Category: Developer Experience
- Status: Requirements Defined
- Description: MFEs integrate with orchestration without manual configuration
- Rationale: Eliminate bottlenecks and enable rapid scaling
- Acceptance Criteria:
  - No manual registration steps
  - Auto-generated registration code in MFE templates
  - Environment variables for configuration
  - Works out-of-box in dev and prod
- Dependencies: REQ-008 (CLI Code Generation), REQ-012 (Auto-Registration)
- Technical Notes: Following ADR-012 (Push registration), ADR-016 (Shell owns orchestration)

**REQ-007: Real-Time Registry Synchronization**

- Priority: P1 (High)
- Category: Core Orchestration
- Status: Requirements Defined
- Description: Propagate registry changes to all connected shells in real-time
- Rationale: Ensure shells always have current MFE availability
- Acceptance Criteria:
  - WebSocket connection from shell to orchestration service
  - Registry updates broadcast to all connections
  - Shell updates local cache on notification
  - Graceful handling of connection loss (reconnect + resync)
- Dependencies: REQ-002 (Registry), REQ-001 (Discovery)
- Technical Notes: Following ADR-009 (Hybrid orchestration), ADR-010 (Lightweight sync)

**REQ-008: CLI Code Generation**

- Priority: P0 (Critical)
- Category: Developer Tooling
- Status: Requirements Defined
- Description: Generate shell, remote, and orchestration code via CLI commands
- Rationale: Consistent code structure, reduce manual errors
- Acceptance Criteria:
  - `mfe shell <name>` generates shell + orchestration service
  - `mfe remote <name>` generates remote with auto-registration
  - `mfe api <name>` generates API MFE with DSL endpoints
  - All generated code follows ADR patterns
  - Docker Compose files generated for deployment
- Dependencies: REQ-006 (Zero-Config), REQ-009 (DSL Validation)
- Technical Notes: Following ADR-016 (Shell owns orchestration), ADR-020 (Explicit shell creation)

**REQ-009: DSL Validation and Registration**

- Priority: P0 (Critical)
- Category: Developer Tooling
- Status: Requirements Defined
- Description: Validate DSL documents and register with orchestration service
- Rationale: Ensure platform contract compliance before deployment
- Acceptance Criteria:
  - `mfe validate <mfe>` checks DSL against JSON Schema
  - `mfe register <mfe>` validates and registers with orchestration
  - Validation errors provide clear feedback
  - CLI integration (validate on build/deploy)
- Dependencies: REQ-004 (DSL Contract), REQ-002 (Registry)
- Technical Notes: Following ADR-013 (DSL validation), ADR-018 (Platform contract)

**REQ-010: Semantic Search (Phase C) - Future**

- Priority: P2 (Medium - Future Enhancement)
- Category: Agent Integration
- Status: Deferred to V2
- Description: Natural language query with ranked MFE results
- Rationale: Assist agents with discovery when exact requirements unknown
- Acceptance Criteria:
  - Embedding generation for MFE DSLs
  - Vector similarity search
  - Ranking based on query relevance
  - Explanation of why MFE matched
- Dependencies: REQ-003 (Three-Phase Discovery), REQ-002 (Registry)
- Technical Notes: Requires vector database (pgvector, Pinecone, Weaviate)

**REQ-011: Telemetry and Observability - Future**

- Priority: P2 (Medium - Future Enhancement)
- Category: Operations
- Status: Deferred
- Description: Track MFE usage, performance, and errors
- Rationale: Enable optimization and debugging
- Acceptance Criteria:
  - Capability invocation tracking
  - Performance metrics (latency, throughput)
  - Error rates and stack traces
  - Agent decision tracking
- Dependencies: REQ-001 (Discovery), REQ-005 (Execution)
- Technical Notes: Platform-level DSL for telemetry hooks

**REQ-012: Self-Building System**

- Priority: P1 (High - Validation Goal)
- Category: System Capability
- Status: Requirements Defined
- Description: Tools can generate tools that are immediately usable
- Rationale: Ultimate validation of orchestration design
- Acceptance Criteria:
  - Code generator MFE creates new MFE projects
  - Generated MFEs conform to platform contract
  - Generated MFEs auto-register on deployment
    gen3) works
- Dependencies: REQ-008 (Code Generation), REQ-006 (Zero-Config)
- Technical Notes: Following ADR-014 (Self-building system design)

**REQ-013: Health Monitoring and Recovery**

- Priority: P1 (High)
- Category: Operations
- Status: Requirements Defined
- Description: Monitor MFE health and handle failures gracefully
- Rationale: Ensure system reliability and availability
- Acceptance Criteria:
  - Health check endpoint on all MFEs
  - Orchestration service polls health periodically
  - Unhealthy MFEs removed from discovery
  - Automatic recovery when MFE becomes healthy
  - Shell handles MFE unavailability gracefully
- Dependencies: REQ-002 (Registry), REQ-015 (Standard Capabilities)
- Technical Notes: Following ADR-018 (health standard capability)

### From Session 2: Scope & Architecture

**REQ-014: Orchestration Service per Shell**

- Priority: P0 (Critical)
- Category: Architecture
- Status: Requirements Defined
- Description: Generate orchestration service within every shell for deployment simplicity
- Rationale: Natural ownership, elegant deployment via Docker Compose
- Acceptance Criteria:
  - `mfe shell <name>` generates shell + orchestration-service/
  - Docker Compose includes orchestration service
  - Orchestration service runs on port 3100 (default)
  - Shell runtime communicates with orchestration service
  - Multiple shells can share orchestration if configured
- Dependencies: REQ-008 (CLI Generation), REQ-016 (Docker Deployment)
- Technical Notes: Following ADR-016 (Orchestration per shell), ADR-009 (Hybrid architecture)

**REQ-015: Abstract MFE Base Class**

- Priority: P0 (Critical)
- Category: Platform Contract
- Status: Requirements Defined
- Description: Define abstract base class with standard capabilities all MFEs must implement
- Rationale: Uniform interface across all MFE types and languages
- Acceptance Criteria:
  - Standard capabilities: authorizeAccess, health, describe, schema, query
  - TypeScript, Python, Go base class implementations
  - CLI generates MFE extending base class
  - Validation ensures standard capabilities present
  - GraphQL schema for introspection
- Dependencies: REQ-004 (DSL Contract), REQ-017 (JWT Auth), REQ-018 (GraphQL Schema)
- Technical Notes: Following ADR-018 (Abstract base class), ADR-013 (Language-agnostic)

**REQ-016: Docker Compose Deployment**

- Priority: P0 (Critical)
- Category: Deployment
- Status: Requirements Defined
- Description: Deploy shell + orchestration service via generated Docker Compose
- Rationale: Consistent deployment model across all environments
- Acceptance Criteria:
  - docker-compose.yml generated with shell + orchestration + redis
  - docker-compose.prod.yml for production overrides
  - Environment-specific configs (dev/staging/prod)
  - Service discovery via Docker network
  - One command deployment: docker-compose up
- Dependencies: REQ-014 (Orchestration per Shell), REQ-008 (CLI Generation)
- Technical Notes: Following ADR-016 (Orchestration per shell), ADR-017 (Docker-only orchestration)

**REQ-017: JWT-Based Authorization**

- Priority: P0 (Critical)
- Category: Security
- Status: Requirements Defined
- Description: Use JWT tokens for all MFE access authorization
- Rationale: Industry-standard, stateless, supports users and agents
- Acceptance Criteria:
  - authorizeAccess standard capability validates JWT
  - JWT includes: permissions, roles, context
  - Token passed to all capability invocations
  - Shell obtains user token on login
  - Agents obtain service tokens
  - Permission naming convention: mfe.<name>.<action>
- Dependencies: REQ-015 (Base Class), REQ-004 (DSL Contract)
- Technical Notes: Following ADR-019 (JWT authorization), Zanzibar-style tuples deferred

**REQ-018: GraphQL Schema Introspection**

- Priority: P0 (Critical)
- Category: Platform Contract
- Status: Requirements Defined
- Description: All MFEs expose GraphQL schema for capability introspection
- Rationale: Self-documenting, agent-friendly, industry-standard
- Acceptance Criteria:
  - schema standard capability returns GraphQL schema
  - query standard capability executes GraphQL queries
  - Agents can introspect MFE capabilities
  - Schema includes queries, mutations, types, authorization rules
  - Code generator scaffolds GraphQL endpoint automatically
- Dependencies: REQ-015 (Base Class), REQ-004 (DSL Contract), REQ-019 (Data Standardization)
- Technical Notes: Following ADR-019 (GraphQL alignment)

**REQ-019: Standardized Data Access**

- Priority: P0 (Critical)
- Category: Platform Contract
- Status: Requirements Defined
- Description: Single GraphQL endpoint for all data operations across all MFE types
- Rationale: Consistent data access pattern for UI, API, tool, and agent MFEs
- Acceptance Criteria:
  - Every MFE exposes /graphql endpoint
  - Data schema defined in GraphQL SDL format
  - Supports queries, mutations, subscriptions
  - Authorization rules embedded in schema
  - Frontend and backend MFEs use same pattern
  - Orchestration can aggregate schemas (federated queries)
  - Agents query data same way regardless of MFE type
- Dependencies: REQ-018 (GraphQL Schema), REQ-015 (Base Class), REQ-004 (DSL Contract)
- Technical Notes: Following ADR-019 (GraphQL alignment), enables schema federation in V2
  - Schema includes: Queries, Mutations, Types
  - Works across all languages (graphql-js, strawberry, graphql-go)
- Dependencies: REQ-015 (Base Class), REQ-004 (DSL Contract)
- Technical Notes: Following ADR-018 (GraphQL introspection), ADR-013 (Language-agnostic)

**REQ-019: Docker-Only Orchestration, Dev Servers for MFEs**

- Priority: P0 (Critical)
- Category: Architecture
- Status: Requirements Defined
- Description: Orchestration always in Docker, MFEs use dev servers in development
- Rationale: Consistent infrastructure, hot reload for MFEs
- Acceptance Criteria:
  - Orchestration service runs in Docker (all environments)
  - Shell runs in Docker (all environments)
  - MFEs run as dev servers in development (npm run dev)
  - MFEs run in Docker in staging/prod
  - Dev servers register with localhost:3100
  - Hot reload works for MFEs
- Dependencies: REQ-014 (Orchestration per Shell), REQ-016 (Docker Deployment)
- Technical Notes: Following ADR-017 (Docker-only orchestration)

**REQ-020: mfe init Workspace-First**

- Priority: P0 (Critical)
- Category: Developer Experience
- Status: Requirements Defined
- Description: mfe init scaffolds workspace only, shell created explicitly
- Rationale: Clear separation, flexibility, intentional orchestration
- Acceptance Criteria:
  - `mfe init <workspace>` creates workspace with remotes
  - `mfe shell <name>` creates shell explicitly
  - Workspace can have 0, 1, or many shells
  - Supports monorepo and polyrepo patterns
  - --empty flag for workspace without remotes
- Dependencies: REQ-008 (CLI Generation), REQ-014 (Orchestration per Shell)
- Technical Notes: Following ADR-020 (Workspace-first), ADR-016 (Shell explicit)

**REQ-021: API Data Interrogation via DSL**

- Priority: P1 (High)
- Category: Platform Contract
- Status: Requirements Defined
- Description: API MFEs expose data query capabilities via GraphQL schema
- Rationale: Enable direct data access without understanding API internals
- Acceptance Criteria:
  - query standard capability executes GraphQL queries
  - Schema includes data models and queries
  - Authorization via JWT on all queries
  - Works across different API implementations
  - Agents can discover and query data without API knowledge
- Dependencies: REQ-018 (GraphQL Schema), REQ-017 (JWT Auth), REQ-015 (Base Class)
- Technical Notes: Following ADR-018 (GraphQL query interface)

**REQ-022: CLI Command Integration**

- Priority: P1 (High)
- Category: Developer Tooling
- Status: Requirements Defined
- Description: Integrate orchestration with existing CLI commands
- Rationale: Seamless workflow from development to deployment
- Acceptance Criteria:
  - `mfe build` builds shell + orchestration service
  - `mfe deploy` deploys via Docker Compose
  - `mfe analyze` queries orchestration registry
  - `mfe validate` checks DSL compliance
  - `mfe registry status` shows current state
- Dependencies: REQ-008 (CLI Generation), REQ-009 (Validation), REQ-014 (Orchestration)
- Technical Notes: New commands: validate, register, registry status

**REQ-023: Environment Configuration**

- Priority: P1 (High)
- Category: Deployment
- Status: Requirements Defined
- Description: Support dev/staging/prod environments with appropriate configs
- Rationale: Same deployment model across environments
- Acceptance Criteria:
  - docker-compose.yml for development (in-memory registry)
  - docker-compose.prod.yml for production (Redis registry)
  - Environment variables for configuration
  - Service discovery works in all environments
  - MFEs auto-detect orchestration URL
- Dependencies: REQ-016 (Docker Compose), REQ-019 (Docker-Only Orchestration)
- Technical Notes: Following ADR-017 (Environment consistency)

**REQ-024: Shared Dependency Management - Deferred**

- Priority: P2 (Medium - Future)
- Category: Build & Deployment
- Status: Deferred
- Description: Handle shared dependencies across MFEs (design system, libraries)
- Rationale: Optimize bundle sizes, ensure compatibility
- Acceptance Criteria:
  - Module Federation shared config
  - Design system versioning strategy
  - Gradual migration path (no big bang)
  - Dependency conflict detection
- Dependencies: REQ-005 (Module Federation), REQ-008 (CLI Generation)
- Technical Notes: Complex problem, requires deeper design session

---

## Requirements Traceability

### P0 (Critical) Requirements - V1 MVP

- REQ-001: Dynamic MFE Discovery
- REQ-002: Centralized Registry
- REQ-003: Three-Phase Discovery (Phase A only in V1)
- REQ-004: Language-Agnostic DSL
- REQ-005: Module Federation Loading
- REQ-008: CLI Code Generation
- REQ-009: DSL Validation
- REQ-014: Orchestration per Shell
- REQ-015: Abstract Base Class
- REQ-016: Docker Compose Deployment
- REQ-017: JWT Authorization
- REQ-018: GraphQL Introspection
- REQ-019: Docker-Only Orchestration
- REQ-020: mfe init Workspace-First

### P1 (High) Requirements - V1 or Early V2

- REQ-006: Zero-Config Integration
- REQ-007: Real-Time Sync
- REQ-012: Self-Building System
- REQ-013: Health Monitoring
- REQ-021: API Data Interrogation
- REQ-022: CLI Command Integration
- REQ-023: Environment Configuration

### P2 (Medium) Requirements - V2+

- REQ-010: Semantic Search (Phase C)
- REQ-011: Telemetry & Observability
- REQ-024: Shared Dependency Management

---

## ADR Cross-Reference

**Session 1 ADRs:**

- ADR-009: Hybrid orchestration → REQ-001, REQ-002, REQ-014
- ADR-010: Lightweight registry → REQ-002, REQ-003
- ADR-011: Three-phase discovery → REQ-003, REQ-010
- ADR-012: Push registration → REQ-006, REQ-008
- ADR-013: Language-agnostic DSL → REQ-004, REQ-015
- ADR-014: Self-building → REQ-012

**Session 2 ADRs:**

- ADR-016: Orchestration per shell → REQ-014, REQ-016
- ADR-017: Docker-only orchestration → REQ-016, REQ-019, REQ-023
- ADR-018: Abstract base class → REQ-015, REQ-018, REQ-021
- ADR-019: JWT authorization → REQ-017
- ADR-020: Shell explicit generation → REQ-020
- ADR-022: GraphQL data standardization → REQ-019, REQ-018, REQ-015

**Session 4: Platform Contract Refinement ADRs (2025-11-27):**

- ADR-023: RemoteEntry as abstract convention → REQ-025
- ADR-024: Standard capabilities listed in DSL → REQ-026
- ADR-025: Capability type discrimination → REQ-027
- ADR-026: Load-Render-Refresh lifecycle → REQ-028
- ADR-027: Single endpoint, path-based APIs → REQ-029
- ADR-028: Discovery via .well-known convention → REQ-030
- ADR-029: RemoteEntry for all MFE types → REQ-031
- ADR-030: Render returns data for backend MFEs → REQ-032
- ADR-031: Standardized extensible lifecycle hooks → REQ-033

**Session 5: Open Questions Resolution ADRs (2025-11-26):**

- ADR-032: DSL schema validation strategy → REQ-034, REQ-035
- ADR-033: Neo4j registry with Redis caching → REQ-036, REQ-037
- ADR-034: Health check and replacement strategy → REQ-038, REQ-039
- ADR-035: Deterministic discovery default → REQ-040

---

## Session 4: Platform Contract Refinement

**Date:** 2025-11-27  
**Goal:** Define comprehensive platform contract that ALL MFEs must conform to  
**Status:** ✅ COMPLETE

### New Requirements Identified

#### REQ-025: RemoteEntry as Abstract Convention

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
`remoteEntry` is a language-agnostic convention, not JavaScript-specific implementation. All MFEs must provide entry point following abstract interface.

**Rationale:**  
Enable polyglot ecosystem (JavaScript, Python, Go, etc.) while maintaining uniform loading pattern across all MFE types.

**Acceptance Criteria:**

- [ ] RemoteEntry defined as abstract interface
- [ ] JavaScript MFEs use Module Federation remoteEntry.js
- [ ] Python/Go MFEs expose HTTP endpoint returning module descriptor
- [ ] All implementations support init/get/destroy operations
- [ ] Code generator scaffolds appropriate remoteEntry per language

**Dependencies:** REQ-004 (Language-Agnostic DSL), REQ-015 (Abstract Base Class)

**Technical Notes:**

```yaml
# Abstract interface (language-agnostic)
interface RemoteEntry {
  init(config?: object): Promise<MFEInstance>
  get(capabilityName: string): Promise<CapabilityHandler>
  destroy(): Promise<void>
}

# JavaScript: remoteEntry.js via Module Federation
# Python: /entry endpoint returning JSON descriptor
# Go: /entry endpoint returning JSON descriptor
```

---

#### REQ-026: Standard Capabilities Listed in DSL

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
All 8 platform standard capabilities must be explicitly listed in every MFE's DSL, not assumed.

**Rationale:**  
Enable re-entrant evolution - platform can modify standard capabilities over time without breaking existing MFEs. Makes contract explicit and verifiable.

**Acceptance Criteria:**

- [ ] DSL schema requires 8 standard capabilities present
- [ ] Code generator includes all platform capabilities in scaffolded DSL
- [ ] Validation tool checks for missing platform capabilities
- [ ] Documentation explains each platform capability
- [ ] Examples show both platform and domain capabilities

**Dependencies:** REQ-004 (DSL), REQ-015 (Abstract Base Class), REQ-027 (Type Discrimination)

**Technical Notes:**  
Standard capabilities: load, render, refresh, authorizeAccess, health, describe, schema, query

---

#### REQ-027: Capability Type Discrimination

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
All capabilities (platform and custom) must have `type: platform | domain` field for clear discrimination.

**Rationale:**  
Enables agents to distinguish between platform-standard and MFE-specific capabilities. Supports validation and discovery.

**Acceptance Criteria:**

- [ ] DSL schema requires `type` field on all capabilities
- [ ] Platform capabilities have `type: platform`
- [ ] Custom capabilities have `type: domain`
- [ ] Validation enforces type field presence
- [ ] Discovery API can filter by capability type

**Dependencies:** REQ-026 (Listed Capabilities)

**Technical Notes:**

```yaml
capabilities:
  - authorizeAccess:
      type: platform
  - customCapability:
      type: domain
```

---

#### REQ-028: Load-Render-Refresh Lifecycle

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
Add load, render, refresh as standard platform capabilities for explicit lifecycle management across all MFE types.

**Rationale:**  
Provides uniform initialization, rendering, and state update contract. Backend MFEs need lifecycle management just like UI MFEs.

**Acceptance Criteria:**

- [ ] Load capability initializes MFE runtime
- [ ] Render capability returns UI component or data representation
- [ ] Refresh capability reloads state
- [ ] All three have defined inputs/outputs/lifecycle
- [ ] Backend and frontend MFEs implement consistently

**Dependencies:** REQ-026 (Listed Capabilities), REQ-032 (Backend Render)

**Technical Notes:**

```typescript
await mfe.load({ config }); // Initialize
const ui = await mfe.render({ props }); // UI or data
await mfe.refresh({ full: false }); // Update state
```

---

#### REQ-029: Single Endpoint Path-Based APIs

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
One base endpoint URL per MFE, standard paths for all services (health, graphql, discovery, capabilities).

**Rationale:**  
Simplified configuration, conventional routing, consistent URL structure across all MFEs.

**Acceptance Criteria:**

- [ ] DSL requires single `endpoint` field
- [ ] Standard paths documented: /health, /graphql, /.well-known/mfe-manifest.yaml
- [ ] Capability invocation via /capability/{name}
- [ ] Code generator scaffolds routing for standard paths
- [ ] All MFEs follow same path conventions

**Dependencies:** REQ-028 (Discovery Convention)

**Technical Notes:**

```yaml
endpoint: http://localhost:3002
# Standard paths:
# GET  /health
# POST /graphql
# GET  /.well-known/mfe-manifest.yaml
# POST /capability/{name}
```

---

#### REQ-030: Discovery via .well-known Convention

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
MFE manifests located at `/.well-known/mfe-manifest.yaml` following web standard convention.

**Rationale:**  
Zero-config discovery, follows web standards, enables automatic manifest location without configuration.

**Acceptance Criteria:**

- [ ] All MFEs serve manifest at /.well-known/mfe-manifest.yaml
- [ ] `discovery` field defaults to ${endpoint}/.well-known/mfe-manifest.yaml
- [ ] Code generator scaffolds manifest endpoint
- [ ] Orchestration service discovers via well-known path
- [ ] Validation ensures manifest is accessible

**Dependencies:** REQ-029 (Path-Based APIs)

**Technical Notes:**

```yaml
# DSL field (optional, defaults shown)
discovery: http://localhost:3002/.well-known/mfe-manifest.yaml
```

---

#### REQ-031: RemoteEntry Required for All MFE Types

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
ALL MFE types (remote, tool, agent, api) must provide `remoteEntry` field, not just web components.

**Rationale:**  
Creates uniform loading pattern. Backend MFEs are first-class loadable modules, not second-class citizens.

**Acceptance Criteria:**

- [ ] DSL schema requires `remoteEntry` for all types
- [ ] Backend MFEs (Python, Go) provide remoteEntry endpoint
- [ ] Validation enforces remoteEntry presence
- [ ] Code generator scaffolds remoteEntry for all types
- [ ] Orchestration loads all MFEs via remoteEntry

**Dependencies:** REQ-025 (Abstract RemoteEntry)

**Technical Notes:**  
Even type: api requires remoteEntry for uniform orchestration pattern.

---

#### REQ-032: Render Returns Data for Backend MFEs

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
Backend MFEs implement `render` capability, returning JSON data representation via GraphQL query execution.

**Rationale:**  
Consistent render contract across all MFE types. Backend MFEs "render" their data, UI MFEs render components.

**Acceptance Criteria:**

- [ ] Backend MFEs implement render capability
- [ ] Render executes GraphQL query and returns data
- [ ] Return format: `{ type: 'data', format: 'json', content: {...} }`
- [ ] UI MFEs return React/Vue components
- [ ] Both follow same capability signature

**Dependencies:** REQ-028 (Load-Render-Refresh), REQ-022 (GraphQL Standardization)

**Technical Notes:**

```python
async def render(self, container=None, props=None):
    query = "query { ... }"
    data = await self.executeQuery(query)
    return { "type": "data", "format": "json", "content": data }
```

---

#### REQ-033: Standardized Extensible Lifecycle Hooks

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
before/main/after/error are standard lifecycle phases for ALL capabilities. Domain capabilities can extend with custom phases.

**Rationale:**  
Consistency with flexibility. Platform can inject standard behavior, domain capabilities can add specific phases.

**Acceptance Criteria:**

- [ ] All capabilities have before/main/after/error phases
- [ ] Domain capabilities can add custom phases
- [ ] Lifecycle hook structure documented
- [ ] Code generator scaffolds lifecycle hooks
- [ ] Orchestration can inject platform hooks

**Dependencies:** REQ-026 (Listed Capabilities), REQ-027 (Type Discrimination)

**Technical Notes:**

```yaml
lifecycle:
  before: [...]
  main: [...]
  after: [...]
  error: [...]
  custom: # Optional for domain capabilities
    validation: [...]
    transformation: [...]
```

---

## Session 5: Open Questions Resolution (2025-11-26)

**Status:** ✅ COMPLETE

### New Requirements from Session 5

#### REQ-034: Hybrid DSL Schema Validation

**Priority:** P0 (Critical)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
Hybrid validation strategy - strict on required fields in all environments, environment-based (strict/lenient) on optional fields.

**Rationale:**  
Balance early error detection with development flexibility and production safety.

**Acceptance Criteria:**

- [ ] Required fields (name, version, type, remoteEntry) always strictly validated
- [ ] Type enum enforced: `tool | agent | feature | service`
- [ ] Optional fields (capabilities, lifecycle, metadata) validated per environment
- [ ] Config flag `VALIDATION_MODE=strict|lenient` controls behavior
- [ ] Production: strict validation, silently ignore malformed optional fields
- [ ] Development: warn but allow registration for malformed optional fields

**Dependencies:** REQ-004 (DSL), REQ-009 (Validation)

**Technical Notes:**  
Reference ADR-032 for implementation details.

---

#### REQ-035: Validation Endpoint

**Priority:** P0 (Critical)  
**Category:** Orchestration API  
**Status:** Accepted

**Description:**  
REST endpoint `GET /api/validate/:mfeId?` to validate specific MFE or all registered MFEs on-demand.

**Rationale:**  
Enable debugging and health verification without waiting for background checks.

**Acceptance Criteria:**

- [ ] `GET /api/validate/:mfeId` validates specific MFE
- [ ] `GET /api/validate` validates all registered MFEs
- [ ] Response includes: dslValid, healthy, warnings, lastCheck
- [ ] Checks both `/health` endpoint (HTTP 200) AND valid DSL response
- [ ] Summary response for all-MFE check includes totals

**Dependencies:** REQ-002 (Registry), REQ-038 (Health Check)

**Technical Notes:**  
Reference ADR-032 for response format.

---

#### REQ-036: Neo4j Graph Registry

**Priority:** P0 (Critical)  
**Category:** Infrastructure  
**Status:** Accepted

**Description:**  
Use Neo4j as primary registry storage for MFE relationships, capability graphs, and Zanzibar-style authorization tuples.

**Rationale:**  
Graph database natural fit for MFE relationships and authorization patterns. Enables capability chain queries and replacement discovery.

**Acceptance Criteria:**

- [ ] Neo4j deployed per shell via Docker Compose
- [ ] Nodes: MFE, Capability, User, Role
- [ ] Relationships: HAS_CAPABILITY, DEPENDS_ON, CAN_REPLACE, HAS_ROLE, CAN_ACCESS
- [ ] Lazy node creation (created as MFEs register)
- [ ] Neo4j Browser exposed on port 7474 for dev debugging
- [ ] Named volumes for data persistence across restarts
- [ ] Capability chain queries (2-3 hops) for discovery

**Dependencies:** REQ-002 (Registry), REQ-014 (Orchestration per Shell)

**Technical Notes:**  
Reference ADR-033 for Cypher schema and queries.

---

#### REQ-037: Redis Auth Caching

**Priority:** P0 (Critical)  
**Category:** Infrastructure  
**Status:** Accepted

**Description:**  
Redis caching layer in front of Neo4j for <10ms authorization checks and hot query paths.

**Rationale:**  
Real-time auth checks require sub-10ms response times; Redis provides fast cache with TTL-based invalidation.

**Acceptance Criteria:**

- [ ] Redis deployed per shell via Docker Compose
- [ ] LRU cache for auth queries (user → MFE access)
- [ ] 60-second TTL for cached authorization results
- [ ] Cache invalidation on permission changes via WebSocket
- [ ] Named volumes for persistence
- [ ] Cache key pattern: `auth:{userId}:{mfeId}`

**Dependencies:** REQ-036 (Neo4j), REQ-017 (JWT Auth)

**Technical Notes:**  
Reference ADR-033 for caching implementation.

---

#### REQ-038: Background Health Monitoring

**Priority:** P0 (Critical)  
**Category:** Orchestration  
**Status:** Accepted

**Description:**  
Registry component performs background health checks every 5 minutes on all registered MFEs.

**Rationale:**  
Balance monitoring overhead with timely failure detection; 5-minute interval acceptable for most use cases.

**Acceptance Criteria:**

- [ ] Health check interval: 5 minutes
- [ ] Check criteria: `/health` HTTP 200 AND valid DSL from `/.well-known/mfe-manifest.yaml`
- [ ] Update MFE status in Neo4j (healthy/unhealthy)
- [ ] Track lastHealthCheck timestamp per MFE
- [ ] 5-second timeout per health check request

**Dependencies:** REQ-002 (Registry), REQ-036 (Neo4j)

**Technical Notes:**  
Reference ADR-034 for implementation.

---

#### REQ-039: Auto-Replacement on Failure

**Priority:** P1 (High)  
**Category:** Orchestration  
**Status:** Accepted

**Description:**  
When MFE becomes unhealthy, discover replacement candidates via capability matching and notify shell via WebSocket for auto-switch.

**Rationale:**  
Enable graceful degradation through loose coupling; maintain service continuity when MFEs fail.

**Acceptance Criteria:**

- [ ] Find replacements via Neo4j capability matching query
- [ ] Support explicit CAN_REPLACE relationships with score
- [ ] Calculate compatibility score based on capability overlap
- [ ] WebSocket notification includes ranked replacements
- [ ] Shell auto-switches to top replacement
- [ ] If no replacement available, notify user with error

**Dependencies:** REQ-038 (Health Check), REQ-036 (Neo4j), REQ-007 (WebSocket Sync)

**Technical Notes:**  
Reference ADR-034 for replacement discovery Cypher query.

---

#### REQ-040: Deterministic Discovery Default

**Priority:** P0 (Critical)  
**Category:** Discovery  
**Status:** Accepted

**Description:**  
Phase B (deterministic query-based discovery) as the default strategy. No AI infrastructure required. Progressive enhancement path to Phase C/A.

**Rationale:**  
Developers and AI agents are primary users; deterministic queries work without AI infrastructure and are fast/predictable.

**Acceptance Criteria:**

- [ ] Phase B (structured queries) is default discovery method
- [ ] Works with Neo4j only (no embedding service, no LLM)
- [ ] Configurable per shell via `defaultPhase` setting
- [ ] Graceful fallback when preferred phase unavailable
- [ ] Query patterns documented: type, capabilities, inputType, accessibleBy
- [ ] Future: detect input type (structured vs NL) for auto-phase selection

**Dependencies:** REQ-003 (Three-Phase Discovery), REQ-036 (Neo4j)

**Technical Notes:**  
Reference ADR-035 for configuration and progressive enhancement.

---

#### REQ-041: Emit Platform Capability

**Priority:** P1 (High)  
**Category:** Platform Contract  
**Status:** Accepted

**Description:**  
Add `emit` as 9th platform capability for generic telemetry/event emission (errors, metrics, traces, logs).

**Rationale:**  
Standardize event emission across all MFEs; enable platform-level telemetry aggregation.

**Acceptance Criteria:**

- [ ] `emit` capability added to platform standard capabilities
- [ ] Supports event types: error, metric, trace, log, custom
- [ ] Includes severity levels: debug, info, warn, error, critical
- [ ] Outputs: emitted (boolean), eventId (string)
- [ ] Lifecycle hooks include self-error handling (emit failure → local fallback)
- [ ] Code generator includes emit in all MFE templates

**Dependencies:** REQ-026 (Standard Capabilities), REQ-015 (Abstract Base Class)

**Technical Notes:**  
See DSL reference `/docs/dsl.yaml` for full emit capability definition.

---

## Platform Contract Summary (Session 4)

### Required Fields (All MFEs)

```yaml
# Identity
name: string
version: string
type: tool | agent | feature | service
description: string
owner: string
tags: [string]
category: string
language: string

# Endpoints
endpoint: url
remoteEntry: url
discovery: url (defaults to ${endpoint}/.well-known/mfe-manifest.yaml)

# Capabilities (8 platform + N domain)
capabilities:
  # Platform capabilities (required for all)
  - load: { type: platform, ... }
  - render: { type: platform, ... }
  - refresh: { type: platform, ... }
  - authorizeAccess: { type: platform, ... }
  - health: { type: platform, ... }
  - describe: { type: platform, ... }
  - schema: { type: platform, ... }
  - query: { type: platform, ... }

  # Domain capabilities (MFE-specific)
  - customCapability: { type: domain, ... }

# Data (optional, if MFE exposes data)
data:
  endpoint: /graphql
  schema: ...

# Dependencies (optional)
dependencies:
  shared: [...]
  mfes: [...]
```

### Capability Structure (All Capabilities)

```yaml
capabilityName:
  type: platform | domain
  description: string
  handler: string
  inputs: [{ name, type, required }]
  outputs: [{ name, type }]
  lifecycle:
    before: [{ hookName, handler, description }]
    main: [{ hookName, handler, description }]
    after: [{ hookName, handler, description }]
    error: [{ hookName, handler, description }]
    custom: # Optional for domain capabilities
      phaseName: [{ hookName, handler, description }]
  authorization: string (optional)
```

---

## Updated Requirements Traceability

### P0 (Critical) Requirements - V1 MVP

- REQ-001: Dynamic MFE Discovery
- REQ-002: Centralized Registry
- REQ-003: Three-Phase Discovery (Phase A only in V1)
- REQ-004: Language-Agnostic DSL
- REQ-005: Module Federation Loading
- REQ-008: CLI Code Generation
- REQ-009: DSL Validation
- REQ-014: Orchestration per Shell
- REQ-015: Abstract Base Class
- REQ-016: Docker Compose Deployment
- REQ-017: JWT Authorization
- REQ-018: GraphQL Introspection
- REQ-019: Docker-Only Orchestration
- REQ-020: mfe init Workspace-First
- **REQ-025: RemoteEntry as Abstract Convention** ⭐ Session 4
- **REQ-026: Standard Capabilities Listed in DSL** ⭐ Session 4
- **REQ-027: Capability Type Discrimination** ⭐ Session 4
- **REQ-028: Load-Render-Refresh Lifecycle** ⭐ Session 4
- **REQ-029: Single Endpoint Path-Based APIs** ⭐ Session 4
- **REQ-030: Discovery via .well-known Convention** ⭐ Session 4
- **REQ-031: RemoteEntry for All MFE Types** ⭐ Session 4
- **REQ-032: Render Returns Data for Backend MFEs** ⭐ Session 4
- **REQ-033: Standardized Extensible Lifecycle Hooks** ⭐ Session 4
- **REQ-034: Hybrid DSL Schema Validation** ⭐ Session 5
- **REQ-035: Validation Endpoint** ⭐ Session 5
- **REQ-036: Neo4j Graph Registry** ⭐ Session 5
- **REQ-037: Redis Auth Caching** ⭐ Session 5
- **REQ-038: Background Health Monitoring** ⭐ Session 5
- **REQ-040: Deterministic Discovery Default** ⭐ Session 5

### P1 (High) Requirements - V1 or Early V2

- REQ-006: Zero-Config Integration
- REQ-007: Real-Time Sync
- REQ-012: Self-Building System
- REQ-013: Health Monitoring
- REQ-021: API Data Interrogation
- REQ-022: CLI Command Integration
- REQ-023: Environment Configuration
- **REQ-039: Auto-Replacement on Failure** ⭐ Session 5
- **REQ-041: Emit Platform Capability** ⭐ Session 5

### P2 (Medium) Requirements - V2+

- REQ-010: Semantic Search (Phase C)
- REQ-011: Telemetry & Observability
- REQ-024: Shared Dependency Management
