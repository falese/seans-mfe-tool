# DSL-First Remote Generation - Requirements Document

**Document Status:** 📋 Requirements Complete  
**Created:** 2025-11-27  
**Parent Feature:** MFE Orchestration System  
**Related Docs:**

## Executive Summary

**Status:** ✅ Complete
**Last Updated:** 2025-11-29
**Owner:** Sean
**Feature:** DSL-First Remote Generation

- ADRs: docs/architecture-decisions.md (ADR-047, ADR-048)
- Issues: #51, #53, #55
- Acceptance Criteria: docs/acceptance-criteria/remote-mfe.feature

Refactor `mfe remote` to use DSL (`mfe-manifest.yaml`) as the single source of truth. The DSL describes **what** the MFE does (capabilities), and the CLI generates **how** it's implemented (rspack config, RTK Query hooks, file structure).
All major requirements (REQ-REMOTE-001 to REQ-REMOTE-010) are **✅ Complete** and implemented.

- Marker-aware regeneration, multiple bundler support, interactive capability wizard are deferred. See deferred-backlog.md for tracking.

---

## Decisions Summary

| Decision            | Choice                                         | Rationale                        |
| ------------------- | ---------------------------------------------- | -------------------------------- |
| Workflow            | Two-step: `init` → edit DSL → `generate`       | Supports re-entrant builds       |
| Backwards Compat    | Deprecate current approach                     | Clean break to DSL-first         |
| Generation Strategy | Hybrid (extract for config, scaffold for code) | Separates generated vs user code |
| DSL Content         | Capabilities + data sources only               | No implementation details        |
| Entry Points        | Not in DSL                                     | Generated from capability names  |
| Handlers            | Auto-generate RTK Query from data sources      | Consistent with GraphQL BFF      |
| Bundler Selection   | Deferred                                       | Future feature (rspack default)  |
| Dev Server Port     | Not in DSL                                     | External config (.env, CLI flag) |
| Platform Code       | Separate directory with markers                | Clear generated vs user code     |

---

## Requirements

### REQ-REMOTE-001: DSL Schema

**Must:**

- DSL describes capabilities (what MFE provides) without implementation details
- No file paths, entry points, or bundler config in DSL
- Support `capabilities[]` for exposed functions
- Support `dependencies` for runtime requirements
- Integrate with existing `data:` section (BFF config)

**DSL Schema:**

```yaml
# mfe-manifest.yaml
name: user-dashboard
version: 1.0.0
type: remote
language: typescript

# Capabilities - WHAT this MFE provides
# Each capability becomes an exposed function in remote.tsx
capabilities:
  - name: UserProfile
    description: 'View and manage user profile'

  - name: SettingsPanel
    description: 'User settings and preferences'

  - name: NotificationCenter
    description: 'View and manage notifications'

# Runtime dependencies for shared config
dependencies:
  runtime:
    react: ^18.0.0
    react-dom: ^18.0.0
  design-system:
    '@mui/material': ^5.14.0

# Data layer - GraphQL BFF (REQ-BFF-001)
# Auto-generates RTK Query hooks
data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
```

---

### REQ-REMOTE-002: Two-Step Workflow

**Must:**

- `mfe remote:init <name>` creates minimal DSL scaffold
- `mfe remote:generate` reads DSL and generates all files
- Support re-entrant generation (run multiple times safely)
- Preserve user code between generations

**Workflow:**

```bash
# Step 1: Initialize project with DSL scaffold
mfe remote:init my-dashboard
# Creates:
#   my-dashboard/
#   ├── mfe-manifest.yaml (scaffold)
#   └── specs/.gitkeep

# Step 2: User edits DSL
vim my-dashboard/mfe-manifest.yaml
# Add capabilities, data sources, dependencies

# Step 3: Generate implementation
cd my-dashboard
mfe remote:generate
# Generates all files from DSL

# Step 4 (re-entrant): Update DSL and regenerate
vim mfe-manifest.yaml  # Add new capability
mfe remote:generate    # Safe to run again
```

---

### REQ-REMOTE-003: File Generation from Capabilities

**Must:**

- Each capability generates a feature directory
- Feature directories contain lazy-load wrapper (generated) and implementation scaffold (user edits)
- `remote.tsx` exports all capabilities with lazy loading
- No app code in `remote.tsx` - only dynamic imports

**Generated Structure:**

