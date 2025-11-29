# MFE DSL Schema Reference

**Version:** 3.2  
**Status:** Canonical Reference  
**Updated:** 2025-11-27  
**Related Docs:**

- [DSL Contract Requirements](./dsl-contract-requirements.md) - Runtime semantics
- [DSL Remote Requirements](./dsl-remote-requirements.md) - Code generation workflow
- [GraphQL BFF Requirements](./graphql-bff-requirements.md) - Data layer generation
- [Example DSL](./dsl.yaml) - Complete working example

---

## Overview

The MFE DSL (Domain Specific Language) is the **single source of truth** for micro-frontend configuration. It describes:

1. **What the MFE is** - Identity, capabilities, dependencies
2. **What it provides** - Exposed capabilities for consumers
3. **What data it needs** - GraphQL/REST data sources
4. **How it behaves** - Lifecycle hooks, authorization

The DSL is **implementation-agnostic**. The CLI reads DSL and generates implementation-specific artifacts (rspack config, RTK Query hooks, Module Federation config, etc.).

---

## Schema Structure

```yaml
# Required sections
name: string # MFE identifier
version: string # Semantic version
type: enum # MFE type
language: enum # Implementation language

# Optional identity
description: string # Human-readable description
owner: string # Team/owner identifier
tags: string[] # Searchable tags
category: string # Categorization

# Required for runtime
endpoint: url # Base URL
remoteEntry: url # Module Federation entry
discovery: url # DSL manifest endpoint

# Core sections
capabilities: Capability[] # What this MFE provides
data: DataConfig # GraphQL/REST data layer
dependencies: Dependencies # Shared deps and MFE deps

# Future sections (deferred)
authorization: AuthConfig # Access control rules
```

---

## Section Reference

### Core Identity (Required)

| Field         | Type       | Required | Description                                                               |
| ------------- | ---------- | -------- | ------------------------------------------------------------------------- |
| `name`        | `string`   | ✅       | Unique MFE identifier (kebab-case)                                        |
| `version`     | `string`   | ✅       | Semantic version (e.g., `1.0.0`)                                          |
| `type`        | `enum`     | ✅       | MFE type: `tool`, `agent`, `feature`, `service`, `remote`, `shell`, `bff` |
| `language`    | `enum`     | ✅       | V1: `javascript`, `typescript` only                                       |
| `description` | `string`   | ❌       | Human-readable description                                                |
| `owner`       | `string`   | ❌       | Team/owner identifier for attribution                                     |
| `tags`        | `string[]` | ❌       | Custom tags for search/filtering                                          |
| `category`    | `string`   | ❌       | Categorization for grouping                                               |

**Example:**

```yaml
name: user-dashboard
version: 1.0.0
type: remote
language: typescript
description: User profile and settings management
owner: user-team
tags: [user-management, settings, profile]
category: user-experience
```

---

### Endpoints (Required for Runtime)

| Field         | Type  | Required | Description                                             |
| ------------- | ----- | -------- | ------------------------------------------------------- |
| `endpoint`    | `url` | ✅       | Base URL for MFE                                        |
| `remoteEntry` | `url` | ✅       | Module Federation remote entry                          |
| `discovery`   | `url` | ✅       | DSL manifest endpoint (`.well-known/mfe-manifest.yaml`) |

**Example:**

```yaml
endpoint: http://localhost:3001
remoteEntry: http://localhost:3001/remoteEntry.js
discovery: http://localhost:3001/.well-known/mfe-manifest.yaml
```

**Note:** For code generation (`remote:init`), these are generated from the `name`. For runtime, they must be accurate URLs.

---

### Capabilities Section

Capabilities describe **what the MFE provides** to consumers. Each capability becomes an exposed function in `remote.tsx`.

#### Capability Types

| Type       | Description                                                                |
| ---------- | -------------------------------------------------------------------------- |
| `platform` | Standard capabilities all MFEs must implement (load, render, health, etc.) |
| `domain`   | Custom capabilities specific to this MFE's business logic                  |

#### Capability Schema

```yaml
capabilities:
  - name: # Capability name (PascalCase)
      type: platform|domain # Capability type
      description: string # Human-readable description
      handler: string # Handler function name
      inputs: Input[] # Input parameters
      outputs: Output[] # Return values
      lifecycle: Lifecycle # Hook definitions
      authorization: string # Auth expression (deferred)
```

