# Pragmatic Plan - Get the House in Order

**Status**: Side project, for fun, solo dev
**Goal**: Solid DevEx, clean codebase, iterate without breaking
**Approach**: Start simple, tackle enterprise features incrementally as needed

---

## Phase 0: Audit & Cleanup (Week 1) 🧹

**Objective**: Figure out what's real, what's slop, what can go

### 0.1 Documentation vs Implementation Audit

**Tasks**:
- [ ] Map all ADRs to actual code
- [ ] Identify documented features that aren't implemented
- [ ] Identify implemented code that isn't documented
- [ ] Mark "design only" vs "implemented" clearly
- [ ] Create "AUDIT-RESULTS.md" with findings

**Questions to Answer**:
- What percentage of ADRs have corresponding code?
- Which examples actually work end-to-end?
- What's in docs but not code? (agent orchestrator, etc.)
- What's in code but not docs?

---

### 0.2 Dead Code & Slop Removal

**Tasks**:
- [ ] Find unused exports/functions
- [ ] Remove commented-out code
- [ ] Delete unused dependencies
- [ ] Remove orphaned files
- [ ] Clean up duplicate logic
- [ ] Remove incomplete features (or clearly mark as WIP)

**Tools**:
```bash
# Find unused exports
npx ts-unused-exports tsconfig.json

# Find unused dependencies
npx depcheck

# Find dead code
npx unimported
```

---

### 0.3 File Structure Audit

**Tasks**:
- [ ] List all markdown files and their purpose
- [ ] Identify documentation duplicates
- [ ] Find orphaned/outdated docs
- [ ] Consolidate planning docs (we just added 2 more!)
- [ ] Move deprecated docs to `docs/archive/`

**Proposed Structure**:
```
docs/
├── README.md                    # Navigation hub
├── getting-started.md           # Quick start
├── architecture/                # Architecture docs only
│   ├── current-state.md
│   ├── runtime-platform.md
│   └── decisions/              # ADRs
├── guides/                     # How-to guides
│   ├── dsl-guide.md
│   └── code-generation.md
├── reference/                  # API/CLI reference
│   ├── cli-commands.md
│   └── dsl-schema.md
└── archive/                    # Old/deprecated docs
    └── planning/
        ├── ENTERPRISE-READINESS-PLAN.md
        └── ROADMAP-QUICK-REFERENCE.md
```

---

## Phase 1: Foundation (Week 2-3) 🏗️

**Objective**: Monorepo, clean builds, good hygiene

### 1.1 Monorepo Setup

**Why**: Cleaner separation, easier testing, proper versioning

**Approach**: Start simple (npm workspaces), can upgrade later

**Structure**:
```
seans-mfe-tool/
├── package.json (root workspace)
├── packages/
│   ├── cli/              # The CLI tool
│   ├── runtime/          # Runtime platform (@seans-mfe-tool/runtime)
│   ├── dsl/              # DSL parser/validator
│   └── codegen/          # Code generators
├── examples/             # Generated examples
└── tools/                # Build scripts, testing utilities
```

**Tasks**:
- [ ] Create workspace structure
- [ ] Split code into packages
- [ ] Setup inter-package dependencies
- [ ] Update build scripts
- [ ] Update import paths
- [ ] Test that everything still works

**Start Simple**:
```json
// package.json
{
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
```

---

### 1.2 Build System Improvements

**Current Issues**:
- Manual runtime file copying
- No watch mode for development
- No proper package builds
- TypeScript output mixed with source

**Tasks**:
- [ ] Setup proper TypeScript builds per package
- [ ] Add watch mode for development
- [ ] Setup proper dist/ output
- [ ] Add source maps for debugging
- [ ] Remove manual file copying scripts
- [ ] Add build validation

**Improved Scripts**:
```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "dev": "npm run dev --workspace=packages/cli",
    "watch": "npm run build --workspaces -- --watch",
    "clean": "rm -rf packages/*/dist",
    "typecheck": "tsc --noEmit --workspaces"
  }
}
```

---

### 1.3 Code Hygiene & Quality