```
src/
├── remote.tsx                    # GENERATED - exports capabilities
├── App.tsx                       # GENERATED scaffold - user edits
├── platform/                     # GENERATED with markers
│   ├── api.ts                    # RTK Query API (from data.sources)
│   ├── hooks.ts                  # Re-exports
│   └── store.ts                  # Redux store
├── features/                     # GENERATED scaffolds
│   ├── UserProfile/
│   │   ├── index.tsx             # GENERATED - lazy wrapper
│   │   └── UserProfile.tsx       # USER CODE - implementation
│   ├── SettingsPanel/
│   │   ├── index.tsx             # GENERATED
│   │   └── SettingsPanel.tsx     # USER CODE
│   └── NotificationCenter/
│       ├── index.tsx             # GENERATED
│       └── NotificationCenter.tsx # USER CODE
└── components/                   # USER CODE
```

**Generated `remote.tsx`:**

```typescript
// ============================================
// GENERATED - Remote capability exports
// Regenerate with: mfe remote:generate
export const UserProfile = React.lazy(() =>
  import('./features/UserProfile').then((m) => ({ default: m.UserProfile }))
);

export const SettingsPanel = React.lazy(() =>
  import('./features/SettingsPanel').then((m) => ({ default: m.SettingsPanel }))
);

export const NotificationCenter = React.lazy(() =>
  import('./features/NotificationCenter').then((m) => ({ default: m.NotificationCenter }))
);

// Manifest for orchestrator discovery
export const manifest = {
  name: 'user-dashboard',
  version: '1.0.0',
  capabilities: [
    { name: 'UserProfile', description: 'View and manage user profile' },
    { name: 'SettingsPanel', description: 'User settings and preferences' },
    { name: 'NotificationCenter', description: 'View and manage notifications' },
  ],
};
```

**Generated `features/{Name}/index.tsx`:**

```typescript
// ============================================
// GENERATED SCAFFOLD - Edit {Name}.tsx instead
// Capability: {Name}
// ============================================

import React, { lazy, Suspense } from 'react';

const {Name}Impl = lazy(() => import('./{Name}'));

export const {Name}: React.FC = (props) => (
  <Suspense fallback={<div>Loading...</div>}>
    <{Name}Impl {...props} />
  </Suspense>



export default {Name};


**Generated `features/{Name}/{Name}.tsx` (user scaffold):**


// ============================================

// Description: {description}
//
// Available hooks from platform:
//   import { useGetUserQuery } from '../../platform/api';
// ============================================

import React from 'react';
import { Box, Typography } from '@mui/material';

export const {Name}: React.FC = () => {
  // TODO: Implement {Name}

  return (
    <Box>
      <Typography variant="h4">{Name}</Typography>
      <Typography>Implement your feature here</Typography>
    </Box>
  );
};

export default {Name};
```

---

### REQ-REMOTE-004: RTK Query Generation from Data Sources

**Must:**

- Parse OpenAPI specs from `data.sources[]`
- Generate RTK Query API slices with GraphQL queries
- Auto-generate typed hooks for each operation
- Generate Redux store configuration

**From DSL:**

```yaml
data:
  sources:
    - name: UserAPI
      handler:
        openapi:
          source: ./specs/user-api.yaml
```

**Generated `platform/api.ts`:**

```typescript
// ============================================
// GENERATED BY mfe remote:generate
// Source: data.sources[UserAPI] → ./specs/user-api.yaml
// DO NOT EDIT - Regenerate with: mfe remote:generate
// ============================================

import { createApi } from '@reduxjs/toolkit/query/react';
import { graphqlRequestBaseQuery } from '@rtk-query/graphql-request-base-query';

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: graphqlRequestBaseQuery({
    url: '/graphql',
  }),
  endpoints: (builder) => ({
    getUser: builder.query<User, string>({
      query: (id) => ({
        document: `
          query GetUser($id: ID!) {
            UserAPI_getUser(id: $id) {
              id
              name
              email
            }
          }
        `,
        variables: { id },
      }),
    }),

    updateUser: builder.mutation<User, UpdateUserInput>({
      query: (data) => ({
        document: `
          mutation UpdateUser($input: UserInput!) {
            UserAPI_updateUser(input: $input) {
              id
              name
            }
          }
        `,
        variables: { input: data },
      }),
    }),
  }),
});

export const { useGetUserQuery, useLazyGetUserQuery, useUpdateUserMutation } = userApi;
```

