---
id: 0014
title: Incremental TypeScript Migration
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [typescript, migration, codegen]
summary: New CLI code and recently-completed modules are written in TypeScript; existing JavaScript remains until touched, with ts-node inline registration enabling a mixed JS/TS codebase.
rationale-summary: Incremental migration delivers type safety where it matters most (DSL parsing, codegen) without the big-bang risk and scope creep of a full codebase rewrite.
long-form: true
---

# ADR-014: Incremental TypeScript Migration

## Context

The CLI codebase was originally JavaScript. Adding TypeScript for new modules (DSL parser, BFF generators, remote commands) delivers type safety where complexity is highest without forcing a big-bang migration of all existing code. Incremental migration avoids scope creep and velocity loss.

**Status:** Implemented (ongoing). DSL modules and remote commands delivered; CLI wired with ts-node inline registration.

## Decision

New CLI code is written in TypeScript. Existing JavaScript files are converted when touched (not proactively). The `allowJs: true` compiler option enables mixed JS/TS during the transition.

**Migration scope:**

| Component | Language | Notes |
|---|---|---|
| `src/dsl/` (new) | TypeScript | Parser, validator, generators |
| `src/commands/remote-*.ts` (new) | TypeScript | `remote:init`, `remote:generate` |
| `src/codegen/BffGenerator/` | TypeScript | Converted from JS |
| `src/commands/create-*.js` | JavaScript | Convert when modified |
| `src/utils/` | JavaScript | Convert when modified |
| `bin/seans-mfe-tool.js` | JavaScript | Commander entry point stays JS |

**TypeScript configuration:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "strict": false,
    "esModuleInterop": true,
    "allowJs": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

Note: `strict: false` — strictness rules are added incrementally as the codebase matures. This is intentionally different from the Agent Orchestrator (ADR-008) which uses full strict mode.

**Test configuration:**

```javascript
module.exports = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
```

**Migration order:**

1. Add TypeScript tooling (tsconfig, ts-jest, dependencies)
2. Convert `src/codegen/BffGenerator/*.js` to `.ts`
3. Create `src/dsl/` in TypeScript from the start
4. Convert other files as touched

## Consequences

**Positive:**
- Type safety where it matters most (DSL parsing, complex generators)
- No velocity impact — migration happens organically on touch
- RTK Query codegen expects TypeScript — natural fit for data layer
- Generated `.d.ts` files improve consumer DX

**Negative:**
- Mixed JS/TS codebase is less consistent during transition
- `strict: false` means some type safety benefits are deferred

## References

- Session 7 requirements elicitation
- ADR-008: TypeScript Strict Mode (Agent Orchestrator — intentionally stricter)
- ADR-009: Language Field and Template Selection
