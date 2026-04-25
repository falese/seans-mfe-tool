# Merge Plan — Phased Path to a Unified Platform Monorepo

This document describes how `Falese/daemon`, `Falese/coder`, and this CLI repo
converge into a single monorepo.  Each phase has concrete prerequisites; none
can be skipped.

---

## Decision log: why plugin-first ahead of immediate merge

The platform started as three independent repos because each had a different
release cadence, language runtime, and team ownership.  Forcing a monorepo
merge at this stage would:

- Break independent deployment of the daemon (long-running process) vs the
  CLI (short-lived tool)
- Require agreeing on a single lint/TS/test baseline before any new feature
  ships
- Make the npm publish surface of `@seans-mfe/contracts` and
  `@seans-mfe/oclif-base` dependent on a monorepo migration landing

The plugin-first path (this repo) is reversible: if the monorepo never
happens, the federated plugin model still works forever.  The merge can be
triggered by the Phase 2 prerequisites below without any code being in the
wrong state.

---

## Phase 1 — Federated (current, after C1–C6)

Three repos remain independent; the CLI acts as the integration hub.

### What ships in this phase

| Package | Repo | Publish target |
|---------|------|----------------|
| `seans-mfe-tool` (CLI) | this repo | npm (binary) |
| `@seans-mfe/contracts` | this repo (`packages/contracts/`) | npm (library) |
| `@seans-mfe/oclif-base` | this repo (`packages/oclif-base/`) | npm (library) |
| `@falese/daemon-plugin` | `Falese/daemon` | npm (oclif plugin) |
| `@falese/coder-plugin` | `Falese/coder` | npm (oclif plugin) or `@falese/coder-mcp` (Bun-native MCP server) |

### Integration model

1. `Falese/daemon` and `Falese/coder` add `@seans-mfe/contracts` as a dep and
   implement commands that extend `BaseCommand` from `@seans-mfe/oclif-base`.
2. End users install plugins: `seans-mfe-tool plugins install @falese/daemon-plugin`.
3. Agents use `seans-mfe-tool mcp serve` which federates tools from all sources.

### Phase 1 success criteria

- [ ] `@seans-mfe/contracts` published to npm with stable semver
- [ ] `@seans-mfe/oclif-base` published to npm with stable semver
- [ ] `@falese/daemon-plugin` passes `plugins link` + `--json` envelope test
- [ ] `@falese/coder-plugin` (or `@falese/coder-mcp`) passes MCP federation test
- [ ] All three repos have green CI running `turbo run test build`

---

## Phase 2 — Monorepo consolidation

Move all three repos into a single git repository under `apps/` and `packages/`.

### Prerequisites (must all be true before starting)

- [ ] **Contract stability**: `@seans-mfe/contracts` has had no breaking changes
  (major bumps) for ≥ 30 calendar days.
- [ ] **Shared lint baseline agreed**: ESLint config (`eslint.config.js`),
  Prettier config, and commit-lint rules are identical across all three repos.
- [ ] **Shared TS baseline agreed**: `tsconfig.base.json` with target, module,
  strict, lib agreed and adopted by all three repos.
- [ ] **Shared Jest baseline agreed**: jest.config base with coverage thresholds
  and test-match patterns agreed and adopted.
- [ ] **E2E test in CI**: at least one green E2E test that:
  - Installs `@falese/daemon-plugin` into the CLI
  - Runs a daemon command via `seans-mfe-tool daemon:start --json`
  - Asserts the `CommandResult` envelope shape
- [ ] **Changelog entries**: each repo has at least two release cycles with
  correct CHANGELOG.md entries (demonstrates the release process works).

### Migration steps

1. Create `apps/` and move this CLI repo to `apps/cli/`.
2. Import `Falese/daemon` history into `apps/daemon/` using `git subtree add`
   (preserves commit history).
3. Import `Falese/coder` history into `apps/coder/` using `git subtree add`.
4. Move shared packages to `packages/`: contracts, oclif-base, and add
   `packages/telemetry`, `packages/config` as needs emerge.
5. Update all workspace cross-references to `workspace:*` (pnpm).
6. Run `turbo run test build` — fix failures until green.
7. Tag `v2.0.0-monorepo` and freeze the individual repos (archive them).

### Shared config files that must align before Phase 2

| File | Owner repo today | Action |
|------|-----------------|--------|
| `eslint.config.js` | this repo | copy to daemon + coder, agree on rules |
| `tsconfig.base.json` | create in this repo | extend in all three |
| `jest.config.base.js` | create in this repo | extend in all three |
| `.github/workflows/ci.yml` | this repo | mirror to daemon + coder |
| `turbo.json` | this repo | copy to daemon + coder (adjust tasks) |

---

## Phase 3 — Unified versioning

Move to [Changesets](https://github.com/changesets/changesets) for coordinated
releases across all packages and apps.

### Prerequisites

- [ ] Phase 2 complete and stable for ≥ 2 releases.
- [ ] All packages have individual `CHANGELOG.md` files.
- [ ] Changesets bot configured in GitHub Actions.

### What changes

- Each PR that touches a package adds a Changesets file (`.changeset/*.md`)
  describing the semver impact.
- Release workflow: `pnpm changeset version` bumps packages; `pnpm changeset publish`
  publishes affected packages in dependency order (turbo handles build order).
- `@falese/*` plugins release independently from `@seans-mfe/*` packages.
- Individual repo releases deprecated; `Falese/daemon` and `Falese/coder`
  become archived read-only mirrors.
- Issue tracking consolidates into this monorepo.
- Single `seans-mfe` platform brand surfaces in all package descriptions.

---

## Contacts and review gates

Before starting Phase 2, this document must be reviewed and signed off by all
three repo maintainers.  Open a tracking issue with this document linked and
collect sign-offs before any migration tooling runs.