**Generated `platform/store.ts`:**

```typescript
// ============================================
// GENERATED - Redux store with RTK Query
// DO NOT EDIT - Regenerate with: mfe remote:generate
// ============================================

import { configureStore } from '@reduxjs/toolkit';
import { userApi } from './api';

export const store = configureStore({
  reducer: {
    [userApi.reducerPath]: userApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(userApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

---

### REQ-REMOTE-005: Config Extraction (Not Templates)

**Must:**

- Extract DSL to implementation-specific config files
- Use extraction pattern (like BFF/Mesh), not EJS templates for config
- Support future bundler targets (webpack, vite) via extraction layer

**Extraction Flow:**

```
DSL (mfe-manifest.yaml)
    │
    ├── capabilities[] ──→ extractModuleFederation() ──→ rspack.config.js
    │                                                    (or webpack.config.js)
    │
    ├── dependencies{} ──→ extractDependencies() ──→ package.json
    │
    └── data.sources[] ──→ extractDataLayer() ──→ platform/api.ts
                                                   (RTK Query)
```

**Generated `rspack.config.js` (from extraction):**

```javascript
// Generated by: mfe remote:generate
// Source: mfe-manifest.yaml capabilities[]

const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');

module.exports = {
  // ... base config

  plugins: [
    new ModuleFederationPlugin({
      name: 'userDashboard',
      filename: 'remoteEntry.js',
      exposes: {
        './remote': './src/remote.tsx',
        './UserProfile': './src/features/UserProfile',
        './SettingsPanel': './src/features/SettingsPanel',
        './NotificationCenter': './src/features/NotificationCenter',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        '@mui/material': { singleton: true, requiredVersion: '^5.14.0' },
        '@reduxjs/toolkit': { singleton: true },
        'react-redux': { singleton: true },
      },
    }),
  ],
};
```

---

### REQ-REMOTE-006: Re-generation Behavior

**Must:**

- Support running `mfe remote:generate` multiple times safely
- Preserve user code in feature implementation files
- Overwrite generated files (remote.tsx, platform/\*, config)
- Merge package.json (update deps, preserve scripts)

**Re-generation Rules:**

| File                         | Behavior           | Reason                             |
| ---------------------------- | ------------------ | ---------------------------------- |
| `remote.tsx`                 | **Overwrite**      | Fully generated from capabilities  |
| `platform/api.ts`            | **Overwrite**      | Fully generated from data sources  |
| `platform/store.ts`          | **Overwrite**      | Fully generated                    |
| `platform/hooks.ts`          | **Overwrite**      | Fully generated                    |
| `features/{Name}/index.tsx`  | **Overwrite**      | Lazy wrapper, no user code         |
| `features/{Name}/{Name}.tsx` | **Skip if exists** | User implementation                |
| `rspack.config.js`           | **Overwrite**      | Extracted from DSL                 |
| `package.json`               | **Merge**          | Preserve user scripts, update deps |
| `App.tsx`                    | **Skip if exists** | User code                          |

---

### REQ-REMOTE-007: Capability Addition

**Must:**

- Detect new capabilities in DSL
- Prompt user if feature directory already exists
- Create scaffold only for new capabilities

**Behavior:**

```bash
# User adds new capability to DSL
capabilities:
  - name: UserProfile      # Existing
  - name: SettingsPanel    # Existing
  - name: Analytics        # NEW

# Run generate
mfe remote:generate

# Output:
# ✓ Skipping UserProfile (exists)
# ✓ Skipping SettingsPanel (exists)
# ? Analytics directory exists. Overwrite scaffold? (y/N)
#   [y] Overwrite features/Analytics/Analytics.tsx
#   [N] Keep existing files, update remote.tsx only
```

---

### REQ-REMOTE-008: Capability Removal

**Must:**

- Detect removed capabilities from DSL
- Remove from `remote.tsx` exports
- Preserve user files (do not delete feature directories)
- Warn user about orphaned directories

**Behavior:**

```bash
# User removes capability from DSL
capabilities:
  - name: UserProfile
  # - name: SettingsPanel  # REMOVED

# Run generate
mfe remote:generate

