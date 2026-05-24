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

**[#164](https://github.com/falese/seans-mfe-tool/issues/164) — fix: seans-mfe-tool-cli image not rebuilt by docker compose build**

### Scope

The docker-compose.yaml service ordering fix was already landed in #163 (commit 93cb6ea). This session completes #164 by:

1. Expanding the root `.dockerignore` to exclude `src/`, `examples/`, `tests/`, `docs/`, `schemas/`, and `packages/*/node_modules/` from the CLI image build context. Without this, `docker compose build seans-mfe-tool-cli` ships ~300 MB of irrelevant files as build context before Dockerfile.cli even runs its first COPY.
2. Updating issue #164 body: replace placeholder `#<C>` with `#165`.

NOT changing: `Dockerfile.cli`, `docker-compose.yaml`, any MFE Dockerfiles, or any source/test files.

**Acceptance criteria (from issue):**
- `docker compose -f examples/abc-kids/docker-compose.yaml build` rebuilds `seans-mfe-tool-cli:latest` automatically ✅ (landed in #163)
- After changing a codegen template, no manual CLI image rebuild step is required ✅ (landed in #163)
- MFE builds fail fast with a clear error if CLI build fails, rather than silently using a stale image ✅ (landed in #163)

### ADR check

No existing ADR governs Docker build context optimization. This is an operational infrastructure fix. Waived — no new ADR required.

### Spec context

From `@docs/spec.md` — Docker note:

> `Dockerfile.cli` copies pre-compiled `dist/` into the image. Build context is the repo root; only `package.json`, `oclif.manifest.json`, `packages/`, `bin/`, `dist/` are consumed.

### Current file tree

```
.dockerignore     ← MODIFY (expand exclusions for CLI image build context)
```

### TDD order

No unit tests apply. Verification: `docker compose -f examples/abc-kids/docker-compose.yaml build seans-mfe-tool-cli` and confirm it completes in reasonable time with a small transferred context.

### Existing tests (summary)

No test coverage for Docker config. Verification gates: `npm run lint`, `npm run typecheck` (pre-existing failures unrelated to this change), `npm run build`.
