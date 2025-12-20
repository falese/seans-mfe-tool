# Monorepo Validation Plan

**Date**: 2025-12-20
**Branch**: `claude/enterprise-mfe-toolset-plan-kZZEp`
**Status**: ✅ Migration complete, awaiting validation

---

## 📋 Overview

This document provides a comprehensive validation plan for the monorepo migration. The migration restructured the codebase from a single `src/` directory into 4 focused packages using npm workspaces.

### What Changed
- ✅ Code split into 4 packages: cli, runtime, dsl, codegen
- ✅ Clean dependency graph (no circular dependencies)
- ✅ All imports updated to use `@seans-mfe-tool/*` package names
- ✅ TypeScript project references configured
- ✅ Jest configured for workspace testing
- ✅ Build scripts updated for monorepo

---

## 🎯 Validation Phases

### Phase 1: Environment Setup
### Phase 2: Dependency Validation
### Phase 3: Build Validation
### Phase 4: Test Validation
### Phase 5: CLI Validation
### Phase 6: Final Verification

---

## Phase 1: Environment Setup

### 1.1 Checkout & Clean

```bash
# Navigate to project
cd /path/to/seans-mfe-tool

# Checkout the branch
git checkout claude/enterprise-mfe-toolset-plan-kZZEp

# Clean everything
rm -rf node_modules package-lock.json packages/*/node_modules
```

**Expected**: Clean slate for fresh install

### 1.2 Verify Workspace Structure

```bash
# Check package structure
ls -la packages/

# Should see:
# - cli/
# - runtime/
# - dsl/
# - codegen/
```

**Expected**: 4 package directories present

---

## Phase 2: Dependency Validation

### 2.1 Install Workspace Dependencies

```bash
npm install
```

**Expected**:
- ✅ Install completes successfully
- ✅ Workspace packages symlinked in node_modules/@seans-mfe-tool/
- ✅ No ENOTEMPTY or dependency conflicts
- ✅ All package dependencies installed

### 2.2 Verify Workspace Links

```bash
# Check workspace symlinks
ls -la node_modules/@seans-mfe-tool/

# Should show symlinks to:
# - cli -> ../../packages/cli
# - runtime -> ../../packages/runtime
# - dsl -> ../../packages/dsl
# - codegen -> ../../packages/codegen
```

**Expected**: 4 symlinks created by npm workspaces

### 2.3 Verify Package Dependencies

```bash
# Check each package has its dependencies
ls packages/cli/node_modules/@seans-mfe-tool/ | grep -E "codegen|dsl"
ls packages/codegen/node_modules/@seans-mfe-tool/ | grep dsl
```

**Expected**:
- ✅ CLI has access to codegen and dsl
- ✅ Codegen has access to dsl
- ✅ Runtime and DSL standalone

### 2.4 Verify Dependency Cleanup

```bash
# Check that unnecessary deps were removed
npm ls --depth=0 | grep -E "@rspack|@mui/icons|react-refresh"
```

**Expected**:
- ❌ Should NOT find: `@rspack/*`, `@mui/icons-material`, `react-refresh`
- ✅ Clean dependency tree

---

## Phase 3: Build Validation

### 3.1 Type Checking (Fast Check)

```bash
# Type check without emitting
npm run typecheck
```

**Expected**:
- ✅ No TypeScript errors
- ✅ Project references resolve correctly
- ✅ All packages type check

### 3.2 Build All Packages

```bash
npm run build
```

**Expected Build Order**:
1. DSL builds first (no dependencies)
2. Runtime builds (no dependencies)
3. Codegen builds (depends on dsl)
4. CLI builds (depends on codegen, dsl)

**Expected Output**:
- ✅ All packages compile without errors
- ✅ `packages/*/dist/` directories created
- ✅ Declaration files (.d.ts) generated
- ✅ Templates copied to `packages/codegen/dist/templates/`

### 3.3 Verify Build Artifacts

```bash
# Check each package has dist/
ls -la packages/*/dist/

# Verify codegen templates copied
ls -la packages/codegen/dist/templates/
```

**Expected**:
- ✅ 4 dist/ directories exist
- ✅ JavaScript files (.js) present
- ✅ Declaration files (.d.ts) present
- ✅ Templates in codegen/dist/templates/

### 3.4 Build Individual Packages

```bash
# Test individual builds
npm run build:dsl
npm run build:runtime
npm run build:codegen
npm run build:cli
```

**Expected**:
- ✅ Each package builds independently
- ✅ No cross-package build issues
- ✅ TypeScript project references work

---

## Phase 4: Test Validation

### 4.1 Run All Tests

```bash
npm test
```

**Expected**:
- ✅ All tests pass
- ✅ Test discovery works with new paths (`packages/*/src/**/__tests__/**`)
- ✅ Module name mapper resolves workspace packages
- ✅ No import resolution errors

**Critical Test Files to Watch**:
- `packages/cli/src/commands/__tests__/remote-generate.test.ts` (updated imports)
- `packages/runtime/src/__tests__/remote-mfe.integration.test.ts` (updated imports)
- `packages/runtime/src/__tests__/lifecycle-executor.test.ts` (updated imports)
- `packages/runtime/src/__tests__/test-harness.ts` (updated imports)