# Output:
# ✓ Updated remote.tsx
# ⚠ Warning: features/SettingsPanel/ is no longer in DSL
#   Files preserved. Delete manually if not needed.
```

---

### REQ-REMOTE-009: CLI Command Structure

**Must:**

- Deprecate current `mfe remote <name>` approach
- Add `mfe remote:init <name>` for scaffold creation
- Add `mfe remote:generate` for DSL-driven generation
- Add `mfe remote:validate` for DSL validation

**Commands:**

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `mfe remote:init <name>` | Create new remote with DSL scaffold      |
| `mfe remote:generate`    | Generate files from DSL (re-entrant)     |
| `mfe remote:validate`    | Validate DSL without generating          |
| `mfe remote <name>`      | **DEPRECATED** - shows migration message |

**Deprecation Message:**

```bash
$ mfe remote my-app

⚠ DEPRECATED: 'mfe remote <name>' is deprecated.

Use the new DSL-first workflow:
  1. mfe remote:init my-app    # Create DSL scaffold
  2. Edit mfe-manifest.yaml    # Define capabilities
  3. mfe remote:generate       # Generate from DSL

See: https://docs.example.com/migration/dsl-first
```

---

### REQ-REMOTE-010: Platform Code Markers

**Must:**

- Generated platform files have clear markers
- Users can add extensions below markers
- Re-generation preserves content outside markers (future enhancement)

**Marker Pattern:**

```typescript
// ============================================
// GENERATED BY mfe remote:generate
// DO NOT EDIT - Regenerate with: mfe remote:generate
// ============================================

// ... generated code ...

// ============================================
// END GENERATED - User extensions below
// ============================================

// Users can add custom code here (preserved on regenerate - future)
```

---

## Implementation Plan

### Phase 0: TypeScript Setup (Prerequisite)

1. Add TypeScript tooling (tsconfig.json, dependencies)
2. Configure ts-jest for test files
3. Convert `src/codegen/BffGenerator/*.js` → `.ts`
4. Verify existing tests pass

### Phase 1: Core Infrastructure

1. Create DSL schema and validator (TypeScript)
2. Implement `remote:init` command (TypeScript)
3. Implement capability → file structure generation
4. Implement `remote:generate` command

### Phase 2: Config Extraction

1. Create extraction layer (DSL → rspack config)
2. Implement Module Federation config generation
3. Implement package.json generation/merge

### Phase 3: RTK Query Integration

1. Parse OpenAPI specs from data.sources
2. Generate RTK Query API slices
3. Generate Redux store configuration

### Phase 4: Deprecation & Migration

1. Add deprecation warning to `mfe remote`
2. Create migration guide
3. Update documentation

---

## Success Criteria

1. ✅ `mfe remote:init` creates valid DSL scaffold
2. ✅ `mfe remote:generate` produces working MFE from DSL
3. ✅ Re-running `generate` preserves user code
4. ✅ RTK Query hooks auto-generated from data sources
5. ✅ Module Federation config extracted (not templated)
6. ✅ Adding capability creates new feature scaffold
7. ✅ Removing capability preserves files, updates exports
8. ✅ Current `mfe remote` shows deprecation message

---

## Non-Goals (Deferred)

- ❌ Multiple bundler support (webpack, vite) - future feature
- ❌ Shell DSL schema - separate requirements doc
- ❌ Marker-aware regeneration (preserve user extensions) - future enhancement
- ❌ Interactive capability wizard - keep CLI simple

---

## Dependencies

- **TypeScript** - `typescript`, `@types/node`, `@types/fs-extra`, `@types/ejs`, `ts-jest`
- **RTK Query** - `@reduxjs/toolkit`, `@rtk-query/graphql-request-base-query`
- **GraphQL BFF** - Existing `data:` section implementation
- **OpenAPI Parser** - `@apidevtools/swagger-parser` (existing)
- **Module Federation** - `@module-federation/enhanced` (existing)

---

## Related ADRs

- **ADR-048:** Incremental TypeScript migration (new code in TS)
- **ADR-047:** Generated MFE test templates
- **ADR-046:** GraphQL Mesh with DSL-embedded configuration (implemented)
- **ADR-013:** Language-agnostic DSL (YAML/JSON)

---

## Revision History

| Date       | Version | Changes                                       | Author         |
| ---------- | ------- | --------------------------------------------- | -------------- |
| 2025-11-27 | 1.1     | Added Phase 0 (TypeScript), ADR-048 reference | Sean + Copilot |
| 2025-11-27 | 1.0     | Initial requirements from elicitation session | Sean + Copilot |