#### Platform Capabilities (Required)

All MFEs must implement these platform capabilities:

| Capability        | Purpose                      |
| ----------------- | ---------------------------- |
| `load`            | Initialize MFE runtime       |
| `render`          | Display UI or return data    |
| `refresh`         | Reload/update state          |
| `authorizeAccess` | Validate JWT and permissions |
| `health`          | Report operational status    |
| `describe`        | Return DSL manifest          |
| `schema`          | GraphQL schema introspection |
| `query`           | Execute GraphQL queries      |
| `emit`            | Telemetry and event emission |

#### Domain Capabilities (Custom)

Domain capabilities are specific to your MFE. They become exposed functions in `remote.tsx`.

**Example:**

```yaml
capabilities:
  # Domain capabilities - each becomes an exposed function
  - UserProfile:
      type: domain
      description: View and manage user profile

  - SettingsPanel:
      type: domain
      description: User settings and preferences

  - NotificationCenter:
      type: domain
      description: View and manage notifications
```

**Generated Output:**

```typescript
// remote.tsx - Generated from capabilities
export const UserProfile = React.lazy(() => import('./features/UserProfile'));

export const SettingsPanel = React.lazy(() => import('./features/SettingsPanel'));

export const NotificationCenter = React.lazy(() => import('./features/NotificationCenter'));
```

---

### Lifecycle Hooks

Lifecycle hooks define behavior at different phases of capability execution.

#### Phases

| Phase    | Purpose                               | Failure Behavior                  |
| -------- | ------------------------------------- | --------------------------------- |
| `before` | Pre-execution validation, setup       | Silent (logged, continues)        |
| `main`   | Core capability logic                 | **Propagates** (capability fails) |
| `after`  | Post-execution cleanup, notifications | Silent (logged, continues)        |
| `error`  | Error handling, recovery              | Silent (logged, continues)        |

**Note:** Only `main` phase failures propagate to the caller. All other phases fail silently with telemetry.

#### Hook Schema

```yaml
lifecycle:
  before:
    - hookName:
        handler: string | string[] # Single or multiple handlers
        description: string
        mandatory: boolean # Execute even if previous hooks failed
        contained: boolean # Wrap in try-catch
  main:
    - hookName:
        handler: string | string[]
        description: string
  after:
    - hookName:
        handler: string | string[]
        description: string
  error:
    - hookName:
        handler: string | string[]
        description: string
        mandatory: boolean
        contained: boolean
```

#### Handler Arrays

Handlers can be a single function or array:

```yaml
# Single handler
handler: validateFile

# Multiple handlers (executed sequentially)
handler: [validateFile, checkSize, scanForMalware]
```

**Execution Semantics:**

- `main` phase: AND semantics - first failure stops execution
- Other phases: OR-like - all run, failures logged but don't stop

---


### Lifecycle Hook Handler Validation

**Handler Reference Constraints:**

- Handler names in lifecycle hooks (`handler:`) must NOT reference platform wrapper methods.
- Forbidden handler names:  
  `doLoad`, `doRender`, `doRefresh`, `doAuthorizeAccess`, `doHealth`, `doDescribe`, `doSchema`, `doQuery`, `doEmit`
- Only user-defined handler names are allowed.
- Violations will be rejected at schema validation (see `LifecycleHookSchema` in code).

**Example:**

```yaml
# Valid
lifecycle:
  main:
    - doQuery:
        handler: customQueryHandler

# Invalid (will be rejected)
lifecycle:
  main:
    - doQuery:
        handler: doQuery # ❌ Forbidden: platform wrapper
```

**Enforcement:**  
This rule is enforced by the DSL Zod schema. Any manifest referencing a forbidden handler will fail validation and be rejected by the CLI and runtime.

---

### Custom Handler Resolution and Developer Extension

Custom handlers referenced in the manifest (e.g., `custom.myHandler`) are resolved at runtime as follows:

1. **Handler Object Lookup:**
   - The runtime first looks for the full handler name (e.g., `custom.myHandler`) in the MFE's handler registry object.
   - If not found, it falls back to the last segment (e.g., `myHandler`).
2. **Class Method Invocation:**
   - If the handler is not found in the registry, the runtime attempts to invoke a method with the same name on the MFE class.
   - This allows codegen to generate stub methods for each custom handler referenced in the manifest.
