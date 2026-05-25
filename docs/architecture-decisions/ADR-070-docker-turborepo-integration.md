# ADR-070: Docker Build Orchestration via Turborepo Task Graph

**Date:** 2026-05-24  
**Status:** Accepted

---

## Context

The `seans-mfe-tool` monorepo has three sequential Docker build steps:

1. Compile TypeScript → `dist/` (`npm run build`)
2. Package CLI binary + templates into `seans-mfe-tool-cli:latest` (`docker build -f Dockerfile.cli`)
3. Build MFE Docker images that consume `seans-mfe-tool-cli:latest` via `FROM`

These steps were previously managed manually, causing the class of failures tracked in issues #163 and #164: when step 2 was skipped or run from a stale `dist/`, MFE builds would use an outdated template, silently overwriting source files with old generated content.

Issue #164 fixed the immediate problem by adding `seans-mfe-tool-cli` as a service in `docker-compose.yaml`. This ensures `docker compose build` rebuilds the CLI image as part of the MFE build. But it does not automate step 1 (TypeScript compilation) and provides no input-hash caching — the CLI image is rebuilt on every `docker compose build` regardless of whether `dist/` changed.

The project already uses Turborepo (v2) for `build`, `test`, `lint`, and `typecheck` with a dependency graph and input-hash caching. The question is whether to bring Docker builds into the same graph.

---

## Decision

Add two tasks to the Turborepo task graph:

```json
"docker:build:cli": {
  "dependsOn": ["build"],
  "inputs": ["dist/**", "Dockerfile.cli", "package.json", "oclif.manifest.json"],
  "outputs": [],
  "cache": true
},
"docker:build:examples": {
  "dependsOn": ["docker:build:cli"],
  "inputs": [
    "examples/abc-kids/**/*",
    "examples/abc-kids/**/Dockerfile",
    "examples/abc-kids/docker-compose.yaml"
  ],
  "outputs": [],
  "cache": true
}
```

With corresponding scripts in root `package.json`:

```json
"docker:build:cli": "docker build -f Dockerfile.cli -t seans-mfe-tool-cli:latest .",
"docker:build:examples": "docker compose -f examples/abc-kids/docker-compose.yaml build"
```

The developer workflow becomes:

```bash
turbo run docker:build:examples          # full chain, only rebuilds what changed
turbo run docker:build:examples --force  # unconditional rebuild (CI/CD)
```

`docker:build:cli` depends on `build` (TypeScript compilation), so `turbo run docker:build:cli` also handles step 1 automatically. No manual `npm run build` prerequisite.

---

## Alternatives considered

### Option A: docker-compose service ordering only (#164)

`docker compose build` always rebuilds `seans-mfe-tool-cli:latest` on every invocation. Simple, but:
- Still requires `npm run build` to be run manually before `docker compose build`
- No input-hash caching: CLI image rebuilt even when `dist/` hasn't changed

Implemented as the immediate fix (#164). This ADR records the additional Turborepo layer on top.

### Option B: docker buildx bake

`docker buildx bake` provides a declarative build graph in HCL/JSON with multi-platform and cache export support. Advantages for CI pipelines targeting multiple platforms. Disadvantages:
- Separate toolchain from the Turborepo + pnpm setup already in place
- Input-hash caching would have to be implemented separately (bake does not do file-hash caching at the task level)
- Appropriate when the project needs multi-platform images or advanced registry workflows; not the current requirement

### Option C: Makefile

A `Makefile` with explicit `docker-cli` and `docker-examples` targets that list their prerequisites. Simple and universally understood, but:
- Introduces a third build tool alongside Turborepo and pnpm
- Make's dependency tracking is file-mtime-based; Turbo's is content-hash-based (more reliable)
- Would not benefit from Turborepo's remote cache if that is adopted later

### Option D: Inline CLI build in each MFE Dockerfile

Remove the separate `seans-mfe-tool-cli:latest` image; have each MFE Dockerfile build the CLI in a build stage from source. Eliminates the stale image problem entirely.

Rejected because: each MFE Docker build would compile the full TypeScript project (~10–30s), which multiplies across all MFEs. Keeping the CLI as a shared base image keeps MFE builds fast.

---

## Consequences

### Positive

- `turbo run docker:build:examples` is a single command that handles the full chain (compile, CLI image, MFE images) in dependency order.
- Turborepo's input-hash caching skips CLI image rebuild when `dist/` and `Dockerfile.cli` have not changed. This is the desired behavior when iterating on MFE source without changing the CLI.
- Aligns Docker builds with the existing Turborepo workflow; no new tooling.

### Tradeoffs

- **Docker image existence is not tracked by Turbo.** If `seans-mfe-tool-cli:latest` is deleted from the local Docker daemon, Turbo may report a cache hit (inputs unchanged) and skip rebuilding it. Mitigation: `turbo run docker:build:examples --force` forces all tasks to rerun.
- **`docker:build:examples` rebuilds `seans-mfe-tool-cli:latest` via docker-compose** even though Turbo already built it in the prior step. Docker's own layer cache makes this fast, but it is a redundant build invocation. Acceptable for a developer tool.
- **`npm run build` is no longer a separate prerequisite** for Docker builds when using `turbo run docker:build:cli`. However, `docker compose build` (without turbo) still requires manual `npm run build` first.

---

## References

- #163 — Bug: multiplication-quiz Docker build fails "Missing script: build:server"
- #164 — Bug: CLI image not rebuilt by docker compose build
- #165 — Enhancement: integrate Docker builds into Turborepo task graph
- ADR-069 — Pluggable bundler + framework via codegen variants (related: the CLI image embeds EJS templates that select the bundler/framework variant)
