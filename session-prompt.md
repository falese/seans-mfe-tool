# seans-mfe-tool — Session Prompt

> Update this file before each coding session. Hand it to the agent alongside CLAUDE.md.
> Keep CLAUDE.md open in every session. Reference @docs/spec.md only for sections relevant
> to the active issue.

---

## How to use this template

1. Fill in **Active issue** and **Scope** below
2. Run the ADR check — confirm which existing ADRs govern this work; if none exist for a decision, stop and create one (or waive explicitly)
3. Copy the relevant spec sections from `@docs/spec.md` into **Spec context**
4. Update **Current file tree** to reflect actual state
5. Hand `CLAUDE.md` + this file to the coding agent
6. After the session, update **Current state** in `CLAUDE.md` and any resolved decisions in `docs/spec.md`

---

## Session: 2026-05-24

### Active issue(s)

**[#165](https://github.com/falese/seans-mfe-tool/issues/165) — enhancement: integrate Docker builds into Turborepo task graph**

### Scope

Add `docker:build:cli` and `docker:build:examples` tasks to the Turborepo task graph so that `turbo run docker:build:examples` handles the full chain: TypeScript compilation → CLI Docker image → MFE Docker images. Write ADR-070 covering the Turborepo approach and the tradeoffs considered (docker-compose-only, docker buildx bake, Makefile).

NOT changing: any MFE source files, Dockerfiles, the `seans-mfe-tool-cli` service added in #164, the existing Turbo tasks (`build`, `test`, `lint`, `typecheck`).

**Acceptance criteria:**
- `turbo run docker:build:examples` builds CLI image then MFE images in correct dependency order
- CLI image rebuild is skipped when `dist/` inputs haven't changed (Turbo cache hit)
- ADR-070 written
- `CLAUDE.md` dev commands table updated

### ADR check

No existing ADR (022, 058–069) covers Docker build orchestration. Writing ADR-070 as part of this session.

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-070 (new) | Docker+Turborepo integration for CLI and MFE image builds | Docker build orchestration |

### Spec context

From `@docs/spec.md` — Hardware and runtime:

> Dev entry: `bun bin/dev.ts` (no transpile)  
> Published entry: `bin/run.js` (pure Node, loads `dist/commands/`)  
> Build output: `dist/` (TypeScript → CJS)

The `seans-mfe-tool-cli:latest` Docker image copies pre-compiled `dist/` from the repo root. All MFE Dockerfiles reference it via `FROM seans-mfe-tool-cli:latest AS cli-builder`.

### Current file tree

```
docs/architecture-decisions/ADR-070-docker-turborepo-integration.md   ← CREATE
turbo.json                                                              ← MODIFY
package.json                                                            ← MODIFY (scripts only)
CLAUDE.md                                                               ← MODIFY (dev commands table)
```

### TDD order

No unit tests apply. Verification: `turbo run docker:build:examples` completes successfully; run again with no changes and confirm Turbo reports cache hits.

### Existing tests (summary)

No test coverage for build tooling config. Verification gate: `npm run build` still passes (no turbo.json change should break it).
