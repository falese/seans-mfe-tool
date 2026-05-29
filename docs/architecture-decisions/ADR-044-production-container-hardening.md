---
id: 0044
title: Production Container Hardening for Generated MFEs
status: Accepted
date: 2026-05-28
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [docker, nginx, kubernetes, security, deploy, generated-output, non-root]
summary: Generated MFE containers run as non-root on unprivileged nginx (port 8080), ship a hardened federation-aware nginx server block (security headers, gzip, /health, content-hash-friendly caching, remoteEntry CORS), and the Docker/compose/k8s artifacts are wired consistently (matching Dockerfile name, container port, readiness path, securityContext).
rationale-summary: The runtime/federation layer was production-capable but the packaging layer was not — the generated Dockerfile copied no nginx config and ran as root, the prod compose referenced a Dockerfile that was never written, and the nginx config lacked security headers and federation CORS. Hardening the generators makes every generated MFE production-ready by default.
long-form: true
---

# ADR-044: Production Container Hardening for Generated MFEs

## Context

A production-suitability audit of the generated MFEs (the abc-kids examples) and
the templates that produce them found that while the runtime contract
(`BaseMFE`, lifecycle, federation) is production-capable, the container/serving
layer was not:

- The plugin-generated Dockerfile (`generateDockerfile`) copied **no** nginx
  config and set no `USER`, so nginx ran as **root** with its default config —
  no SPA fallback, no security headers, no CORS on `remoteEntry.js` (which
  breaks cross-origin federation), and no `/health`.
- `deploy` wrote `nginx.production.conf` into the deploy directory, but the
  generated Dockerfile never copied it — the hardened config was dead.
- `docker-compose.production.yml` referenced `dockerfile: Dockerfile.production`
  while `deploy` wrote the file as `Dockerfile`, so `compose build` failed; its
  healthcheck also targeted the app port rather than the served port.
- The Kubernetes Deployment hardcoded the app port as `containerPort`, used a
  `/ready` readiness path that the nginx config does not serve (pod never
  becomes ready), and set no `securityContext`.
- API codegen defaulted CORS to `*`, offered file-based SQLite as a
  "production" database, did not pin the JWT verification algorithm, did not
  validate required secrets at boot, exposed no `/health`, and could leak 5xx
  error details.
- A federated remote mounts in its own React root, so a render-time throw inside
  it could not be caught by any host error boundary.

## Decision

1. **Non-root, unprivileged nginx for generated MFEs.** The React and Angular
   `DockerStrategy` use `nginxinc/nginx-unprivileged:alpine` (runs as uid 101,
   listens on 8080, writes pid/temp to writable paths). `DockerStrategy` gains
   `configFiles`, `runtimeSetup`, `user`, and `expose`; `generateDockerfile`
   emits them. The hardened nginx server block is copied **from the CLI builder
   image** so every generated MFE tracks the installed CLI version.

2. **Hardened federation-aware nginx server block** (`nginx.mfe.conf`):
   `listen 8080`; security headers (`X-Frame-Options`, `X-Content-Type-Options`,
   `Referrer-Policy`, `Permissions-Policy`) with documented CSP/HSTS to be tuned
   per deployment; gzip; `/health`; `remoteEntry.js` served with CORS and
   `no-store`; content-hashed assets served `immutable`; SPA fallback that
   preserves security headers (via `expires`, not `add_header`).

3. **Consistent Docker/compose/k8s wiring.** The prod compose builds the
   `Dockerfile` that `deploy` actually writes and maps to the container port
   (8080 for MFEs, the app port for APIs). The k8s Deployment uses the same
   container port, a `securityContext` (`runAsNonRoot`, dropped capabilities,
   no privilege escalation, `seccompProfile`), and a readiness path that exists
   (`/health` for MFEs, `/ready` for APIs).

4. **Content-hashed bundle filenames** in the rspack output so the immutable
   asset caching is safe; `remoteEntry.js` keeps its fixed name and is served
   no-cache.

5. **API hardening.** CORS defaults closed in production (no `*`); the server
   refuses to boot in production without an explicit `CORS_ORIGIN` and
   `JWT_SECRET`; JWT verification pins `algorithms: ['HS256']`; `/health` and
   `/ready` endpoints exist; 5xx error messages are generic in production while
   full detail is logged server-side; graceful shutdown handles SIGTERM/SIGINT.

6. **Runtime error boundary.** Remotes are mounted wrapped in an error boundary
   (`createErrorBoundary`) so a render-time failure shows a fallback within the
   remote's own root instead of tearing it down.

## Alternatives considered

- **Keep stock `nginx:alpine`, add `USER nginx`.** Rejected: the master process
  then cannot bind port 80 or write `/var/run/nginx.pid` without a chown dance;
  `nginxinc/nginx-unprivileged` solves this cleanly and is purpose-built.
- **Copy nginx config from the build context instead of the CLI image.**
  Rejected as the default: freshly generated MFEs have no local `nginx.conf`, so
  `build:docker` would fail on `COPY`. `deploy` still emits a local
  `nginx.conf` as a customizable reference/override.
- **Enforce a strict CSP in the generated config.** Rejected: Module Federation
  script/connect origins are deployment-specific; a hardcoded CSP would either be
  too loose to help or break federation. The config ships a documented CSP
  template to enable per environment.

## Consequences

### Positive

- Generated MFEs are non-root, federation-correct, and health-checkable by
  default; the prod compose and k8s manifests build and run as written.
- API services fail fast on missing production secrets rather than at first
  request, and do not leak internals.

### Tradeoffs / follow-ups

- Customizing the baked nginx config requires repointing the Dockerfile `COPY`
  at a local file (the default copies from the CLI image for version-sync).
- `eager: true` shared singletons are retained so remotes still run standalone;
  shell-only deployments can set `eager: false`. Documented in the rspack
  template, not changed here (requires end-to-end federation verification).
- Container runtime behavior is verified by unit tests and `docker build`
  reasoning, not by a live container run in this change.

## References

- ADR-035 — Docker build orchestration via Turborepo (build graph; this ADR
  governs the container *content*).
- ADR-036 — Framework plugins (`getDockerStrategy` lives here).
- PDR-001 — Generate, don't hand-write (generated artifacts must be production-ready).
