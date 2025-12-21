# ADR-063: GraphQL Mesh TypeScript Configuration

**Status**: 📋 Proposed  
**Date**: 2025-12-13  
**Context**: BFF Layer Enhancement  
**Related ADRs**: ADR-046 (Mesh with DSL), ADR-062 (Mesh v0.100.x)  
**Related Requirements**: REQ-MESH-TS-001 to REQ-MESH-TS-007

## Context

GraphQL Mesh v1 introduces TypeScript-based configuration (`mesh.config.ts`) instead of YAML (`.meshrc.yaml`), offering type safety and programmatic flexibility. However, v1 also assumes a gateway deployment model with Hive Gateway, which conflicts with our micro-graph architecture where each BFF serves only its MFE's schema.

Current pain points:

- YAML configuration lacks type safety
- Limited plugin availability in Mesh v0.100.x
- Dependency conflicts (documented in `MESHRC-DIAGNOSIS.md`)
- No standardized platform schema mapping

Strategic goals:

- Preserve DSL as single source of truth
- Enable platform-specific schema mapping (search, tasks, notifications)
- Maintain micro-graph architecture (no gateway pattern)
- Support watch-mode development with auto-regeneration

## Decision

**We will generate TypeScript `mesh.config.ts` from DSL (v1 config format) while using Mesh v0 programmatic runtime API**, avoiding Hive Gateway dependency and maintaining our micro-graph architecture.

**This is a hybrid approach**: We use v1's TypeScript config format for type safety, but v0's `@graphql-mesh/runtime` programmatic API to avoid gateway requirements. This is intentionally divergent from Guild's official v0→v1 migration path, which assumes Hive Gateway deployment.

### Key Components

1. **TypeScript Config Generation**: DSL → `mesh.config.ts` (generated, not git-tracked)
2. **Programmatic Runtime**: Use `@graphql-mesh/runtime` API, not CLI
3. **Platform Types Library**: `@mfe-platform/types` for shared interfaces
4. **DSL Mapping Extension**: `capabilities[].dataMapping` for schema mapping
5. **Watch Mode**: Continuous regeneration during development

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  mfe-manifest.yaml (DSL - Source of Truth)                  │
│  ├── capabilities[] (search, task, notification)            │
│  │   └── dataMapping: { source, fields, lifecycle }         │
│  └── data: { sources, transforms, plugins }                 │
└─────────────────────────────────────────────────────────────┘
                          ↓ mfe bff:generate
┌─────────────────────────────────────────────────────────────┐
│  Generated Artifacts (NOT git-tracked)                      │
│  ├── mesh.config.ts (TypeScript Mesh config)                │
│  ├── src/platform/search.resolver.ts (platform mapping)     │
│  ├── src/platform/task.resolver.ts                          │
│  └── src/bff.ts (Express + Mesh server)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓ Runtime
┌─────────────────────────────────────────────────────────────┐
│  BFF Server (Micro-Graph)                                   │
│  ├── GraphQL Endpoint: /graphql                             │
│  │   └── Schema: Query.users, Query.searchUsers, ...       │
│  ├── Static Assets: /assets (React build)                   │
│  └── Health Check: /health                                  │
└─────────────────────────────────────────────────────────────┘
```

### Comparison to Alternatives

| Aspect                   | YAML Config (Current) | TypeScript Config (Chosen)  | Mesh v1 + Gateway        |
| ------------------------ | --------------------- | --------------------------- | ------------------------ |
| Type Safety              | ❌ None               | ✅ Full TypeScript          | ✅ Full TypeScript       |
| Gateway Dependency       | ✅ None               | ✅ None                     | ❌ Requires Hive Gateway |
| DSL Alignment            | ✅ Direct extraction  | ✅ Generated from DSL       | ⚠️ Separate config       |
| Programmatic Flexibility | ❌ Limited            | ✅ Full JavaScript/TS       | ✅ Full JavaScript/TS    |
| Micro-Graph Architecture | ✅ Supported          | ✅ Supported                | ❌ Assumes federation    |
| Code Generation          | ⚠️ Limited            | ✅ Full resolver generation | ⚠️ SDL only              |
| Watch Mode               | ⚠️ Manual restart     | ✅ Auto-regenerate          | ⚠️ Manual restart        |

## Rationale

### Why Hybrid v0/v1 Approach?

**We're using Mesh v0 runtime with v1-style TypeScript config** - this is intentionally divergent from Guild's official migration path.

**Guild's Official v0→v1 Migration**:

```bash
# 1. Use migration tool
npx @graphql-mesh/migrate-config-cli

