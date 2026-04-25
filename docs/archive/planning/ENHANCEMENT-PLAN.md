# seans-mfe-tool — Production Readiness Enhancement Plan

This plan upgrades seans-mfe-tool from an alpha-quality generator to a production-ready, full‑stack MFE platform with strong deployment, security, testing, and developer experience.

## Goals & Success Criteria

- Production deployments: Docker Compose and Kubernetes manifests generated and documented.
- Security-by-default: no weak secrets, safe defaults, and CI security checks.
- ≥80% test coverage across commands, generators, and build system.
- Stable DX: consistent lint/format, clear errors, interactive flows, and robust docs.
- Backwards compatibility for existing commands unless explicitly versioned.

## Current State (Summary)

- Core commands exist (shell, remote, api, build, deploy, spec); analyze removed per ADR-021.
- API generation strong; deploy production path incomplete; `init` stubbed.
- Tests improved; DSL modules at 100% coverage; ESLint/Prettier pending.
- Docs good breadth but missing production, security, and CI/CD guidance.

## Roadmap (Phased)

### Phase 1 — Critical Path (Weeks 1–2)

- Implement `init` workspace scaffolding (monorepo aware).
- Add ESLint/Prettier configs and wire to scripts.
- Secure secrets: generate JWT secrets and improve .env hygiene.
- Production deployment support: generate Docker/K8s templates + CLI integration.
- Standardize error handling (throw/return; minimize `process.exit`).

Exit criteria:

- `init` generates working workspace with docs/configs.
- `deploy --env production` writes Docker Compose or K8s assets and README.
- `.env` generation uses secure random secrets; `.env.example` warns appropriately.
- Lint passes in CI across repo.

### Phase 2 — Quality & Coverage (Weeks 3–4)

- Unit tests for generators, template processor, BuildManager, and commands.
- Integration tests: end‑to‑end command execution on a temp workspace (DSL remote E2E complete).
- E2E smoke: build generated shell/remote/api; verify dev server starts and basic routes.
- Analyze performance: reduce logging/complexity hot spots.

Exit criteria:

- Global coverage ≥80%; failing tests block CI (DSL modules at 100%).
- `analyze` runs on sample app within acceptable time and log volume.

### Phase 3 — Security & CI/CD (Weeks 5–6)

- GitHub Actions: lint, test, coverage, audit, release draft.
- Dependency updates automation (Dependabot/Renovate).
- Add container scanning job and `npm audit` gating.
- Production docs: hardening guide, secrets strategy, and rollouts.

Exit criteria:

- Main branch protected by CI; audit warnings visible.
- Release workflow produces artifacts and changelog.

### Phase 4 — Developer Experience & Extensibility (Weeks 7–8)

- TypeScript templates for shell/remote/api (JS as opt‑out).
- Inquirer-powered interactive modes for all commands.
- Custom template support (user‑provided templates with config contract).
- Optional: minimal plugin API for additional generators/targets.

Exit criteria:

- Users can scaffold TypeScript projects.
- Interactive flows cover 90% common scenarios.
- Documented template contract for extension.

## Detailed Work Items

### CLI & Commands

- `bin/seans-mfe-tool.js`: add stable validation + helpful errors; remove direct `process.exit()` in handlers.
- `src/commands/init.js`: workspace layout, root configs, README, example `mfe-spec.yaml`.
- `src/commands/deploy.js`: production path for Docker Compose and K8s using EJS templates; generate README with next steps; keep dev path intact.
- `src/commands/analyze.js`: reduce console spam; switch to batched status logs; convert sync globs to async where possible.

### Generators & Templates

- Add TS variants under `src/templates/react-ts/` and `src/templates/api-ts/`.
- Ensure templates include health endpoints: `/health`, `/ready` for K8s probes.
- Docker: multi‑stage production Dockerfiles for React/API; non‑root runtime; hardened nginx config.
- K8s: Deployment/Service/Ingress/HPA/ConfigMap/Secret templates; kustomization support.

### Security