3. **Developer Extension:**
   - Developers extend the generated MFE class and implement the logic for each custom handler method.

**Example Manifest:**

```yaml
capabilities:
  - query:
      type: domain
      lifecycle:
        main:
          - doQuery:
              handler: custom.fail
        error:
          - onError:
              handler: custom.noop
```

**Example Generated Class Stub:**

```typescript
class MyMFE extends BaseMFE {
  async fail(context: any) {
    // Developer implements custom logic here
    throw new Error('boom');
  }
  // ... other generated stubs ...
}
```

**Best Practice:**
- Codegen should generate both the manifest and stub methods for all custom handlers referenced.
- Developers fill in the logic for each handler method as needed.

---

### Data Section (BFF Configuration)

The `data:` section defines the GraphQL BFF layer. It IS the GraphQL Mesh configuration (ADR-046).

#### Data Schema

```yaml
data:
  sources: Source[] # OpenAPI specs to expose as GraphQL
  transforms: Transform[] # Schema shaping (optional)
  plugins: Plugin[] # Production concerns (optional)
  serve: ServeConfig # Server configuration
  generatedFrom: Lineage[] # Data lineage tracking
```

#### Sources

Each source is an OpenAPI spec exposed as GraphQL:

```yaml
data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
          operationHeaders:
            Authorization: 'Bearer {context.jwt}'
            X-Request-ID: '{context.requestId}'

    - name: OrderAPI
      handler:
        openapi:
          source: https://orders.internal/swagger.json
```

#### Transforms

Shape the unified GraphQL schema:

```yaml
data:
  transforms:
    # Remove internal endpoints
    - filterSchema:
        filters:
          - Query.!internal*
          - Mutation.!admin*

    # Namespace to avoid conflicts
    - prefix:
        value: User_
        includeRootOperations: true

    # Fix naming
    - rename:
        renames:
          - from: { type: Query, field: API_GetUser }
            to: { type: Query, field: getUser }
```

#### Plugins

Production concerns:

```yaml
data:
  plugins:
    - responseCache:
        ttl: 60000
        invalidateViaMutation: true

    - rateLimit:
        config:
          - type: Query
            field: '*'
            max: 100
            window: '1m'
```

#### GeneratedFrom (Lineage)

Track data sources for dependency analysis:

```yaml
data:
  generatedFrom:
    - openapi: ./specs/user-api.yaml
      service: user-service
      version: 2.1.0
```

---

### Dependencies Section

#### Schema

```yaml
dependencies:
  runtime: # npm packages for Module Federation shared
    react: ^18.0.0
    react-dom: ^18.0.0

  design-system: # Design system dependencies
    '@mui/material': ^5.14.0

  mfes: # Other MFE dependencies (future)
    user-service: '>=1.0.0'
```

#### Runtime Dependencies

Maps to Module Federation `shared` config:

```yaml
dependencies:
  runtime:
    react: ^18.0.0
    react-dom: ^18.0.0
```

**Generated:**

```javascript
// rspack.config.js
shared: {
  react: { singleton: true, requiredVersion: '^18.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
}
```

---

### Type System

DSL uses a unified type system that maps to GraphQL and TypeScript/Python.

#### Primitive Types

| DSL Type   | GraphQL    | TypeScript                | Python            |
| ---------- | ---------- | ------------------------- | ----------------- |
| `string`   | `String`   | `string \| null`          | `Optional[str]`   |
| `string!`  | `String!`  | `string`                  | `str`             |
| `number`   | `Float`    | `number \| null`          | `Optional[float]` |
| `number!`  | `Float!`   | `number`                  | `float`           |
| `boolean`  | `Boolean`  | `boolean \| null`         | `Optional[bool]`  |
| `boolean!` | `Boolean!` | `boolean`                 | `bool`            |
| `object`   | `JSON`     | `Record<string, unknown>` | `Dict[str, Any]`  |

#### Nullability

**GraphQL convention:** Types are nullable by default. Use `!` for required.

```yaml
inputs:
  - name: userId
    type: string! # Required (non-null)
  - name: filter
    type: object # Optional (nullable)
```

#### Specialized Types

| Type       | Extends  | Purpose                         |
| ---------- | -------- | ------------------------------- |
| `jwt`      | `string` | JWT token with validation       |
| `datetime` | `string` | ISO 8601 datetime               |
| `email`    | `string` | RFC 5322 email format           |
| `url`      | `string` | Valid URL with protocol         |
| `id`       | `string` | Non-empty identifier            |
| `file`     | `object` | File reference with format/size |
| `element`  | `object` | DOM element reference           |

