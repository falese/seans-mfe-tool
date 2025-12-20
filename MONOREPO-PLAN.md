# Monorepo Migration Plan

**Date**: 2025-12-20
**Goal**: Transform single-package project into clean, maintainable monorepo
**Approach**: npm workspaces (simple, built-in, zero config)

---

## 🎯 Target Structure

```
seans-mfe-tool/
├── package.json                    # Root workspace config
├── packages/
│   ├── cli/                        # @seans-mfe-tool/cli
│   │   ├── package.json
│   │   ├── src/
│   │   │   └── commands/          # CLI commands
│   │   ├── bin/                   # CLI entry point
│   │   └── tsconfig.json
│   │
│   ├── runtime/                    # @seans-mfe-tool/runtime
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── base-mfe.ts
│   │   │   ├── remote-mfe.ts
│   │   │   ├── context.ts
│   │   │   └── handlers/
│   │   └── tsconfig.json
│   │
│   ├── dsl/                        # @seans-mfe-tool/dsl
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── schema.ts
│   │   │   ├── parser.ts
│   │   │   ├── validator.ts
│   │   │   └── type-system.ts
│   │   └── tsconfig.json
│   │
│   └── codegen/                    # @seans-mfe-tool/codegen
│       ├── package.json
│       ├── src/
│       │   ├── UnifiedGenerator.ts
│       │   ├── APIGenerator/
│       │   └── templates/         # EJS templates
│       └── tsconfig.json
│
├── examples/                       # Generated examples (unchanged)
├── docs/                          # Documentation (unchanged)
├── agents/                        # Future: agent packages
│   └── requirements-elicitation/  # Already structured!
│
├── tsconfig.json                  # Root TS config (shared)
├── jest.config.js                 # Root Jest config
└── .eslintrc.json                # Root ESLint config
```

---

## 📦 Package Breakdown

### Package 1: CLI (`@seans-mfe-tool/cli`)

**Purpose**: Command-line interface for MFE tooling

**Contents**:
- `src/commands/` - All command implementations
- `bin/` - CLI entry point
- Command tests

**Dependencies**:
- `@seans-mfe-tool/codegen` - For code generation
- `@seans-mfe-tool/dsl` - For DSL parsing
- `commander`, `inquirer`, `chalk` - CLI utilities

**Exports**:
- Binary: `seans-mfe-tool`

---

### Package 2: Runtime (`@seans-mfe-tool/runtime`)

**Purpose**: MFE runtime platform (used by generated MFEs)

**Contents**:
- `src/base-mfe.ts` - Abstract base class
- `src/remote-mfe.ts` - Module Federation implementation
- `src/context.ts` - Shared context
- `src/handlers/` - Platform handlers
- `src/errors.ts` - Error classes
- Runtime tests

**Dependencies**:
- `jsonwebtoken` - JWT handling
- Minimal deps (this gets bundled into generated MFEs)

**Exports**:
- `BaseMFE`, `RemoteMFE`, `Context`, handlers, errors

---

### Package 3: DSL (`@seans-mfe-tool/dsl`)

**Purpose**: DSL schema, parser, and validator

**Contents**:
- `src/schema.ts` - Zod schemas
- `src/parser.ts` - YAML parser
- `src/validator.ts` - Validation logic
- `src/type-system.ts` - Type inference
- DSL tests

**Dependencies**:
- `zod` - Schema validation
- `js-yaml` - YAML parsing

**Exports**:
- `DSLManifestSchema`, `parseManifest`, `validateManifest`, type utilities

---

### Package 4: Codegen (`@seans-mfe-tool/codegen`)

**Purpose**: Code generation engine and templates

**Contents**:
- `src/UnifiedGenerator.ts` - Main generator
- `src/APIGenerator/` - API generation
- `src/templates/` - EJS templates (copied to dist/)
- Codegen tests

**Dependencies**:
- `@seans-mfe-tool/dsl` - For manifest parsing
- `@babel/*` - AST manipulation
- `ejs` - Template engine
- `@apidevtools/swagger-parser` - OpenAPI parsing