- `src/utils/securityUtils.js`: secure key generation utilities (in use by API env generation).
- Secrets hygiene: `.env` vs `.env.example` with guidance.
- CI: `npm audit`, container scan, and dependency updates.
- Validate CLI inputs (ports, names, paths) with a small schema (e.g., zod/joi) to avoid unsafe params.

### Testing

- Unit: templateProcessor, BuildManager, route/controller/database generators, deploy orchestrators.
- Integration: run `init` → `generate`/`shell`/`remote`/`api` → `build` → assert output.
- E2E smoke: boot dev server in CI using headless mode and healthcheck.
- Mocks for fs/child_process/docker interactions; use tmp dirs.

### CI/CD

- GitHub Actions workflows:
  - `ci.yml`: node matrix, install, lint, test, coverage upload, audit.
  - `release.yml`: conventional commits, changelog, tag, publish (optional).
- Add badges to README for build/coverage.

### Documentation

- Command reference with all flags, examples, and exit codes.
- Production deployment guide (Docker/K8s), plus security hardening.
- Troubleshooting (ports, Docker issues, K8s ingress), and migration notes.
- ADRs for major decisions (Rspack, Module Federation strategy, templates). Updated ADR-048 (DSL-first) and ADR-046 (BFF Mesh) with implementation confirmations.

## Estimates (high level)

- Phase 1: 1–2 weeks
- Phase 2: 2 weeks
- Phase 3: 2 weeks
- Phase 4: 2 weeks

## Risks & Mitigations

- Docker/K8s variability → generate templates + clear README, avoid env‑specific defaults.
- CI flakiness with E2E → keep E2E minimal and cache deps; prefer smoke tests.
- Backwards compatibility → version flags, document changes, add deprecation notices.

## Tracking Checklist (excerpt)

- [ ] Prod deploy (compose/k8s) wired and documented
- [ ] `init` workspace scaffolding complete
- [ ] Secure secret generation everywhere
- [ ] Lint/format configs present and enforced
- [ ] ≥80% coverage and integration tests
- [ ] Analyze command performance tuned
- [ ] GitHub Actions for CI + audit + release
- [ ] TypeScript templates published
- [ ] Docs: command ref, production, security, troubleshooting

---

## Status Log (ongoing)

- Added: ESLint/Prettier configs at repo root.
- Implemented: `init` command (`src/commands/init.js`); wired in CLI.
- Secured: `.env` generation for API with random JWT secret and warnings.
- Added: production templates (`src/templates/docker/*`, `src/templates/kubernetes/*`).
- Implemented: production deployment paths in `deploy` (compose and k8s) + CLI flags.

2025-11-27 Updates:

- Implemented DSL-first remote commands: `remote:init`, `remote:generate`, `remote:generate:capability`.
- Validated manifest schema and generation; rspack exposes updated.
- Added acceptance criteria: `docs/acceptance-criteria/remote-mfe.feature`, `docs/acceptance-criteria/bff.feature`.
- Confirmed BFF command wiring and documented acceptance scenarios.

Next up (suggested):

- Standardize error handling patterns across commands.
- Add unit/integration tests focusing on new deploy/init flows.
- Create CI workflow (`.github/workflows/ci.yml`).

---

## Session 6 Addendum (2025-11-27)

### Immediate Actions

- Strengthen negative-path Jest tests for `src/commands/create-api.js` with edge OpenAPI specs.
- Create `docs/troubleshooting.md` to cover MF shared conflicts (React/MUI), CORS, and remoteEntry URL validation.
- Add a minimal E2E sanity script under `scripts/` to start a generated shell and remote, verify registration and remote loading.
- Provide a reproducible `mfe deploy` example in `examples/` with concise README.

### Dependencies

- Existing Jest setup and `__tests__/` mocks.
- Generated templates for shell/remote to be used in E2E sanity.

### Acceptance Criteria

- New tests fail on invalid/edge OpenAPI inputs and pass on fixed logic.
- Troubleshooting doc gives actionable steps for the three common issues and is linked from README.
- E2E script runs locally on macOS with zsh and reports success/failure succinctly.
- Deploy example can be built and run with one copy-paste command sequence.