### 4.2 Run with Coverage

```bash
npm run test:coverage
```

**Expected**:
- ✅ Coverage collected from `packages/*/src/`
- ✅ 80%+ global coverage maintained
- ✅ Strict coverage for:
  - `packages/dsl/src/type-system.ts` (99%+ local, 90%+ CI)
  - `packages/runtime/src/base-mfe.ts` (90%+ local, 90%+ CI)
  - `packages/cli/src/utils/*.js` (95%+)

### 4.3 Test Watch Mode (Optional)

```bash
npm run test:watch
```

**Expected**:
- ✅ Watch mode starts correctly
- ✅ Detects file changes in packages/

---

## Phase 5: CLI Validation

### 5.1 Basic CLI Execution

```bash
# Test CLI runs
npm run dev -- --help
```

**Expected**:
- ✅ CLI loads from `packages/cli/bin/seans-mfe-tool.js`
- ✅ Help text displays correctly
- ✅ No module resolution errors

### 5.2 Test remote:generate Command

```bash
# Generate a test MFE
npm run dev -- remote:generate test-validation-mfe
```

**Expected**:
- ✅ Command executes without errors
- ✅ Generates files correctly
- ✅ Codegen package loads templates
- ✅ DSL validation works

### 5.3 Test create-api Command (if OpenAPI spec available)

```bash
# Generate test API
npm run dev -- api test-api \
  --spec examples/petstore.yaml \
  --database sqlite \
  --port 3005
```

**Expected**:
- ✅ API generated successfully
- ✅ All imports resolve correctly
- ✅ Generated package.json correct
- ✅ No template path errors

### 5.4 Test deploy Command (if Docker available)

```bash
cd examples/e2e-mfe

npm run dev -- deploy e2e-mfe \
  --env development \
  --type shell \
  --port 3010
```

**Expected**:
- ✅ Docker commands execute
- ✅ No TypeScript errors
- ✅ Deployment succeeds

---

## Phase 6: Final Verification

### 6.1 Linting

```bash
npm run lint
```

**Expected**:
- ✅ No linting errors
- ✅ ESLint recognizes files in packages/

### 6.2 Format Check (Optional)

```bash
npm run format
```

**Expected**:
- ✅ Prettier formats files correctly
- ✅ Works with workspace structure

### 6.3 Clean & Rebuild Test

```bash
# Test clean script
npm run clean

# Verify dist/ removed
ls packages/*/dist/ 2>&1 | grep "No such file"

# Rebuild
npm run build

# Verify dist/ recreated
ls packages/*/dist/
```

**Expected**:
- ✅ Clean removes all dist/
- ✅ Rebuild recreates all dist/

---

## 🏗️ Package Structure Reference

```
packages/
├── cli/                        # @seans-mfe-tool/cli
│   ├── src/
│   │   ├── commands/          # All CLI commands
│   │   └── utils/             # CLI utilities
│   ├── bin/
│   │   └── seans-mfe-tool.js # CLI entry point
│   ├── package.json
│   └── tsconfig.json
│
├── runtime/                    # @seans-mfe-tool/runtime
│   ├── src/
│   │   ├── base-mfe.ts
│   │   ├── remote-mfe.ts
│   │   ├── context.ts
│   │   ├── handlers/
│   │   └── errors/
│   ├── package.json
│   └── tsconfig.json
│
├── dsl/                        # @seans-mfe-tool/dsl
│   ├── src/
│   │   ├── schema.ts
│   │   ├── parser.ts
│   │   ├── validator.ts
│   │   └── type-system.ts
│   ├── package.json
│   └── tsconfig.json
│
└── codegen/                    # @seans-mfe-tool/codegen
    ├── src/
    │   ├── UnifiedGenerator/
    │   ├── APIGenerator/
    │   └── templates/
    ├── package.json
    └── tsconfig.json
```

## 📦 Dependency Graph

```
CLI
├── depends on: @seans-mfe-tool/codegen, @seans-mfe-tool/dsl
└── tools: commander, inquirer, chalk, fs-extra, diff

codegen
├── depends on: @seans-mfe-tool/dsl
└── tools: @babel/*, ejs, @apidevtools/swagger-parser

dsl
└── deps: zod, js-yaml (standalone)

runtime
└── deps: jsonwebtoken (standalone)
```

**No circular dependencies!** ✅

---

## 🚨 Troubleshooting

### Issue: Module Resolution Errors

**Symptom**: `Cannot find module '@seans-mfe-tool/dsl'`

