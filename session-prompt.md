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

**[#163](https://github.com/falese/seans-mfe-tool/issues/163) — fix: Angular Docker build fails "Missing script: build:server"**

### Scope

Add `seans-mfe-tool-cli` as a buildable service in `examples/abc-kids/docker-compose.yaml` so that `docker compose build` always rebuilds the CLI image before the MFE images that depend on it. Add `depends_on` for the CLI service to the four MFE services so Docker Compose enforces build order.

NOT changing: `Dockerfile.cli`, any MFE Dockerfiles, the generator code, or the `build` script content. This is a Docker Compose config change only.

**Acceptance criteria (from issue):**
- `docker compose -f examples/abc-kids/docker-compose.yaml up --build` completes without error
- Angular MFE container starts and `/health` returns 200

### ADR check

No existing ADR governs Docker Compose service-level build ordering. This change is an operational infrastructure fix (not a platform contract, bundler integration, lifecycle, or BFF decision). Waived — no new ADR required for this change.

Issue #165 (Turborepo task graph integration) is the architectural enhancement; that one will need an ADR before implementation.

### Spec context

From `@docs/spec.md` — Docker note:

> `dist/runtime/package.json` exports conditions must include `require`, `import`, and `default` so both webpack (Angular) and rspack (React) can resolve the package. See `scripts/copy-runtime-files.js`.

Runtime is published as `@seans-mfe-tool/runtime` from `dist/runtime/`. The CLI image (`seans-mfe-tool-cli:latest`) is built from `Dockerfile.cli` which copies the pre-compiled `dist/` directory. MFE Dockerfiles reference it via `FROM seans-mfe-tool-cli:latest AS cli-builder`.

### Current file tree

```
examples/abc-kids/docker-compose.yaml   ← MODIFY (add CLI service + depends_on)
```

### TDD order

No unit tests apply to Docker Compose config changes. Verification is by running the Docker build.

1. Implement: add `seans-mfe-tool-cli` service with `build: context: ../../..`
2. Implement: add `depends_on: - seans-mfe-tool-cli` to all four MFE services
3. Verify: `npm run build && docker compose -f examples/abc-kids/docker-compose.yaml build --no-cache` succeeds

### Existing tests (summary)

Docker config changes are not covered by the Jest test suite. Verification gates: `npm run lint`, `npm run typecheck`, `npm run build` (no schema changes; no source changes).