**Exports**:
- `UnifiedGenerator`, `APIGenerator`, template utilities

---

## 🔗 Dependency Graph

```
CLI
├── depends on: codegen, dsl
└── publishes: runtime to generated projects

codegen
├── depends on: dsl
└── standalone generators

dsl
└── standalone (only Zod, js-yaml)

runtime
└── standalone (only jsonwebtoken)
```

**Clean separation**: No circular dependencies! ✅

---

## 📋 Migration Steps

### Phase 1: Setup Structure (30 min)
1. Create `packages/` directory
2. Create package subdirectories (cli, runtime, dsl, codegen)
3. Move code to appropriate packages
4. Create package.json for each package

### Phase 2: Configuration (20 min)
5. Update root package.json (workspaces)
6. Create tsconfig.json for each package
7. Update shared configs (jest, eslint)
8. Update .gitignore

### Phase 3: Fix Imports (30 min)
9. Update imports to use package names
10. Fix relative imports within packages
11. Update test imports

### Phase 4: Build System (20 min)
12. Update build scripts
13. Setup inter-package build order
14. Test builds

### Phase 5: Testing (20 min)
15. Run tests from root
16. Verify all packages build
17. Test CLI still works

**Total**: ~2 hours

---

## 🛠️ Build Strategy

### Root package.json Scripts

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "build:cli": "npm run build --workspace=@seans-mfe-tool/cli",
    "build:runtime": "npm run build --workspace=@seans-mfe-tool/runtime",
    "build:dsl": "npm run build --workspace=@seans-mfe-tool/dsl",
    "build:codegen": "npm run build --workspace=@seans-mfe-tool/codegen",

    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",

    "lint": "eslint packages/*/src/**/*.ts",
    "typecheck": "tsc --build --force",

    "clean": "rm -rf packages/*/dist",
    "dev": "npm run dev --workspace=@seans-mfe-tool/cli"
  }
}
```

### Build Order

1. **dsl** (no dependencies)
2. **runtime** (no dependencies)
3. **codegen** (depends on dsl)
4. **cli** (depends on codegen, dsl)

---

## 🎁 Benefits

### Developer Experience
- ✅ **Clear separation** - Each package has single responsibility
- ✅ **Independent testing** - Test packages in isolation
- ✅ **Faster builds** - Only rebuild what changed
- ✅ **Better IDE support** - Clear module boundaries

### Architecture
- ✅ **No circular deps** - Clean dependency graph
- ✅ **Reusable packages** - Runtime can be published separately
- ✅ **Easier to understand** - Smaller, focused codebases
- ✅ **Flexible versioning** - Can version packages independently

### Future Ready
- ✅ **Agent packages** - Easy to add new agent packages
- ✅ **Plugin system** - Can create plugin packages
- ✅ **Shared utilities** - Can extract common utils
- ✅ **Independent releases** - Publish packages separately

---

## 🚨 Potential Issues & Solutions

### Issue 1: Import path changes
**Problem**: All imports will break initially
**Solution**: Update systematically, package by package

### Issue 2: Template file copying
**Problem**: Templates need to be in codegen dist/
**Solution**: Update build script to copy templates

### Issue 3: Binary path
**Problem**: CLI binary location changes
**Solution**: Update bin/ path in package.json

### Issue 4: Tests
**Problem**: Test paths may need updating
**Solution**: Update jest config for workspace

---

## ✅ Success Criteria

Migration is successful when:

- [ ] All packages build independently
- [ ] All tests pass
- [ ] CLI works from root: `npm run dev -- remote:generate test`
- [ ] Generated code works (MFE, API)
- [ ] No circular dependencies
- [ ] TypeScript compilation works
- [ ] Clean workspace structure

---

## 🎯 Next Actions

1. **Create directories** - Setup packages/ structure
2. **Move code** - Split src/ into packages
3. **Update configs** - package.json, tsconfig.json
4. **Fix imports** - Update all import statements
5. **Test** - Verify everything works

**Ready to start?** Let's do this! 🚀