# 2. Update packages
npm install @graphql-mesh/compose-cli @graphql-hive/gateway

# 3. Deploy with Hive Gateway
# mesh.config.ts → supergraph.graphql → Hive Gateway
```

**Our Hybrid Approach**:

```typescript
// Generate TypeScript config (v1 format)
export default defineConfig({
  /* ... */
});

// But use with v0 runtime (no gateway)
import { createMesh } from '@graphql-mesh/runtime'; // v0 package
const mesh = await createMesh(meshConfig);
```

**Why We Can't Follow Official Path**:

- Hive Gateway assumes federation/supergraph pattern
- Our micro-graph architecture requires independent BFFs
- Orchestration layer handles runtime composition, not build-time
- Gateway creates the exact dependency we're designed to avoid

**Why This Is Safe**:

- Mesh v0 is stable and maintained (not deprecated)
- Programmatic API (`createMesh()`) is documented and supported
- TypeScript config is just data (we can generate any format)
- Guild's tooling doesn't prevent this usage

### Why TypeScript Config?

1. **Type Safety**: IDE autocomplete, compile-time validation prevents runtime errors
2. **DSL Alignment**: TypeScript matches our runtime type system better than YAML
3. **Flexibility**: Can use conditional logic, imports, dynamic configuration
4. **Code Reuse**: Import platform types, shared utilities
5. **Debugging**: Stack traces reference TypeScript source, not YAML strings

### Why Stay on Mesh v0?

1. **No Gateway Needed**: v0 programmatic API (`createMesh`) works without Hive Gateway
2. **Micro-Graph Pattern**: Each BFF is independent, not federated
3. **Proven Stability**: v0.100.x is production-tested in our templates
4. **Avoid Breaking Changes**: v1 requires architectural shift (gateway deployment)

### Why Generated, Not Hand-Written?

1. **DSL as Source of Truth**: Hand-written config would duplicate DSL
2. **Consistency**: Generation ensures all BFFs follow patterns
3. **Evolution**: DSL changes automatically propagate to config
4. **Validation**: Can validate DSL before generation

### Why Not Gateway Pattern?

1. **MFE Independence**: Gateway creates build-time dependencies
2. **Dynamic Composition**: Orchestration layer composes at runtime, not build time
3. **Single Point of Failure**: Gateway becomes bottleneck
4. **Our Architecture**: Micro-graphs fit MFE autonomy principles better

## Implementation

### Phase 1: Code Generation

```typescript
// src/commands/bff-generate-config.ts
import { parseManifest } from '../dsl/parser';

async function generateMeshConfig(manifestPath: string) {
  const manifest = parseManifest(manifestPath);
  const meshConfig = extractMeshConfig(manifest.data);

  // Generate mesh.config.ts
  const configCode = `
import { defineConfig } from '@graphql-mesh/compose-cli';
import { loadOpenAPISubgraph } from '@omnigraph/openapi';

export default defineConfig({
  subgraphs: [
    ${meshConfig.sources
      .map(
        (source) => `
    {
      sourceHandler: loadOpenAPISubgraph('${source.name}', {
        source: '${source.handler.openapi.source}',
      }),
    }
    `
      )
      .join(',')}
  ],
});
  `;

  await fs.writeFile('mesh.config.ts', configCode);
}
```

### Phase 2: Platform Types

```typescript
// @mfe-platform/types/src/search.types.ts
export interface IPlatformSearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  metadata?: Record<string, unknown>;
}

export interface IPlatformSearchQuery {
  query: string;
  filters?: Record<string, unknown>;
  type?: 'user' | 'product' | 'article';
  limit?: number;
  offset?: number;
}
```

### Phase 3: DSL Mapping

```yaml
# mfe-manifest.yaml
capabilities:
  - search:
      type: domain
      implements: IPlatformSearchResult
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
```

### Phase 4: Resolver Generation

```typescript
// src/platform/search.resolver.ts (GENERATED)
import { IPlatformSearchResult, IPlatformSearchQuery } from '@mfe-platform/types';
import { UserAPI } from './.mesh';