**Tasks**:
- [ ] Setup ESLint auto-fix on save
- [ ] Setup Prettier auto-format on save
- [ ] Add `.editorconfig` for consistency
- [ ] Update ESLint rules (current config is basic)
- [ ] Add TypeScript strict mode (gradually)
- [ ] Fix all linting errors/warnings

**Improved ESLint**:
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off"
  }
}
```

---

### 1.4 Testing Hygiene

**Current State**: Good coverage mandates, but can be cleaner

**Tasks**:
- [ ] Move all tests to `__tests__/` directories
- [ ] Standardize test naming (`*.test.ts` vs `*.spec.ts`)
- [ ] Remove redundant test files
- [ ] Add test utilities package
- [ ] Setup test coverage reporting
- [ ] Add `npm test -- --watch` for development

---

## Phase 2: DevEx & Iteration (Week 4) 🚀

**Objective**: Make it fun and easy to iterate

### 2.1 Development Workflow

**Tasks**:
- [ ] Add `npm run dev` that watches everything
- [ ] Add `npm run test:watch` for TDD
- [ ] Add `npm run lint:fix` for quick fixes
- [ ] Setup hot reload for examples
- [ ] Add debug configurations for VSCode

**VSCode Launch Config**:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug CLI",
  "program": "${workspaceFolder}/packages/cli/bin/seans-mfe-tool.js",
  "args": ["remote:generate", "test-mfe"],
  "console": "integratedTerminal"
}
```

---

### 2.2 Quick Validation

**Goal**: Catch issues before commit without being annoying

**Tasks**:
- [ ] Update pre-commit hook to be faster
- [ ] Add pre-push hook for full tests
- [ ] Add commit message linting (optional)
- [ ] Add CI that matches local (same tests)

**Faster Pre-commit**:
```bash
#!/bin/sh
# Only run tests for changed files
npm run lint:fix
npm test -- --bail --findRelatedTests $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js)$')
```

---

### 2.3 Documentation Workflow

**Goal**: Make docs easy to maintain and trust

**Tasks**:
- [ ] Create `docs/CONTRIBUTING.md` with doc guidelines
- [ ] Add doc templates for common patterns
- [ ] Setup docs linting (markdown)
- [ ] Add "last updated" dates to docs
- [ ] Add implementation status badges

**Documentation Guardrails**:
```markdown
# Feature Documentation Template

**Status**: 🟢 Implemented | 🟡 Partial | 🔴 Design Only
**Last Updated**: YYYY-MM-DD
**Related Code**: `src/path/to/code.ts`
**Related ADR**: ADR-XXX
**Tests**: `src/__tests__/feature.test.ts`

## Overview
[Description]

## Implementation
[How it works]

## Usage
[Examples]
```

---

## Phase 3: Documentation Guardrails (Week 4) 📚

**Objective**: Sustainable docs that don't rot

### 3.1 Documentation Audit Results

**Create**: `DOCUMENTATION-STATUS.md`

**Content**:
- List of all docs
- Implementation status (✅ Done, 🚧 Partial, 📋 Design Only)
- Last verified date
- Owner/maintainer

**Example**:
```markdown
## Core Features

| Feature | Docs | Code | Status | Last Verified |
|---------|------|------|--------|---------------|
| DSL Parser | ✅ | ✅ | 🟢 Complete | 2025-12-20 |
| Code Generation | ✅ | ✅ | 🟢 Complete | 2025-12-20 |
| Agent Orchestrator | ✅ | ❌ | 📋 Design Only | 2025-12-20 |
| Runtime Platform | ✅ | 🚧 | 🟡 Partial | 2025-12-20 |
```

---

### 3.2 Documentation Rules

**Guidelines** (to add to CONTRIBUTING.md):

1. **Every ADR must link to code or mark as "Design Only"**
2. **Every feature doc must have implementation status badge**
3. **Planning docs go in `docs/archive/planning/`**
4. **Keep root docs/ clean - only navigation and current architecture**
5. **Update "Last Updated" date when changing docs**
6. **If removing a feature, move docs to `docs/archive/deprecated/`**

