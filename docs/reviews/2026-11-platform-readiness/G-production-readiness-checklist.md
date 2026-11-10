# G. Production Readiness Checklist

**Statuses:** Ready · Partially ready · Not ready · Not evaluated · Not applicable.

"Initial" marks what is needed before a first external adopter. "Later" can follow.

## Summary

| Status | Count |
|---|---|
| Ready | 14 |
| Partially ready | 15 |
| Not ready | 28 |
| Not evaluated | 4 |
| Not applicable | 2 |

## Build and release

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Deterministic install in CI | Ready | `npm ci` from a committed lockfile in every job of `test.yml` | |
| Reproducible build of the CLI | Partially ready | `npm run build` is one ordered script. `tsc -b` incremental state and a stale-build trap are documented in `CLAUDE.md` | Initial |
| Reproducible CLI image | Not ready | `Dockerfile.cli` runs `npm install` without the lockfile | Initial |
| Generated artifacts match source | Ready | Seventeen generate-and-diff gates in the `quality` job | |
| Publishable package shape | Partially ready | `check:publish-shape` packs four packages and generates from the tarballs. The root package and runtime are not publishable (ARC-01) | Initial |
| Versioning scheme | Not ready | Root is 1.0.0, packages 0.1.0, no tags, MCP reports a literal version | Initial |
| Release automation | Not ready | No release workflow | Initial |
| Changelog | Not ready | None | Initial |
| Artifact provenance, SBOM | Not ready | None | Later |

## Distribution and installation

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| CLI installable from a registry | Not ready | Ten `file:` dependencies in root `package.json` | Initial |
| Runtime installable from a registry | Not ready | `private: true`; ADR-064 deferred | Initial |
| Third-party plugin can depend on the base | Not ready | `oclif-base` and `contracts` unpublished | Initial |
| Supported Node versions stated once | Partially ready | `engines >=20`; docs say 18; `.nvmrc` 22 (QC-01) | Initial |
| Cross-platform support | Not evaluated | Bash gate scripts, POSIX paths, shell strings. Windows likely broken | Later |

## Compatibility and upgrade

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Breaking-change detection in user code | Ready | `PLATFORM_MIGRATIONS` and `mfe:validate` (ADR-082) | |
| Generated-file regeneration | Ready | `check:mfe-drift`, ownership through `overwrite` | |
| Compatibility guarantees stated | Not ready | No stability labels or semver policy | Initial |
| Upgrade guide | Not ready | None | Later |
| Rollback | Not applicable | The CLI is stateless. Rolling back is installing the prior version, once versions exist | |

## Configuration

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Project configuration validated | Ready | Zod schema, generated JSON Schema and field reference | |
| Composition configuration validated | Ready | `compose:validate --check` in CI | |
| Environment variables documented | Not ready | No reference; at least eight are read | Initial |
| Configuration precedence defined | Not ready | No single model | Later |

## Observability and diagnostics

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Structured CLI results | Ready | `CommandResult` with correlation and trace ids | |
| Trace propagation | Ready | `TRACEPARENT` adopted and forwarded (ADR-081) | |
| Structured logging in the CLI | Partially ready | A logger exists; commands mostly use `console` and `chalk` | Later |
| CLI telemetry | Not ready | The hook sends a mutation the daemon lacks (ARC-05) | Later, or remove |
| Daemon logging | Partially ready | Structured, with event codes | |
| Registry logging | Not ready | `console.log` with emoji | Initial if the control plane is in scope |
| Health and readiness endpoints | Partially ready | `GET /` on both services returns counts. Generated BFF has `/health` and a Docker `HEALTHCHECK`. No readiness distinction | Initial if in scope |
| Metrics | Not ready | None found | Later |
| Environment diagnostics | Not ready | No `doctor` for the toolchain | Later |

## Reliability

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Lifecycle state machine correctness | Partially ready | 40 test files in `packages/runtime`, 90% branch threshold on `base-mfe.ts`. Tests were **not run** in this review | |
| Hook timeout and retry | Ready | `timeout-wrapper.ts`, `retry-wrapper.ts`, per-hook policy (ADR-029, ADR-030) | |
| MCP timeout | Partially ready | Per-call timeout exists. No cancellation, grandchildren survive (SEC-06) | Initial |
| Control-plane state durability | Not ready | In memory only | Initial if in scope |
| Control-plane graceful shutdown | Not ready | No signal handling found in either service | Initial if in scope |
| Control-plane test coverage | Not ready | No test files in `packages/control-plane` | Initial if in scope |
| Generated API graceful shutdown | Ready | `plugin-api/templates/api/base/src/index.js:80-91` | |
| Generated BFF graceful shutdown | Not evaluated | No signal handler found in `server.ts.ejs`; Mesh may provide one | |
| Resource limits | Not ready | No body or rate limits on registry, daemon or workspace API | Initial if in scope |

## Security maintenance

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Command execution safety | Not ready | SEC-01 | Initial |
| Agent exposure controls | Not ready | SEC-06 | Initial |
| Control-plane authentication | Not ready | SEC-02 | Initial if in scope |
| Secret hygiene in logs | Not ready | SEC-04 | Initial |
| Dependency vulnerability status | Not evaluated | `npm audit` not run | Initial |
| Dependency update automation | Not ready | No Dependabot or Renovate | Initial |
| CI least privilege | Partially ready | Job-level `permissions` on two jobs. No workflow-level default. Mutable Action tags | Initial |
| Security policy | Not ready | No `SECURITY.md` | Initial |
| Container hardening | Partially ready | Generated BFF and API images run non-root. Control-plane and CLI images run as root | Later |

## Testing

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Unit tests on core packages | Partially ready | 255 root test files. Results **not verified** here | |
| Command contract tests | Ready | Registry-driven conformance sweep and schema validation with ajv | |
| Real composition end to end | Partially ready | `composition.yml` drives two fleets in Chromium. Not reviewed in detail | |
| Generated code compiles | Ready | `check:template-typecheck`, plus Swift, Rust and WASM jobs | |
| Install-as-a-user test | Not ready | Nothing installs the packed CLI and scaffolds from it | Initial |
| Coverage measurement scope | Partially ready | Threshold covers a subset of packages (QC-03) | Later |
| Performance baseline | Not evaluated | `tests/performance` runs in CI and uploads a log. No thresholds were seen | Later |

## Supportability

| Capability | Status | Evidence | Needed |
|---|---|---|---|
| Decision record | Ready | 120 ADRs, generated index, CI governance comment | |
| Troubleshooting guide | Not ready | Only an archived runbook | Initial |
| Contribution guide | Partially ready | `CLAUDE.md` is thorough but written for an agent. No `CONTRIBUTING.md` | Later |
| Issue templates | Ready | Bug, feature, requirement | |
| Ownership | Partially ready | One maintainer (inference). No `CODEOWNERS` | Later |
| SLA or support channel | Not applicable | Not a hosted service | |

## Reading the checklist

Rows marked "Initial if in scope" all depend on one decision: whether the control plane is a product or a reference. That decision removes or confirms seven Not-ready rows at once.

Without the control plane, the gap to a first external adopter is: distribution (4 rows), versioning and release (3), the three security fixes, dependency scanning, and three documents.
