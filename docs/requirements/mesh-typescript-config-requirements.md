# GraphQL Mesh TypeScript Configuration Migration - Requirements Document

**Document Status:** � In Progress  
**Epic Issue:** [#66](https://github.com/falese/seans-mfe-tool/issues/66)  
**Created:** 2025-12-13  
**Owner:** Sean  
**Feature:** Mesh TypeScript Configuration + Platform Schema Mapping  
**Session:** Requirements Elicitation - Mesh v0 Analysis & v1 Migration Planning

## Executive Summary

Migrate BFF layer from YAML-based GraphQL Mesh v0 configuration to TypeScript-based programmatic Mesh configuration while preserving DSL as single source of truth. Enable platform-specific schema mapping for cross-cutting concerns (search, tasks, notifications) with code generation that maintains type safety across the MFE ecosystem.

### Key Principles (User-Validated)

1. **DSL is Source of Truth**: Preserve DSL-first architecture using Guild tools for implementation
2. **Micro-Graph Architecture**: Each BFF serves only its MFE's schema (NO gateway pattern)
3. **Dynamic Supergraph**: Orchestration layer handles composition at runtime, not build time
4. **Type Mapping**: MFEs define data mappings, all adhere to platform-defined types
5. **Watch-First Development**: Continuous regeneration during development

---

## Problem Statement

### Current Pain Points

1. **YAML Configuration Limitation**
   - `.meshrc.yaml` is separate artifact (not DSL-only)
   - No type safety in configuration
   - Limited plugin/transform availability in Mesh v0.100.x
2. **Dependency Management Issues**

   - Version conflicts documented in `MESHRC-DIAGNOSIS.md`
   - npm ERESOLVE errors with current dependency matrix
   - Unclear compatibility between Mesh packages and template dependencies

3. **Schema Mapping Gap**

   - No standardized way to define platform-specific schemas
   - Each MFE duplicates search/task/notification types
   - Manual mapping between OpenAPI responses and platform interfaces

4. **Code Generation Limitations**
   - YAML config not suitable for complex mapping logic
   - No shared type library for platform schemas
   - Manual resolver implementation required

---

## Strategic Goals

### Goal 1: TypeScript Configuration (REQ-MESH-TS-001)

**Objective**: Use TypeScript `mesh.config.ts` instead of YAML for type safety and programmatic flexibility

**Benefits (Ranked by Priority)**:

1. 🥇 **DSL Alignment**: TypeScript matches runtime type system
2. 🥈 **Type Safety**: IDE autocomplete, compile-time validation
3. 🥉 **Flexibility**: Conditional logic, dynamic configuration
4. **Code Reuse**: Import shared utilities, types
5. **Debugging**: Easier tracing of config issues

**Constraints**:

- Must preserve DSL as single source of truth
- No dependency on Hive Gateway (avoids static gateway pattern)
- Generated config, not hand-written

---

### Goal 2: Platform Schema System (REQ-MESH-PLATFORM-001)

**Objective**: Standardized type system for cross-cutting concerns shared across MFEs

**Platform Schema Domains**:

1. **Search**: `IPlatformSearchResult` with title, description, url, metadata
2. **Tasks**: `IPlatformTask` with id, title, status, assignee, dueDate
3. **Notifications**: `IPlatformNotification` with id, message, timestamp, type
4. **User**: `IPlatformUser` with id, name, avatar, roles
5. **Extensible**: Future domains added via shared library updates

**Design Principles**:

- **Orchestration-Defined**: Platform types live in orchestration layer, NOT shell
- **MFE Implements**: Each MFE maps its data to platform interfaces
- **Shared Library**: Platform types distributed via `@mfe-platform/types` package
- **Code Generation**: CLI generates mapping boilerplate from DSL

**Schema Location**:

- ❌ NOT in shell MFE (shell is blank container)
- ✅ In orchestration layer (`src/platform-runtime/` or separate package)
- ✅ MFEs import types, implement mappings in DSL

---

### Goal 3: Micro-Graph Architecture (REQ-MESH-MICRO-001)

**Objective**: Each BFF serves only its own MFE's GraphQL schema (no federation, no gateway)

**Architecture**:

```
┌─────────────────────────────────────┐
│   Orchestration / Control Layer    │
│  (Future: Dynamic Supergraph)       │
└─────────────────────────────────────┘
              ↓ Discovers
┌──────────────────────────────────────────────────┐
│  MFE 1: User Dashboard                           │
│  ├── BFF (mesh.config.ts generated from DSL)     │
│  │   └── GraphQL: Query.users, Query.searchUsers│
│  └── Remote (React components)                   │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  MFE 2: Product Catalog                          │
│  ├── BFF (mesh.config.ts generated from DSL)     │
│  │   └── GraphQL: Query.products, Query.search   │
│  └── Remote (React components)                   │
└──────────────────────────────────────────────────┘
```

**Key Constraints**:

- ❌ NO Hive Gateway dependency
- ❌ NO static supergraph composition
- ❌ NO federation at build time
- ✅ Each BFF is independent, discoverable service
- ✅ Orchestration layer composes at runtime
- ✅ MFEs can be added/removed dynamically

---

## Requirements

### REQ-MESH-TS-001: DSL → TypeScript Config Generation

**Status:** 📋 Planned  
**Priority:** High  
**Dependencies:** None

**Description:**  
CLI extracts `data:` section from `mfe-manifest.yaml` and generates `mesh.config.ts` with typed Mesh configuration.

**DSL Structure (Unchanged)**:

```yaml
# mfe-manifest.yaml
data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
  transforms:
    - prefix:
        value: User_
  plugins:
    - responseCache:
        ttl: 300000
```

**Generated Artifact**:

```typescript
// mesh.config.ts (GENERATED - DO NOT EDIT)
import { defineConfig } from '@graphql-mesh/compose-cli';
import { loadOpenAPISubgraph } from '@omnigraph/openapi';

export default defineConfig({
  subgraphs: [
    {
      sourceHandler: loadOpenAPISubgraph('UserAPI', {
        source: './specs/user-api.yaml',
        operationHeaders: {
          // From DSL if specified
        },
      }),
      transforms: [
        {
          prefix: {
            value: 'User_',
            includeRootOperations: true,
          },
        },
      ],
    },
  ],
  plugins: [
    // Response cache from DSL
  ],
});
```

**Acceptance Criteria**:

- [ ] `mfe bff:generate-config` command extracts DSL → `mesh.config.ts`
- [ ] Generated config uses TypeScript imports (not YAML strings)
- [ ] Supports all current v0 transforms/plugins
- [ ] Validates DSL schema before generation
- [ ] Includes source comments referencing DSL lines
- [ ] Generated file has header: "GENERATED - DO NOT EDIT" with timestamp
- [ ] Generated files are tracked in git (not .gitignore'd)
- [ ] Warns if manually edited files will be overwritten
- [ ] Command fails with clear error if DSL invalid

**Traceability**:

- ADR-TBD: Mesh TypeScript Configuration
- Tests: `src/commands/__tests__/bff-generate-config.test.ts`

---

### REQ-MESH-TS-002: Programmatic Runtime Mesh

**Status:** 📋 Planned  
**Priority:** High  
**Dependencies:** REQ-MESH-TS-001

**Description:**  
Use programmatic Mesh API to create GraphQL server at runtime, avoiding gateway dependency.

**Implementation Approach (Option B - Validated)**:

```typescript
// Generated server.ts
import { createMesh } from '@graphql-mesh/runtime';
import meshConfig from './mesh.config';
import express from 'express';

async function startBFF() {
  const mesh = await createMesh(meshConfig);
  const app = express();

  app.use('/graphql', mesh.httpHandler);
  app.listen(4000);
}

startBFF();
```

**Key Decisions**:

- ❌ NOT using Hive Gateway (avoids gateway pattern)
- ❌ NOT generating supergraph SDL (no federation)
- ✅ Using `@graphql-mesh/runtime` programmatic API
- ✅ Express server wraps Mesh (keeps current server.ts pattern)
- ✅ Static asset serving remains unchanged

**Acceptance Criteria**:

- [ ] Generated `server.ts` uses programmatic Mesh API
- [ ] No dependency on `@graphql-hive/gateway`
- [ ] Supports static asset serving (current behavior)
- [ ] Health check endpoint works
- [ ] GraphQL Playground available (development mode)
- [ ] Production build removes Playground
- [ ] Hot reload works with watch mode

---

### REQ-MESH-PLATFORM-002: Platform Type Library

**Status:** 📋 Planned  
**Priority:** High  
**Dependencies:** None

**Description:**  
Shared TypeScript library defining platform interfaces for cross-cutting concerns.

**Package Structure**:

```
@mfe-platform/types/
├── package.json
├── src/
│   ├── index.ts              # Barrel exports
│   ├── search.types.ts       # IPlatformSearchResult
│   ├── task.types.ts         # IPlatformTask
│   ├── notification.types.ts # IPlatformNotification
│   ├── user.types.ts         # IPlatformUser
│   └── common.types.ts       # Shared utilities
└── dist/                     # Compiled .d.ts files
```

**Example Type Definition**:

```typescript
// src/search.types.ts
export interface IPlatformSearchResult {
  /** Unique identifier */
  id: string;

  /** Display title */
  title: string;

  /** Optional description */
  description?: string;

  /** Link to resource */
  url: string;

  /** Optional thumbnail URL */
  thumbnail?: string;

  /** MFE-specific metadata */
  metadata?: Record<string, unknown>;
}

export type SearchResultType = 'user' | 'product' | 'article' | 'file';

export interface IPlatformSearchQuery {
  query: string;
  filters?: Record<string, unknown>;
  type?: SearchResultType;
  limit?: number;
  offset?: number;
}
```

**Acceptance Criteria**:

- [ ] Package created: `@mfe-platform/types`
- [ ] Published to local npm registry (or Git package)
- [ ] Includes 4 initial domains: search, task, notification, user
- [ ] All interfaces documented with JSDoc
- [ ] TypeScript strict mode enabled
- [ ] Exports .d.ts declaration files
- [ ] Versioned semantically (1.0.0 initial)
- [ ] README with usage examples

**Distribution**:

- Option A: npm private registry
- Option B: Git package (npm install git+https://...)
- Option C: Workspace package (monorepo)

---

### REQ-MESH-PLATFORM-003: DSL Schema Mapping

**Status:** 📋 Planned  
**Priority:** High  
**Dependencies:** REQ-MESH-PLATFORM-002

**Description:**  
DSL syntax for mapping OpenAPI responses to platform interfaces with code generation.

**DSL Extension**:

```yaml
# mfe-manifest.yaml
capabilities:
  - search:
      type: domain
      implements: IPlatformSearchResult # References @mfe-platform/types
      description: Search users by name, email, or department
      inputs:
        - name: query
          type: IPlatformSearchQuery
      outputs:
        - name: results
          type: IPlatformSearchResult[]
      dataMapping:
        source: data.sources[0] # References UserAPI
        query: users
        fields:
          id: user.id
          title: user.name
          description: "user.role + ' - ' + user.department"
          url: "'/users/' + user.id"
          thumbnail: user.avatarUrl
          metadata:
            userId: user.id
            email: user.email
            department: user.department
      lifecycle:
        before:
          - validateQuery:
              handler: validateSearchQuery
        main:
          - executeSearch:
              handler: performUserSearch
        after:
          - enrichResults:
              handler: addUserMetadata

data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
```

**Design Decisions (User-Validated)**:

1. **Capability-Based**: Search is a `capability`, not separate `data` section
2. **Data Reference**: `dataMapping.source` references `data.sources[]` by index/name
3. **Lifecycle Integration**: Uses standard before/main/after/error hooks
4. **Input/Output Types**: Reuse existing DSL type system
5. **Shared Library Reference**: `implements: IPlatformSearchResult` imports from package

**Field Mapping Syntax** (User-Validated):

- ✅ **Direct mapping**: `id: user.id` (property access)
- ✅ **Transformations**: `description: "user.role + ' - ' + user.department"` (string expressions)
- ✅ **Nested resolvers**: `thumbnail: user.avatarUrl` (fetches related data)
- ❌ **Custom functions**: NOT SUPPORTED (slippery slope - avoid complexity)

**Mapping Expression Language**:

- Use JSONPath-like syntax for property access
- String interpolation with `"..."` for transformations
- Nested object literals for metadata
- Future: Template language (Handlebars/Mustache) if needed

**Acceptance Criteria**:

- [ ] DSL parser validates `capabilities[].dataMapping` section
- [ ] Supports `implements: InterfaceName` referencing platform types
- [ ] Validates mapping fields match interface definition
- [ ] Generates TypeScript resolver code from mappings
- [ ] Supports direct mapping, transformations, nested objects
- [ ] Error messages reference DSL line numbers
- [ ] CLI command: `mfe bff:validate` checks mappings

---

### REQ-MESH-CODEGEN-004: Mapping Code Generation

**Status:** 📋 Planned  
**Priority:** High  
**Dependencies:** REQ-MESH-PLATFORM-003, REQ-MESH-TS-001

**Description:**  
Generate TypeScript resolvers from DSL mappings that bridge OpenAPI responses to platform interfaces.

**Generated Code Structure**:

```typescript
// src/platform/search.resolver.ts (GENERATED)
import { IPlatformSearchResult, IPlatformSearchQuery } from '@mfe-platform/types';
import { UserAPI } from './.mesh';

export class UserSearchResolver {
  async search(query: IPlatformSearchQuery): Promise<IPlatformSearchResult[]> {
    // Generated from dataMapping.query
    const users = await UserAPI.Query.users({
      name: query.query,
    });

    // Generated from dataMapping.fields
    return users.map((user) => ({
      id: user.id,
      title: user.name,
      description: `${user.role} - ${user.department}`,
      url: `/users/${user.id}`,
      thumbnail: user.avatarUrl,
      metadata: {
        userId: user.id,
        email: user.email,
        department: user.department,
      },
    }));
  }
}
```

**Code Generation Strategy**:

1. Parse `capabilities[].dataMapping` from DSL
2. Generate resolver class per capability
3. Implement mapping logic from field expressions
4. Add lifecycle hook calls (before/main/after)
5. Include error handling from error hooks
6. Generate unit tests for resolvers

**Generated File Structure** (User-Validated):

```
my-bff-mfe/
├── mfe-manifest.yaml          # DSL (source of truth)
├── mesh.config.ts             # Generated (not git)
├── src/
│   ├── platform/              # Generated platform resolvers
│   │   ├── search.resolver.ts
│   │   ├── task.resolver.ts
│   │   └── notification.resolver.ts
│   ├── generated/             # Generated stubs (as current)
│   │   ├── BaseMFE.ts
│   │   └── capabilities/
│   ├── bff.ts                 # Main server (generated)
│   └── mesh/                  # Mesh artifacts
│       └── .mesh/             # Runtime generated
├── specs/
│   └── user-api.yaml
└── package.json
```

**Acceptance Criteria**:

- [ ] `mfe bff:generate` creates resolver files in `src/platform/`
- [ ] Resolvers implement platform interfaces correctly
- [ ] Field mapping expressions compiled to TypeScript
- [ ] Lifecycle hooks integrated (before/main/after)
- [ ] Generated code passes TypeScript strict mode
- [ ] Unit tests generated for each resolver
- [ ] Resolvers exported and wired to GraphQL schema
- [ ] Command: `mfe bff:generate --watch` for continuous generation

---

### REQ-MESH-DEPS-005: Dependency Matrix Testing

**Status:** 📋 Planned  
**Priority:** Critical  
**Dependencies:** REQ-MESH-TS-001

**Description:**  
Validate GraphQL Mesh dependency compatibility with template package.json to avoid dependency hell.

**Testing Strategy**:

1. **Baseline Testing** (Current State):

   ```json
   {
     "@graphql-mesh/cli": "^0.100.21",
     "@graphql-mesh/openapi": "^0.109.26",
     "@graphql-mesh/serve-runtime": "^1.2.4",
     "graphql": "^16.8.1"
   }
   ```

2. **Migration Testing** (TypeScript Config):

   ```json
   {
     "@graphql-mesh/runtime": "^0.100.x",
     "@graphql-mesh/compose-cli": "^0.5.x",
     "@omnigraph/openapi": "^0.4.x",
     "graphql": "^16.8.1"
   }
   ```

3. **Compatibility Matrix**:
   | Package | Current | Target | Notes |
   |---------|---------|--------|-------|
   | @graphql-mesh/cli | ^0.100.21 | REMOVE | CLI not needed for runtime |
   | @graphql-mesh/runtime | N/A | ^0.100.x | New: Programmatic API |
   | @graphql-mesh/compose-cli | N/A | ^0.5.x | New: Config composition |
   | @omnigraph/openapi | N/A | ^0.4.x | Replaces @graphql-mesh/openapi |
   | graphql | ^16.8.1 | ^16.8.1 | UNCHANGED |
   | @graphql-tools/\* | ^10.2.4 | ^10.2.4 | UNCHANGED |

**Testing Phases**:

1. **Phase 1**: Test current v0 setup (baseline)
2. **Phase 2**: Add runtime package, test alongside CLI
3. **Phase 3**: Swap OpenAPI handler, test compatibility
4. **Phase 4**: Remove CLI, test runtime-only
5. **Phase 5**: Full template test (rspack + Mesh + React)

**Acceptance Criteria**:

- [ ] npm install succeeds without ERESOLVE errors
- [ ] No peer dependency warnings
- [ ] All Mesh packages use compatible GraphQL version
- [ ] rspack build succeeds with new dependencies
- [ ] Generated code compiles with TypeScript
- [ ] Runtime server starts without errors
- [ ] GraphQL queries work end-to-end
- [ ] Document version matrix in `docs/mesh-dependency-matrix.md`

---

### REQ-MESH-WATCH-006: Watch Mode Development

**Status:** 📋 Planned  
**Priority:** Medium  
**Dependencies:** REQ-MESH-TS-001, REQ-MESH-CODEGEN-004

**Description:**  
Continuous regeneration of Mesh config and resolvers during development.

**Watch Workflow (User-Validated)**:

```bash
# Start watch mode
mfe bff:dev --watch

# Internally:
# 1. Watch mfe-manifest.yaml for changes
# 2. On change: DSL → mesh.config.ts + resolvers
# 3. Restart Mesh server
# 4. Log: "✓ Regenerated mesh.config.ts (12:34:56)"
```

**Watch Targets**:

- `mfe-manifest.yaml` (DSL changes)
- `specs/*.yaml` (OpenAPI spec updates)
- `src/platform/*.resolver.ts` (manual resolver edits - warn only)

**Generated File Handling**:

- ✅ Tracked in git (enables PR reviews and debugging)
- ✅ Regenerated by watch mode or explicit `bff:generate`
- ✅ Warning if manually edited: "⚠️ GENERATED FILE - changes will be overwritten"
- ✅ Header includes generation timestamp and source DSL path

**Acceptance Criteria**:

- [ ] `mfe bff:dev --watch` enables continuous regeneration
- [ ] Watches DSL and OpenAPI specs
- [ ] Debounces rapid changes (300ms delay)
- [ ] Logs regeneration events with timestamps
- [ ] Graceful server restart on config change
- [ ] Warns if generated files manually edited
- [ ] Hot reload preserves GraphQL Playground state
- [ ] Error messages shown in terminal + Playground

---

### REQ-MESH-MIGRATE-007: v0 to TypeScript Migration Path

**Status:** 📋 Planned  
**Priority:** Medium  
**Dependencies:** REQ-MESH-TS-001, REQ-MESH-DEPS-005

**Description:**  
Gradual migration from v0 YAML config to TypeScript config with minimal disruption.

**Migration Strategy (User-Validated)**:

- **Approach**: Pre-release product, breaking changes acceptable
- **Analysis First**: Refactor existing patterns, avoid adding slop
- **No Parallel Support**: Single path forward (TypeScript config)
- **Incremental Testing**: Validate dependencies before full migration

**Migration Steps**:

**Phase 1: Analysis (1 day)**

- [ ] Inventory all current BFF template files
- [ ] Document what's working vs. what needs improvement
- [ ] Identify files to refactor vs. replace
- [ ] Create migration checklist

**Phase 2: Dependency Testing (2 days)**

- [ ] Test Mesh runtime package installation
- [ ] Validate @omnigraph/openapi compatibility
- [ ] Test with current rspack + React setup
- [ ] Document dependency matrix

**Phase 3: Code Generation Updates (3 days)**

- [ ] Update `bff:init` to generate `mesh.config.ts`
- [ ] Refactor template processor for TypeScript templates
- [ ] Generate programmatic server.ts
- [ ] Update package.json template dependencies

**Phase 4: Platform Types (2 days)**

- [ ] Create `@mfe-platform/types` package
- [ ] Define initial interfaces (search, task, notification, user)
- [ ] Set up distribution mechanism
- [ ] Document usage patterns

**Phase 5: DSL Mapping Extension (3 days)**

- [ ] Extend DSL parser for `dataMapping` section
- [ ] Validate mapping syntax
- [ ] Generate resolver code from mappings
- [ ] Test with example MFEs

**Phase 6: Integration Testing (2 days)**

- [ ] End-to-end test with generated BFF
- [ ] Verify GraphQL queries work
- [ ] Test watch mode
- [ ] Update documentation

**Total Estimate**: 13 days

**Acceptance Criteria**:

- [ ] All existing BFF tests pass with new implementation
- [ ] Example MFEs work with TypeScript config
- [ ] Documentation updated (READMEs, ADRs)
- [ ] Migration guide created for users
- [ ] No duplicate/conflicting command patterns
- [ ] Clean removal of deprecated v0 code

---

## Non-Requirements (Out of Scope)

### Deferred Features

1. **GraphQL Federation** - Orchestration layer handles composition
2. **Hive Gateway Integration** - Avoiding gateway pattern
3. **Schema Stitching** - Future orchestration consideration
4. **Custom Mesh Plugins** - Use built-in plugins only
5. **Multi-Language Support** - JavaScript/TypeScript only (v1)
6. **GraphQL Subscriptions** - REST-only for now
7. **Mesh v1 Migration** - Staying on v0 with TypeScript config

### Explicitly Rejected

1. ❌ Shell dictates interfaces (orchestration layer owns this)
2. ❌ Custom functions in field mappings (too complex)
3. ❌ Gateway pattern (static composition)
4. ❌ Duplicate type systems (GraphQL extends DSL)
5. ❌ Manual resolver writing (always generated)

---

## Architecture Decisions

### ADR-TBD-1: TypeScript Configuration Instead of YAML

**Context**: GraphQL Mesh v1 uses TypeScript config, but we're on v0 with YAML.

**Decision**: Generate TypeScript `mesh.config.ts` from DSL while staying on Mesh v0 runtime API.

**Rationale**:

- Type safety and IDE support outweigh v1 migration complexity
- Can use v0 programmatic API (`@graphql-mesh/runtime`) with TypeScript config
- Avoids Hive Gateway dependency (aligns with micro-graph architecture)
- Preserves DSL as source of truth (generation, not hand-writing)

**Consequences**:

- ✅ Type-safe configuration
- ✅ No gateway dependency
- ✅ Gradual migration path available
- ⚠️ Custom tooling for v0 + TypeScript (not standard)
- ⚠️ Harder to adopt v1 later (but not a goal)

---

### ADR-TBD-2: Platform Types in Shared Library

**Context**: Need standardized types for cross-cutting concerns across MFEs.

**Decision**: Create `@mfe-platform/types` package for platform interfaces, distributed via npm/Git.

**Rationale**:

- Single source of truth for platform schemas
- Type-safe imports across MFEs
- Versioned semantically (breaking changes controlled)
- Orchestration layer owns definitions (not shell)

**Consequences**:

- ✅ Consistent types across MFEs
- ✅ Centralized schema evolution
- ✅ TypeScript type checking
- ⚠️ Additional package to maintain
- ⚠️ Version sync required across MFEs

---

### ADR-TBD-3: Micro-Graph (No Gateway Pattern)

**Context**: GraphQL Mesh v1 assumes gateway deployment model.

**Decision**: Each BFF is independent micro-graph, orchestration layer composes at runtime.

**Rationale**:

- Aligns with MFE independence principle
- Avoids static build dependencies
- Enables dynamic MFE discovery/composition
- No single point of failure (gateway)

**Consequences**:

- ✅ True MFE autonomy
- ✅ Dynamic composition possible
- ✅ No gateway bottleneck
- ⚠️ Orchestration layer more complex
- ⚠️ Can't leverage federation features (acceptable)

---

## Implementation Plan

### Milestone 1: Foundation (Days 1-3)

**GitHub Issue:** [#67](https://github.com/falese/seans-mfe-tool/issues/67)  
**Goal**: Analyze current implementation, validate dependencies

**Tasks**:

1. Document current BFF template structure
2. Identify refactor opportunities vs. net-new code
3. Test Mesh runtime package installation
4. Validate dependency compatibility matrix
5. Create dependency testing script

**Deliverables**:

- `docs/bff-refactor-analysis.md`
- `docs/mesh-dependency-matrix.md`
- `scripts/test-mesh-dependencies.js`

---

### Milestone 2: TypeScript Config Generation (Days 4-6)

**GitHub Issue:** [#68](https://github.com/falese/seans-mfe-tool/issues/68)  
**Goal**: Generate `mesh.config.ts` from DSL

**Tasks**:

1. Update `bff:generate-config` command
2. Create TypeScript config template
3. Map DSL sources/transforms/plugins to TypeScript API
4. Add validation before generation
5. Write unit tests

**Deliverables**:

- `src/commands/bff-generate-config.ts`
- `src/codegen/templates/bff/mesh.config.ts.ejs`
- Tests: `src/commands/__tests__/bff-generate-config.test.ts`

---

### Milestone 3: Platform Types Library (Days 7-8)

**GitHub Issue:** [#69](https://github.com/falese/seans-mfe-tool/issues/69)  
**Goal**: Create shared type package

**Tasks**:

1. Initialize `@mfe-platform/types` package
2. Define initial interfaces (search, task, notification, user)
3. Set up TypeScript build
4. Add JSDoc documentation
5. Publish to local registry/Git

**Deliverables**:

- `packages/platform-types/` (or separate repo)
- Published package: `@mfe-platform/types@1.0.0`

---

### Milestone 4: DSL Mapping Extension (Days 9-11)

**GitHub Issue:** [#70](https://github.com/falese/seans-mfe-tool/issues/70)  
**Goal**: Support `capabilities[].dataMapping` in DSL

**Tasks**:

1. Extend DSL parser for mapping syntax
2. Validate mapping fields against platform interfaces
3. Generate resolver code from mappings
4. Integrate lifecycle hooks in resolvers
5. Write mapping tests

**Deliverables**:

- `src/dsl/schema.ts` updates
- `src/codegen/ResolverGenerator.ts`
- Tests: `src/codegen/__tests__/ResolverGenerator.test.ts`

---

### Milestone 5: Watch Mode Integration (Days 12-13)

**GitHub Issue:** [#71](https://github.com/falese/seans-mfe-tool/issues/71)  
**Goal**: Continuous regeneration during development

**Tasks**:

1. Add file watching to `bff:dev`
2. Implement debounced regeneration
3. Graceful server restart on config change
4. Error handling and logging
5. Test with example MFEs

**Deliverables**:

- Updated `src/commands/bff.ts` with watch mode
- `examples/user-dashboard-bff/` (new example)

---

### Milestone 6: Integration & Documentation (Days 14-15)

**GitHub Issue:** [#72](https://github.com/falese/seans-mfe-tool/issues/72)  
**Goal**: End-to-end testing and documentation

**Tasks**:

1. Create full example MFE with platform mapping
2. End-to-end test: DSL → config → resolvers → GraphQL
3. Update all documentation (README, ADRs, requirements)
4. Create migration guide
5. Record demo video

**Deliverables**:

- `examples/platform-search-mfe/`
- `docs/mesh-typescript-guide.md`
- Updated `README.md`
- ADRs for architecture decisions

---

## Testing Strategy

### Unit Tests

**Coverage Target**: 100% (new code), 80% (refactored code)

**Test Files**:

- `src/commands/__tests__/bff-generate-config.test.ts`
- `src/codegen/__tests__/ResolverGenerator.test.ts`
- `src/dsl/__tests__/mapping-parser.test.ts`

**Key Scenarios**:

- Valid DSL → TypeScript config generation
- Invalid mapping → validation error
- Platform interface mismatch → clear error message
- Watch mode file changes → regeneration triggered
- Dependency conflicts → fail with guidance

---

### Integration Tests

**Test Environments**:

1. **Local Development**: Generated BFF with watch mode
2. **CI Pipeline**: npm install + build + test
3. **Example MFEs**: End-to-end scenario tests

**Test Cases**:

- Generate BFF with platform search mapping
- Query GraphQL endpoint, verify platform type structure
- Update DSL, verify auto-regeneration
- Add new platform type, verify import works

---

### Dependency Testing

**Matrix Tests**:

```bash
# Test script
npm run test:dependencies -- \
  --mesh-runtime 0.100.21 \
  --omnigraph-openapi 0.4.0 \
  --graphql 16.8.1
```

**Validation**:

- No ERESOLVE errors
- No peer dependency warnings
- TypeScript compiles without errors
- Runtime starts successfully

---

## Risk Management

### Risk 1: Dependency Hell

**Likelihood**: High  
**Impact**: Critical  
**Mitigation**:

- Incremental testing per Milestone 1
- Document compatible versions in matrix
- Use exact versions (not `^`) for Mesh packages
- Test with multiple Node versions

### Risk 2: Mesh API Breaking Changes

**Likelihood**: Medium  
**Impact**: High  
**Mitigation**:

- Pin Mesh packages to tested versions
- Monitor Guild changelog for breaking changes
- Have rollback plan to YAML config

### Risk 3: Platform Type Versioning

**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**:

- Semantic versioning for types package
- Document breaking changes clearly
- Provide migration scripts for major versions

### Risk 4: Code Generation Complexity

**Likelihood**: Medium  
**Impact**: Medium  
**Mitigation**:

- Start with simple mapping expressions
- Avoid custom functions (validated constraint)
- Comprehensive error messages with DSL line numbers
- Extensive unit tests for generator

---

## Success Criteria

### Quantitative Metrics

- [ ] **100% Type Safety**: All generated code passes TypeScript strict mode
- [ ] **Zero Dependency Errors**: npm install succeeds across all templates
- [ ] **< 500ms Regeneration**: Watch mode regenerates config in under 500ms
- [ ] **100% Test Coverage**: New code has complete unit test coverage
- [ ] **4 Platform Types**: Search, task, notification, user implemented

### Qualitative Metrics

- [ ] **Developer Experience**: Watch mode feels responsive and reliable
- [ ] **Error Messages**: Clear, actionable errors with DSL context
- [ ] **Documentation**: Complete examples and migration guides
- [ ] **Maintainability**: Code is understandable, well-commented
- [ ] **Architectural Alignment**: Fits micro-graph + orchestration vision

---

## Open Questions

1. **Platform Types Distribution**: npm private registry vs. Git package vs. monorepo?

   - **Decision Pending**: Evaluate setup complexity vs. versioning control

2. **Mapping Expression Language**: JSONPath, JavaScript expressions, or template language?

   - **Current**: String interpolation for simple cases, decide on complex scenarios

3. **Mesh v1 Transition**: When (if ever) migrate to Mesh v1 + Hive Gateway?

   - **Current**: No near-term plans, micro-graph architecture doesn't align

4. **GraphQL Federation**: How will orchestration layer compose micro-graphs?
   - **Deferred**: Future orchestration design session

---

## Related Documentation

- **Current Implementation**: `docs/requirements/graphql-bff-requirements.md`
- **Mesh Research**: `MESH-PLUGINS-RESEARCH.md`, `MESHRC-DIAGNOSIS.md`
- **DSL Contract**: `docs/DSL/dsl.yaml`
- **Runtime Requirements**: `docs/runtime-requirements.md`
- **ADR-046**: GraphQL Mesh with DSL-embedded configuration

---

## Approval & Sign-off

**Requirements Session Date**: 2025-12-13  
**Elicitation Agent**: GitHub Copilot (Requirements Mode)  
**User Validation**: Complete ✅

**Next Steps**:

1. Create ADRs for architecture decisions (ADR-TBD-1, 2, 3)
2. Create GitHub Issues for each milestone
3. Begin Milestone 1: Foundation & Analysis
4. Schedule weekly checkpoint to review progress

---

_This document will be updated as implementation progresses and new insights emerge._