**Solution**:
```bash
# Reinstall to create workspace symlinks
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript Can't Find Packages

**Symptom**: `Cannot find module '@seans-mfe-tool/dsl' or its type declarations`

**Solution**:
```bash
# Build packages to generate .d.ts files
npm run build
```

### Issue: Tests Fail with Import Errors

**Symptom**: Jest can't resolve `@seans-mfe-tool/*` imports

**Solution**:
1. Check `jest.config.js` has correct moduleNameMapper
2. Verify paths in moduleNameMapper point to correct locations
3. Try: `npm test -- --clearCache`

### Issue: Templates Not Found in Codegen

**Symptom**: `ENOENT: no such file or directory, open '.../dist/templates/...'`

**Solution**:
```bash
# Ensure codegen build script runs template copy
npm run build:codegen

# Verify templates copied
ls packages/codegen/dist/templates/
```

### Issue: Build Fails on Individual Package

**Symptom**: `npm run build:cli` fails but `npm run build` works

**Solution**:
1. Build dependencies first: `npm run build:dsl && npm run build:codegen`
2. Then build CLI: `npm run build:cli`
3. TypeScript project references require dependencies built first

### Issue: Permission Errors on Scripts

**Symptom**: `EACCES: permission denied`

**Solution**:
```bash
# Make scripts executable
chmod +x scripts/*.js
chmod +x packages/cli/bin/seans-mfe-tool.js
```

---

## ✅ Success Criteria Checklist

Run through this checklist to validate the migration:

### Environment
- [ ] Branch checked out: `claude/enterprise-mfe-toolset-plan-kZZEp`
- [ ] Clean install completed
- [ ] All 4 workspace packages present

### Dependencies
- [ ] Workspace symlinks created in `node_modules/@seans-mfe-tool/`
- [ ] Each package has access to its dependencies
- [ ] No `@rspack`, `@mui/icons-material`, `react-refresh` in root deps
- [ ] Total dependency count reduced (was 20, now split across packages)

### Build
- [ ] `npm run typecheck` - No errors
- [ ] `npm run build` - All packages build
- [ ] All 4 `packages/*/dist/` directories created
- [ ] Declaration files (.d.ts) generated
- [ ] Templates copied to `codegen/dist/templates/`
- [ ] Individual package builds work

### Tests
- [ ] `npm test` - All tests pass
- [ ] Test discovery works with new paths
- [ ] Coverage collected correctly
- [ ] Critical test files pass (with updated imports)

### CLI
- [ ] CLI runs: `npm run dev -- --help`
- [ ] `remote:generate` command works
- [ ] Generated code correct
- [ ] No module resolution errors

### Quality
- [ ] `npm run lint` - No errors
- [ ] Clean script works
- [ ] Rebuild works after clean

---

## 🎯 Expected Benefits

After successful validation, you'll have:

### Developer Experience
- ✅ **Clear Separation** - Each package has single responsibility
- ✅ **Faster Builds** - Only rebuild changed packages
- ✅ **Better IDE Support** - Clear module boundaries, better autocomplete
- ✅ **Independent Testing** - Test packages in isolation

### Architecture
- ✅ **No Circular Dependencies** - Clean, maintainable dependency graph
- ✅ **Reusable Packages** - Runtime/DSL can be published independently
- ✅ **Easier to Understand** - Smaller, focused codebases
- ✅ **Flexible Versioning** - Independent package versions possible

### Future-Ready
- ✅ **Agent Packages** - Easy to add `packages/agents/*`
- ✅ **Plugin System** - Can create plugin packages
- ✅ **Independent Releases** - Publish packages separately
- ✅ **Monorepo Tools** - Can integrate Turborepo/Nx later

---

## 📝 Next Steps After Validation

Once all validation passes:

1. **Merge to Main**
   - Create PR from `claude/enterprise-mfe-toolset-plan-kZZEp`
   - Include validation results
   - Merge when CI passes

2. **Update CI/CD** (if needed)
   - Adjust GitHub Actions for workspace builds
   - Update test commands
   - Update deployment scripts

3. **Update Documentation**
   - Update README with new structure
   - Add workspace documentation
   - Document package dependencies

4. **Build Optimizations**
   - Consider adding Turborepo for caching
   - Setup incremental builds
   - Optimize CI pipeline

5. **Continue Development**
   - Add agent packages as needed
   - Implement Phase 2 (DevEx improvements)
   - Build new features on solid foundation

---

## 📊 Validation Report Template

After completing validation, fill out this report:

```markdown
# Validation Report - Monorepo Migration

**Date**: ___________
**Tester**: ___________
**Environment**: ___________

## Phase Results

### Phase 1: Environment Setup
- [ ] PASS / [ ] FAIL
- Issues: ___________

### Phase 2: Dependency Validation
- [ ] PASS / [ ] FAIL
- Issues: ___________

### Phase 3: Build Validation
- [ ] PASS / [ ] FAIL
- Issues: ___________

### Phase 4: Test Validation
- [ ] PASS / [ ] FAIL
- Test Results: ___ passed, ___ failed
- Coverage: ____%
- Issues: ___________

### Phase 5: CLI Validation
- [ ] PASS / [ ] FAIL
- Commands Tested: ___________
- Issues: ___________

### Phase 6: Final Verification
- [ ] PASS / [ ] FAIL
- Issues: ___________

## Overall Result
- [ ] ✅ APPROVED - Ready to merge
- [ ] ❌ BLOCKED - Needs fixes

## Notes
___________
```

---

**Status**: Ready for validation!
**Estimated Time**: 15-30 minutes for full validation