---

### 3.3 Consolidate Planning Docs

**Current Mess**:
- ENTERPRISE-READINESS-PLAN.md (new)
- ROADMAP-QUICK-REFERENCE.md (new)
- IMPLEMENTATION-PLAN.md (old)
- CODE-REVIEW-IMPLEMENTATION-PLAN.md (old)
- TEMPLATE-UPDATE-PLAN.md (old)
- Various other planning docs

**Action**:
- [ ] Move all to `docs/archive/planning/`
- [ ] Create single `ROADMAP.md` with phased approach
- [ ] Keep only active/current plans in root

---

## Phase 4: Incremental Enterprise Features (Ongoing) 🎯

**Approach**: One at a time, as needed, when you feel like it

### Priority Order (for fun project)

**P0 - Would be nice now**:
1. **Monorepo** - Makes everything cleaner
2. **Better builds** - Faster iteration
3. **Documentation audit** - Know what's real
4. **Clean up slop** - Feels good

**P1 - Would be nice soon**:
5. **Basic CI improvements** - Automated checks
6. **Better testing workflow** - TDD flow
7. **Example validation** - Know examples work

**P2 - Future, when needed**:
8. **Security scanning** - When you care about production
9. **Deployment automation** - When deploying somewhere
10. **Observability** - When debugging production issues

---

## Immediate Next Steps (This Week)

### Step 1: Audit (Day 1-2)

Run these and create `AUDIT-RESULTS.md`:

```bash
# Find unused exports
npx ts-unused-exports tsconfig.json > audit-unused-exports.txt

# Find unused dependencies
npx depcheck > audit-unused-deps.txt

# Find dead code
npx unimported > audit-unimported.txt

# Check test coverage
npm test -- --coverage > audit-coverage.txt
```

Then manually:
- Map ADRs to code
- Test each example (does it work?)
- List all markdown files and purpose

---

### Step 2: Quick Wins (Day 3)

- [ ] Remove unused dependencies
- [ ] Delete commented code
- [ ] Run `npm run lint:fix` everywhere
- [ ] Run `npm run format` everywhere
- [ ] Delete obvious dead code

---

### Step 3: Monorepo Planning (Day 4-5)

- [ ] Design package structure (which code goes where)
- [ ] Plan migration steps
- [ ] Create migration checklist
- [ ] Test on small package first

---

## Success Criteria (Pragmatic Edition)

**You'll know you're done when**:
- ✅ `npm install && npm run build` works cleanly
- ✅ `npm test` runs fast and passes
- ✅ You can iterate on a feature without breaking others
- ✅ You know which docs are real vs aspirational
- ✅ The codebase feels clean and organized
- ✅ You're having fun, not drowning in process

---

## Anti-Goals (What we're NOT doing)

- ❌ Full enterprise CI/CD (just basic GitHub Actions is fine)
- ❌ Production deployment setup (not deploying yet)
- ❌ Comprehensive observability (console.log is fine for now)
- ❌ Security hardening (no users, no problem)
- ❌ Load testing (not needed for side project)
- ❌ Feature flags, circuit breakers, etc. (overkill)

**The Rule**: If it's not fun or directly helping you iterate faster, skip it for now.

---

## Questions for You

1. **Monorepo**: Want to start with simple npm workspaces or go fancier (Turborepo)?
   - My rec: Start simple

2. **Documentation**: Want me to run the audit first to see what's real?
   - We can identify what actually works vs what's aspirational

3. **Dead Code**: Aggressive cleanup or conservative?
   - Aggressive = delete anything unused
   - Conservative = move to `archive/` for now

4. **Agent Orchestrator**: Since it's not implemented, want to:
   - Remove it from docs (mark as future)
   - Keep as design docs in archive
   - Your call!

5. **Examples**: Which examples should definitely work? I can test them all.

---

**Let me know where you want to start!** I'm thinking:
1. Run the audit (find the slop)
2. Clean up the obvious cruft
3. Setup basic monorepo
4. Improve build/dev workflow

Sound good?