#### Enums

```yaml
inputs:
  - name: severity
    type: enum
    values: [debug, info, warn, error, fatal]
    default: info
```

#### Arrays

```yaml
outputs:
  - name: users
    type: array<User!>! # Non-null array of non-null Users
```

---

## Code Generation Flow

### From DSL to Implementation

```
mfe-manifest.yaml (DSL)
    │
    ├── capabilities[] ────────→ src/remote.tsx (exports)
    │                           src/features/{Name}/ (scaffolds)
    │
    ├── dependencies{} ────────→ rspack.config.js (shared)
    │                           package.json (deps)
    │
    ├── data.sources[] ────────→ .meshrc.yaml (Mesh config)
    │                           src/platform/api.ts (RTK Query)
    │
    └── type definitions ──────→ src/platform/types.ts
```

### CLI Commands

| Command                  | Input               | Output                   |
| ------------------------ | ------------------- | ------------------------ |
| `mfe remote:init <name>` | name                | DSL scaffold             |
| `mfe remote:generate`    | DSL                 | All implementation files |
| `mfe remote:validate`    | DSL                 | Validation result        |
| `mfe bff:build`          | DSL `data:` section | `.meshrc.yaml`, `.mesh/` |
| `mfe bff:dev`            | DSL `data:` section | Running dev server       |

---

## Validation Rules

### Required Fields

```yaml
# These fields are REQUIRED
name: string # Must be kebab-case
version: string # Must be semver
type: enum # Must be valid type
language: enum # Must be javascript|typescript (V1)
```

### Capability Validation

- Each capability must have a `name`
- Platform capabilities have required structure
- Domain capabilities need at minimum: `name`, `description`
- Handler names must be valid identifiers

### Data Source Validation

- Each source must have `name` and `handler.openapi.source`
- Source files must exist (local) or be valid URLs (remote)

---

## Migration Guide

### From CLI Options to DSL

**Before (deprecated):**

```bash
mfe remote my-app --port 3001 --mui-version 5.14.0
```

**After:**

```bash
mfe remote:init my-app
# Edit mfe-manifest.yaml
mfe remote:generate
```

### DSL Changes

| Old                  | New                  | Notes                                 |
| -------------------- | -------------------- | ------------------------------------- |
| `--port` flag        | Not in DSL           | Use `.env` or CLI flag                |
| `--remotes` flag     | Not applicable       | Remotes don't consume other remotes   |
| `lifecycle.custom:`  | Removed              | Use standard phases with custom hooks |
| `lifecycle.loading:` | Removed              | Use handlers in `main` phase          |
| `handler: wrapped`   | `handler: contained` | Renamed for clarity                   |

---

## Examples

### Minimal Remote DSL

```yaml
name: my-feature
version: 1.0.0
type: remote
language: typescript

capabilities:
  - MyFeature:
      type: domain
      description: My feature component
```

### Full Remote DSL

See [docs/dsl.yaml](./dsl.yaml) for complete example.

### BFF-Only DSL

```yaml
name: api-gateway
version: 1.0.0
type: bff
language: typescript

data:
  sources:
    - name: UsersAPI
      handler:
        openapi:
          source: ./specs/users.yaml
    - name: OrdersAPI
      handler:
        openapi:
          source: ./specs/orders.yaml
  serve:
    endpoint: /graphql
    playground: true
```

---

## Version History

| Version | Date       | Changes                                                             |
| ------- | ---------- | ------------------------------------------------------------------- |
| 3.0     | 2025-11-26 | Initial DSL contract (Session 6)                                    |
| 3.1     | 2025-11-27 | Added `data:` section as Mesh config (ADR-046)                      |
| 3.2     | 2025-11-27 | Added `capabilities:` for code generation, unified schema reference |

---

## Related Documents

- **[dsl-contract-requirements.md](./dsl-contract-requirements.md)** - Runtime execution semantics
- **[dsl-remote-requirements.md](./dsl-remote-requirements.md)** - Code generation workflow
- **[graphql-bff-requirements.md](./graphql-bff-requirements.md)** - Data layer generation
- **[architecture-decisions.md](./architecture-decisions.md)** - ADRs for all decisions