export class UserSearchResolver {
  async search(query: IPlatformSearchQuery): Promise<IPlatformSearchResult[]> {
    const users = await UserAPI.Query.users({ name: query.query });

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

### Phase 5: Watch Mode

```typescript
// src/commands/bff.ts
async function bffDevWatch() {
  const watcher = chokidar.watch(['mfe-manifest.yaml', 'specs/**/*.yaml']);

  watcher.on(
    'change',
    debounce(async (path) => {
      console.log(chalk.blue(`↻ Regenerating from ${path}...`));
      await generateMeshConfig();
      await generateResolvers();
      await restartServer();
      console.log(chalk.green(`✓ Regenerated at ${new Date().toLocaleTimeString()}`));
    }, 300)
  );
}
```

## Consequences

### Positive

1. ✅ **Type Safety**: Full TypeScript checking on Mesh configuration
2. ✅ **Developer Experience**: Watch mode auto-regenerates on DSL changes
3. ✅ **Platform Consistency**: Shared types enforce schema contracts
4. ✅ **Micro-Graph Architecture**: Each BFF is independent, no gateway
5. ✅ **Code Generation**: Reduces boilerplate, ensures patterns
6. ✅ **DSL Preservation**: Single source of truth maintained
7. ✅ **Git Tracking**: Generated files tracked for PR reviews and debugging
8. ✅ **Auditable**: Git history shows evolution of generated code

### Negative

1. ⚠️ **Custom Tooling**: Not using standard Mesh v1 migration path (hybrid v0/v1 approach)
2. ⚠️ **Complexity**: More moving parts (generator + runtime + types package)
3. ⚠️ **Maintenance**: Need to keep generator in sync with Mesh API changes
4. ⚠️ **Learning Curve**: Developers must understand DSL → code flow
5. ⚠️ **Git Noise**: Generated file changes appear in every DSL-modifying commit
6. ⚠️ **Manual Edit Risk**: Developers might edit generated files (mitigated by warnings)

### Neutral

1. 🔶 **Mesh v1 Future**: If we migrate later, will need significant refactoring
2. 🔶 **Platform Types Versioning**: Requires semantic versioning discipline
3. 🔶 **Generated Code Volume**: More files generated per MFE

## Validation

### Success Criteria

- [ ] Generate valid TypeScript config from any DSL
- [ ] Generated BFF starts without errors
- [ ] GraphQL queries work end-to-end
- [ ] Platform type mapping produces correct results
- [ ] Watch mode regenerates in < 500ms
- [ ] No dependency conflicts with template packages

### Testing Approach

1. **Unit Tests**: Config generator, resolver generator, DSL parser
2. **Integration Tests**: Full BFF generation → build → runtime
3. **Dependency Matrix**: Test compatible package versions
4. **Example MFEs**: Reference implementations for patterns

### Rollback Plan

If TypeScript config proves problematic:

1. Keep existing YAML-based commands (`bff:init`, `bff:build`)
2. Mark TypeScript commands as experimental (`bff:generate-ts`)
3. Can revert to YAML with minimal disruption

## Open Questions

1. **Platform Types Distribution**: npm private registry vs. Git package?

   - **Current Thinking**: Git package initially (simpler), npm later (better DX)

2. **Mapping Expression Language**: String interpolation vs. template language?

   - **Current Thinking**: Start simple (string expressions), evaluate Handlebars if complex

3. **Mesh API Stability**: How often does v0 programmatic API change?

   - **Mitigation**: Pin exact versions, monitor Guild changelog

4. **Federation Future**: How will orchestration compose micro-graphs?
   - **Status**: Deferred to orchestration design session

## Related Decisions

- **ADR-046**: GraphQL Mesh with DSL-embedded configuration (foundation)
- **ADR-062**: Mesh v0.100.x with production plugins (current implementation)
- **ADR-TBD**: Platform Schema System (companion decision)
- **ADR-TBD**: Micro-Graph Architecture (companion decision)

## References

- [GraphQL Mesh v1 Migration Guide](https://the-guild.dev/graphql/mesh/v1/migration-from-v0)
- [Mesh Programmatic Usage](https://the-guild.dev/graphql/mesh/docs/guides/mesh-sdk)
- [Requirements Document](docs/requirements/mesh-typescript-config-requirements.md)
- [Mesh Dependency Diagnosis](MESHRC-DIAGNOSIS.md)

---

**Decision Date**: 2025-12-13  
**Review Date**: TBD (after Milestone 2 completion)  
**Status Change Log**:

- 2025-12-13: Proposed (requirements elicitation complete)
