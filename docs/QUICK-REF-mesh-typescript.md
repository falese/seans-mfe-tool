# Quick Reference: Mesh TypeScript Migration

**For**: Implementation developers  
**Purpose**: Fast lookup during implementation  
**Full Docs**: See `docs/requirements/mesh-typescript-config-requirements.md`

---

## 🎯 Core Principles (Remember Always)

1. **DSL is Source of Truth** - Never hand-write config
2. **Micro-Graph Only** - No gateway pattern
3. **Type Safe Everything** - TypeScript strict mode
4. **Generated, Not Written** - All config/resolvers generated
5. **Watch Mode First** - Developer experience matters

---

## 📦 Dependency Changes

### Remove These

```json
"@graphql-mesh/cli": "^0.100.21",           // ❌
"@graphql-mesh/openapi": "^0.109.26",       // ❌
```

### Add These

```json
"@graphql-mesh/runtime": "^0.100.21",       // ✅
"@graphql-mesh/compose-cli": "^0.5.x",      // ✅
"@omnigraph/openapi": "^0.4.x",             // ✅
"@mfe-platform/types": "^1.0.0"             // ✅
```

---

## 🗂️ File Structure

```
my-bff-mfe/
├── mfe-manifest.yaml          # DSL (source of truth)
├── mesh.config.ts             # Generated (not git)
├── src/
│   ├── platform/              # Generated resolvers
│   │   ├── search.resolver.ts
│   │   └── task.resolver.ts
│   ├── generated/             # Generated stubs
│   │   └── BaseMFE.ts
│   ├── bff.ts                 # Generated server
│   └── mesh/
│       └── .mesh/             # Runtime generated
├── specs/
│   └── user-api.yaml
└── package.json
```

---

## 🔄 Current vs. New Flow

### Current (YAML)

```
DSL → meshConfig → .meshrc.yaml → mesh build → .mesh/ → server
```

### New (TypeScript)

```
DSL → meshConfig → mesh.config.ts → createMesh() → server
```

---

## 💻 Code Patterns

### Old: server.ts

```typescript
import { createBuiltMeshHTTPHandler } from './.mesh';
const meshHandler = createBuiltMeshHTTPHandler();
app.use('/graphql', meshHandler);
```

### New: server.ts

```typescript
import { createMesh } from '@graphql-mesh/runtime';
import meshConfig from './mesh.config';

async function initBFF() {
  const mesh = await createMesh(meshConfig);
  app.use('/graphql', mesh.httpHandler);
  return app;
}
```

---

## 📝 DSL Extension

### Platform Mapping

```yaml
capabilities:
  - search:
      type: domain
      implements: IPlatformSearchResult
      dataMapping:
        source: data.sources[0]
        query: users
        fields:
          id: user.id
          title: user.name
          description: "user.role + ' - ' + user.department"
          url: "'/users/' + user.id"
```

### Field Mapping Rules

- ✅ Direct: `id: user.id`
- ✅ Transform: `description: "user.role + ' - ' + user.department"`
- ✅ Nested: `metadata: { userId: user.id }`
- ❌ Functions: NO custom functions

---

## 🧪 Testing Checklist

### Unit Tests

- [ ] Config generation from DSL
- [ ] Resolver generation from mappings
- [ ] DSL validation catches errors
- [ ] Watch mode debouncing

### Integration Tests

- [ ] npm install succeeds
- [ ] TypeScript compiles
- [ ] Server starts
- [ ] GraphQL queries work

### Dependency Tests

- [ ] No ERESOLVE errors
- [ ] No peer warnings
- [ ] rspack builds
- [ ] React hot reload works

---

## ⚠️ Common Pitfalls

1. **DO track generated files in git**

   - ✅ Enables PR reviews and debugging
   - ✅ All generated files have warning headers
   - ⚠️ DON'T manually edit (changes will be overwritten)
   - Generator detects and warns about manual edits

2. **DON'T use gateway patterns**

   - No Hive Gateway
   - No supergraph composition
   - Each BFF is independent

3. **DON'T hand-write resolvers**

   - Always generate from DSL
   - Warn if manual edits detected

4. **DON'T use custom functions in mappings**
   - Keep expressions simple
   - Only direct mapping and transformations

---

## 🚀 Commands

### Development

```bash
mfe bff:generate           # Generate mesh.config.ts + resolvers
mfe bff:dev --watch        # Start with auto-regeneration
mfe bff:validate           # Validate DSL before generation
```

### Build

```bash
npm run bff:build          # tsc (no mesh build CLI)
npm run bff:generate       # Explicit generation
```

---

## 📂 Files to Update

### High Priority

- [ ] `src/commands/bff.ts` - Refactor 4 functions
- [ ] `src/codegen/templates/bff/server.ts.ejs` - Programmatic API
- [ ] `src/codegen/templates/bff/package.json.ejs` - Dependencies

### New Files

- [ ] `src/codegen/templates/bff/mesh.config.ts.ejs`
- [ ] `src/codegen/ResolverGenerator.ts`
- [ ] `src/codegen/templates/resolver.template.ts.ejs`

### Update Tests

- [ ] `src/commands/__tests__/bff.test.js` - Update expectations
- [ ] `src/codegen/__tests__/ResolverGenerator.test.ts` - New tests

---

## 🎯 Milestone Quick Ref

| Milestone | Goal                  | Duration |
| --------- | --------------------- | -------- |
| 1         | Dependency testing    | 3 days   |
| 2         | TypeScript config gen | 3 days   |
| 3         | Platform types        | 2 days   |
| 4         | DSL mapping           | 3 days   |
| 5         | Watch mode            | 2 days   |
| 6         | Integration           | 2 days   |

**Total**: 15 days

---

## 🆘 When Stuck

1. **Read**: `docs/requirements/mesh-typescript-config-requirements.md`
2. **Check**: `docs/bff-refactor-analysis.md` for patterns
3. **Reference**: `docs/architecture-decisions/ADR-063-mesh-typescript-config.md`
4. **Ask**: Clarify requirements, don't guess

---

## ✅ Definition of Done (Per Milestone)

- [ ] All tests pass (unit + integration)
- [ ] TypeScript compiles with strict mode
- [ ] Example MFE works end-to-end
- [ ] Documentation updated
- [ ] No dependency conflicts
- [ ] Code reviewed and approved

---

**Quick Links**:

- Full Requirements: `docs/requirements/mesh-typescript-config-requirements.md`
- ADR: `docs/architecture-decisions/ADR-063-mesh-typescript-config.md`
- Analysis: `docs/bff-refactor-analysis.md`
