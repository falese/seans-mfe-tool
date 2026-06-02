# Architecture Archaeology and ADR Standardization

## 1. Assumptions and Clarifications

- The target repository is [seans-mfe-tool](/Users/sean/Documents/Development/seans-mfe-tool).
- Include scope is the full repository.
- Primary architecture inference excludes generated or derived artifacts except where they are themselves evidence of runtime packaging, enforcement, or policy drift. This means `coverage/`, `dist/`, and generated schemas are cited sparingly.
- The target ADR output location is [docs/architecture-decisions](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions).
- The required external Sondrate monorepo ADR source was not fetchable from this environment using the provided repository URL. Until a verifiable source is available, this document treats the repository's current ADR corpus as the operational standard and flags that fallback explicitly.
- The repository already contains accepted and in-flight ADRs through `ADR-044`, so proposed ADRs in this tranche start at `ADR-045`.

## 2. Standards Applied

### Local ADR convention inferred from repository evidence

Directory placement:
- ADRs live in [docs/architecture-decisions](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions) as individual markdown files.
- The local register points contributors to the canonical index in [docs/spec.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/spec.md) and says numbering comes from the next free slot in that index, per [docs/architecture-decisions/README.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/README.md#L21).

File naming convention:
- `ADR-NNN-kebab-case-title.md`, for example [docs/architecture-decisions/ADR-044-production-container-hardening.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-044-production-container-hardening.md).

Frontmatter schema observed across local ADRs:
- `id`: zero-padded numeric string, for example `0044` in [docs/architecture-decisions/ADR-044-production-container-hardening.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-044-production-container-hardening.md#L2)
- `title`: string, for example in [docs/architecture-decisions/ADR-015-oclif-migration.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-015-oclif-migration.md#L3)
- `status`: string, required
- `date`: `YYYY-MM-DD`, required
- `deciders`: string array, required
- `enforcement`: string, observed values include `code` and `convention`
- `supersedes`: array, always present
- `superseded-by`: array, always present
- `tags`: string array, required
- `summary`: string, required
- `rationale-summary`: string, required
- `long-form`: boolean, required

Allowed status values observed in the repository:
- `Accepted`
- `Implemented`
- `Proposed`
- `Deferred`
- `Planned`
- `In Progress`

Evidence:
- [docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md#L1)
- [docs/architecture-decisions/ADR-037-tdd-always.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-037-tdd-always.md#L1)
- [docs/architecture-decisions/ADR-044-production-container-hardening.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-044-production-container-hardening.md#L1)
- status scan from all ADR files via repository search

Required body sections inferred from local ADRs:
- Heading: `# ADR-NNN: Title`
- `## Context`
- `## Decision` or equivalent decision statement section
- `## Consequences` or an equivalent outcome/consequence section
- `## References`
- Some long-form ADRs also include `## Alternatives considered`

Fallback note:
- This is a repository-local ADR convention, not a verified extract from the inaccessible Sondrate source. If the external source later differs, these proposed ADRs should be normalized to that source of truth.

## 3. Codebase Inventory

### Languages and runtimes

| Area | Observed standard | Evidence |
| --- | --- | --- |
| Primary language | TypeScript with mixed JS/TS migration | [tsconfig.json](/Users/sean/Documents/Development/seans-mfe-tool/tsconfig.json#L1), [docs/architecture-decisions/ADR-014-incremental-typescript-migration.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-014-incremental-typescript-migration.md#L1) |
| Compiler target | ES2020, CommonJS | [tsconfig.json](/Users/sean/Documents/Development/seans-mfe-tool/tsconfig.json#L2) |
| Strictness | `strict: false` globally | [tsconfig.json](/Users/sean/Documents/Development/seans-mfe-tool/tsconfig.json#L6) |
| Published runtime | Node entrypoint in `bin/run.js` | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L4), [docs/architecture-decisions/ADR-020-bun-node-split.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-020-bun-node-split.md) |
| Development runtime | Bun dev entry | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L19), [bin/dev.ts](/Users/sean/Documents/Development/seans-mfe-tool/bin/dev.ts) |
| CI-tested Node lines | 20.x and 22.x | [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L14) |

### Build tools, task runners, and workspace management

| Area | Observed standard | Evidence |
| --- | --- | --- |
| Package manager declaration | npm 10.8.1 | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3) |
| Workspace definition | pnpm workspace file includes `packages/*` and root | [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml) |
| Task runner | Turborepo task graph with cached `build`, `test`, `lint`, `typecheck`, Docker tasks | [turbo.json](/Users/sean/Documents/Development/seans-mfe-tool/turbo.json#L1) |
| Primary build | `tsc`, runtime file copy, dist shim cleanup, oclif manifest generation, schema generation | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L10) |
| Schema generation | `scripts/generate-schemas.ts` | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L11) |
| Babel role | Test transform only | [jest.config.js](/Users/sean/Documents/Development/seans-mfe-tool/jest.config.js#L15), [babel.config.js](/Users/sean/Documents/Development/seans-mfe-tool/babel.config.js#L1) |

### Test frameworks and quality gates

| Area | Observed standard | Evidence |
| --- | --- | --- |
| Unit/integration tests | Jest with `ts-jest` and `babel-jest` | [jest.config.js](/Users/sean/Documents/Development/seans-mfe-tool/jest.config.js#L1) |
| E2E tests | Playwright against static fixture page | [playwright.config.ts](/Users/sean/Documents/Development/seans-mfe-tool/playwright.config.ts#L1) |
| Performance suite | Node script invoked by `npm run test:perf` | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L16) |
| Coverage thresholds | Global 80% plus stricter file-specific thresholds | [jest.config.js](/Users/sean/Documents/Development/seans-mfe-tool/jest.config.js#L69) |
| Linting | ESLint flat config | [eslint.config.js](/Users/sean/Documents/Development/seans-mfe-tool/eslint.config.js#L1) |
| Formatting | Prettier on `src/**/*` | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L18) |
| Typechecking | Dedicated `tsconfig.typecheck.json` | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L21), [tsconfig.typecheck.json](/Users/sean/Documents/Development/seans-mfe-tool/tsconfig.typecheck.json#L1) |

### CI/CD and pipeline conventions

| Area | Observed standard | Evidence |
| --- | --- | --- |
| CI platform | GitHub Actions only | [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L1) |
| Workflow coverage | Test, e2e, perf, examples, quality jobs | [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L8) |
| PR feedback | Workflow posts test results as a PR comment | [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L47) |
| Required quality gates | lint, typecheck, build, schema drift in CI | [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L157) |
| Missing publish/release workflow | no workflow besides `test.yml` | [.github/workflows](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows) |

### Container and deployment config

| Area | Observed standard | Evidence |
| --- | --- | --- |
| CLI container | dedicated `Dockerfile.cli` | [Dockerfile.cli](/Users/sean/Documents/Development/seans-mfe-tool/Dockerfile.cli) |
| Example deployment | docker compose for abc-kids examples | [examples/abc-kids/docker-compose.yaml](/Users/sean/Documents/Development/seans-mfe-tool/examples/abc-kids/docker-compose.yaml) |
| Generated deployment artifacts | `deploy` command writes Dockerfile, compose, nginx, env template | [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L300) |
| Runtime hardening standard | codified in ADR-044 | [docs/architecture-decisions/ADR-044-production-container-hardening.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-044-production-container-hardening.md) |
| Missing infra-as-code standard | no Helm, Terraform, CDK, Pulumi found | repository file search |

### First-party internal packages and platform modules

| Package or module | Role | Evidence |
| --- | --- | --- |
| `@seans-mfe/contracts` | typed errors, envelope, shared contracts | [packages/contracts/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/package.json#L1), [packages/contracts/src/errors/index.ts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/src/errors/index.ts#L1) |
| `@seans-mfe/oclif-base` | `BaseCommand`, JSON output helpers | [packages/oclif-base/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/oclif-base/package.json#L1) |
| `@falese/bff-plugin` | oclif plugin with `bff:*` commands | [packages/bff-plugin/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/bff-plugin/package.json#L1) |
| `@seans-mfe/framework-react` | React framework plugin | [packages/framework-react/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/framework-react/package.json#L1) |
| `@seans-mfe/framework-angular` | Angular framework plugin | [packages/framework-angular/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/framework-angular/package.json#L1) |
| runtime platform | `BaseMFE`, `RemoteMFE`, `AngularRemoteMFE`, context, ws client | [src/runtime/base-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/base-mfe.ts#L1), [src/runtime/remote-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/remote-mfe.ts), [src/runtime/angular-remote-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/angular-remote-mfe.ts) |

### Architecturally significant third-party dependencies

| Dependency | Role | Evidence |
| --- | --- | --- |
| `@oclif/core` | CLI framework | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L72) |
| `zod` | manifest and schema validation | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L83), [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L1) |
| `ejs` | code generation templates | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L77) |
| `js-yaml` | manifest parsing | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L81) |
| `jsonwebtoken` | JWT-related logic and type system validation | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L82) |
| `@apidevtools/swagger-parser` | OpenAPI parsing in API command | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L67) |
| `jest` and `ts-jest` | unit test toolchain | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L96), [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L104) |
| `@playwright/test` | e2e testing | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L86) |

### Cross-cutting concerns

| Concern | Current state | Evidence |
| --- | --- | --- |
| Logging | ADR says no `console.log` in production code, but command implementations still use direct console output | [docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md), [src/commands/remote/generate.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/remote/generate.ts#L16) |
| Error handling | typed error hierarchy and JSON envelope are dominant | [packages/contracts/src/errors/index.ts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/src/errors/index.ts#L1), [docs/architecture-decisions/ADR-017-typed-error-hierarchy.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-017-typed-error-hierarchy.md), [docs/architecture-decisions/ADR-018-command-result-envelope.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-018-command-result-envelope.md) |
| Config validation | strong manifest validation via Zod, weak process env validation | [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L1), [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L46), [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399) |
| Secrets | production env template emits placeholder secrets, but no central secrets policy | [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399) |
| Observability | schemas exist for Prometheus and OpenTelemetry; enforcement and implementation are partial | [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279) |
| Feature flags | no first-party feature-flag abstraction found | repository search |

## 4. Dominant Pattern Summary

| Area | Dominant pattern | Evidence | Confidence | Notes |
| --- | --- | --- | --- | --- |
| CLI architecture | oclif with a shared `BaseCommand` contract and machine-readable envelope | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L38), [docs/architecture-decisions/ADR-015-oclif-migration.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-015-oclif-migration.md), [docs/architecture-decisions/ADR-016-base-command-pattern.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-016-base-command-pattern.md) | High | Local shim [src/oclif/BaseCommand.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/oclif/BaseCommand.ts#L1) indicates a transitional release pattern. |
| Machine-readable execution | child-process isolation plus single-line `CommandResult<T>` stdout | [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L1), [docs/architecture-decisions/ADR-018-command-result-envelope.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-018-command-result-envelope.md), [docs/architecture-decisions/ADR-019-mcp-child-process-isolation.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-019-mcp-child-process-isolation.md) | High | This is one of the strongest codified patterns in the repo. |
| Runtime abstraction | `BaseMFE` abstract platform contract with framework-specific concrete implementations | [src/runtime/base-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/base-mfe.ts#L1), [src/runtime/remote-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/remote-mfe.ts), [src/runtime/angular-remote-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/angular-remote-mfe.ts) | High | Runtime package publishing is still structurally uneven because it is under `src/runtime` rather than a standalone `packages/runtime` manifest. |
| Extension model | plugin-first architecture with built-in and external framework plugin resolution | [src/framework/loader.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/framework/loader.ts#L1), [docs/architecture-decisions/ADR-022-plugin-first-architecture.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-022-plugin-first-architecture.md), [docs/architecture-decisions/ADR-036-framework-plugins.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-036-framework-plugins.md) | High | Built-ins are loaded from `packages/*`; third-party plugins fall back to package resolution. |
| Validation model | Zod-backed DSL schema as the primary contract surface | [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L1), [src/dsl/validator.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/validator.ts) | High | Strong for manifests, weak for runtime environment variables. |
| Build orchestration | npm scripts with Turborepo task graph and TypeScript compilation | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L8), [turbo.json](/Users/sean/Documents/Development/seans-mfe-tool/turbo.json#L1) | High | pnpm workspace exists, but package manager declaration is npm. |
| Test strategy | Jest for unit/integration, Playwright for e2e, CI-enforced quality workflow | [jest.config.js](/Users/sean/Documents/Development/seans-mfe-tool/jest.config.js#L1), [playwright.config.ts](/Users/sean/Documents/Development/seans-mfe-tool/playwright.config.ts#L1), [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L1) | High | TDD is explicitly documented by ADR-037, but enforcement remains partly conventional. |
| Error taxonomy | typed errors from contracts package, not raw `Error`, for command-facing flows | [packages/contracts/src/errors/index.ts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/src/errors/index.ts#L1), [docs/architecture-decisions/ADR-017-typed-error-hierarchy.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-017-typed-error-hierarchy.md) | High | Runtime implementations still throw raw `Error` in some spots, which is acceptable for internal platform boundaries but not for command boundaries. |
| Logging intent | structured, stderr-routed logging | [docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md) | Medium | The implementation materially deviates in command code. |
| Deployment output | generated Docker/compose/nginx artifacts are the delivery mechanism | [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L300), [docs/architecture-decisions/ADR-044-production-container-hardening.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-044-production-container-hardening.md) | High | Infra provisioning standard is still absent. |

## 5. Deviation Report

| DEV-ID | Area | Expected Pattern | Observed Deviation | Evidence | Impact | Intentional/Legacy/Accidental | Recommendation | Linked ADR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEV-001 | Logging | Production code in `src/` and `packages/` should avoid `console.log` and `console.error` | Command implementations still print directly to stdout/stderr with `console.log` and `console.error` | [docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md), [src/commands/remote/generate.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/remote/generate.ts#L16), [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L307) | Risks corrupting JSON output contracts and weakens consistent observability | Legacy / accidental | Tighten enforcement in lint and migrate commands to `BaseCommand` logging methods or shared structured logger | ADR-039 plus follow-up enforcement work |
| DEV-002 | Package management | Workspace manager and package manager should be singular and pinned | Root declares `npm@10.8.1` while repo also defines `pnpm-workspace.yaml`; no local Node version pin file exists | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3), [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml), [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L14) | Confusing contributor workflow and non-reproducible local environments | Legacy transition | Ratify one package-manager/runtime pinning standard and enforce it via repo files and CI | ADR-045 |
| DEV-003 | Package boundaries | First-party shared runtime modules should have explicit package boundaries if they are part of the published platform | Runtime lives under `src/runtime` and is treated like a package in docs, but no `packages/runtime/package.json` exists | [CLAUDE.md](/Users/sean/Documents/Development/seans-mfe-tool/CLAUDE.md), [src/runtime/index.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/index.ts), missing [packages/runtime](/Users/sean/Documents/Development/seans-mfe-tool/packages/runtime) package manifest | Blurs publishability, ownership, and dependency direction | Legacy / in-progress | Either formalize runtime as a package or explicitly document why it remains source-coupled to the CLI | Future ADR candidate |
| DEV-004 | Config validation | Contract surfaces should be validated via typed schemas before runtime use | Manifest config is strongly validated, but runtime env and secret loading are assembled from raw `process.env` or emitted templates without central validation | [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279), [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L46), [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399) | Boot-time misconfiguration, secret leakage risk, inconsistent failure modes | Accidental | Introduce a repository-wide env loading and validation policy | ADR-046 |
| DEV-005 | Ownership and review routing | Critical architectural paths should have explicit owners and review routing | No `CODEOWNERS` file exists anywhere in the repo | repository search showed no [CODEOWNERS](/Users/sean/Documents/Development/seans-mfe-tool/.github) file | Architectural drift can merge without domain review | Gap / accidental | Add CODEOWNERS and required-review coverage for architecture-critical paths | ADR-047 |
| DEV-006 | Release governance | Repo with multiple first-party packages should have explicit release/versioning and publish automation policy | No release workflow, changelog policy, or automated dependency-update policy found | [.github/workflows](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows), missing `CHANGELOG.md`, missing Renovate/Dependabot config | Manual release handling and stale dependency risk | Gap | Add explicit release/versioning and dependency update policies | ADR-048, ADR-049 |

### Deviation deep dives

#### DEV-001: Logging policy is codified more strongly than it is enforced

The repository has an accepted standard that production code should not use `console.log` or `console.error`, documented in [docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md). That standard is consistent with the machine-readable output contract in [docs/architecture-decisions/ADR-018-command-result-envelope.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-018-command-result-envelope.md) and the child-process parsing model in [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L69).

Actual command implementations still rely heavily on direct console output:
- [src/commands/remote/generate.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/remote/generate.ts#L16)
- [src/commands/remote/init.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/remote/init.ts#L24)
- [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L39)
- [src/commands/bff/init.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/bff/init.ts#L21)

The current ESLint config explicitly disables `no-console` globally in [eslint.config.js](/Users/sean/Documents/Development/seans-mfe-tool/eslint.config.js#L39), which means the written architecture rule is not actually enforced by the primary static gate. This looks like legacy drift from the transition into the `BaseCommand` model rather than a deliberate exception. The recommendation remains to ratify ADR-039 operationally by introducing a targeted lint rule or migration plan for command surfaces.

#### DEV-002: Toolchain standard is split across three sources of truth

The intended contributor toolchain is not singular:
- root package manager declaration in [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3)
- workspace topology in [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml)
- CI runtime matrix in [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L14)

This is not a runtime bug, but it is architecture drift because it weakens reproducibility and increases the odds of local-only failures. There is also no checked-in local runtime pin file, so contributors have to infer a default from CI rather than follow an explicit repo standard. That is the root reason ADR-045 is framed as a standardization ADR rather than a net-new capability ADR.

#### DEV-003: Runtime is treated as a package conceptually but not structurally

Project documentation describes a runtime platform package, including package-level imports in [CLAUDE.md](/Users/sean/Documents/Development/seans-mfe-tool/CLAUDE.md) and [docs/spec.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/spec.md). The implementation surface, however, lives under [src/runtime](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime) rather than a manifest-backed workspace package. Meanwhile the actual workspace packages with package manifests are limited to [packages/contracts/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/package.json#L1), [packages/oclif-base/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/oclif-base/package.json#L1), [packages/framework-react/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/framework-react/package.json#L1), [packages/framework-angular/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/framework-angular/package.json#L1), and [packages/bff-plugin/package.json](/Users/sean/Documents/Development/seans-mfe-tool/packages/bff-plugin/package.json#L1).

This inconsistency matters because boundary enforcement, ownership, publishing, and dependency direction all get easier once the runtime is either a real package or explicitly documented as intentionally source-coupled. Right now it is neither.

#### DEV-004: Validation discipline is strong for manifests and weak for env/config

The repo has a dominant schema-first pattern in the DSL layer through [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L1). In contrast, operational config and secrets are pulled from unvalidated environment state in several places:
- [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L55)
- [src/runtime/handlers/auth.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/handlers/auth.ts#L16)
- [src/commands/api.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/api.ts#L76)
- [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L413)

This is the clearest architecture inconsistency in the repo because the team already chose a preferred validation style, but has not extended it to runtime configuration. The result is a mix of boot-time checks, raw `process.env` reads, generated placeholder secrets, and undeclared defaults.

#### DEV-005: Governance maturity exceeds review-routing maturity

The repo has unusually strong written governance for a single-repo project: ADRs, PDRs, requirement docs, acceptance criteria, and merge planning all exist. Examples include [docs/product-decisions/PDR-003-ai-native-tooling.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/product-decisions/PDR-003-ai-native-tooling.md), [docs/product-decisions/PDR-004-plugin-first-ecosystem.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/product-decisions/PDR-004-plugin-first-ecosystem.md#L70), and [CLAUDE.md](/Users/sean/Documents/Development/seans-mfe-tool/CLAUDE.md). Yet repository-level review routing is absent because there is no `CODEOWNERS` file.

This is a process asymmetry rather than a code defect: the repo knows how to document decisions, but not how to force the right humans into high-risk reviews.

#### DEV-006: Release discipline is described as necessary, but not executable

Release discipline is explicitly called out as necessary in [docs/product-decisions/PDR-004-plugin-first-ecosystem.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/product-decisions/PDR-004-plugin-first-ecosystem.md#L70) and public API stability is partially documented in [PLUGIN-CONTRACT.md](/Users/sean/Documents/Development/seans-mfe-tool/PLUGIN-CONTRACT.md#L160). The implementation side still lacks a release workflow, changelog process, and automated dependency/security maintenance configuration.

This is a real architectural gap because the plugin-first ecosystem choice increases the need for release hygiene rather than reducing it.

## 6. Gap Analysis

| Gap area | Why it matters | Evidence of absence | Risk if undocumented | Proposed ADR |
| --- | --- | --- | --- | --- |
| Secrets management and rotation | Generated deploy artifacts already reference production secrets, but there is no source-of-truth policy for storage, injection, rotation, or validation | [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399), no `SECURITY.md`, no secret-management doc in [docs](/Users/sean/Documents/Development/seans-mfe-tool/docs) | Secret sprawl, inconsistent local vs CI behavior, weak rotation posture | ADR-046 |
| CODEOWNERS coverage | Architecture-critical paths need explicit maintainership | no `CODEOWNERS` file found | Unreviewed changes to contracts, runtime, or ADR corpus | ADR-047 |
| Dependency update and CVE response | Repo depends on CLI, auth, and build tooling without automated update policy | no Renovate or Dependabot config found, no security policy file found | Stale dependencies and undefined vulnerability response SLA | ADR-048 |
| Release, versioning, and publish strategy | Multi-package repo needs explicit release mechanism beyond informal merge-plan notes | no release workflow besides [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml), no `CHANGELOG.md` | Inconsistent package publication and weak compatibility signaling | ADR-049 |
| Local runtime and package-manager pinning | npm declaration, pnpm workspace, and Node CI versions are not reconciled into one contributor standard | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3), [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml), no `.nvmrc` or `.node-version` | Non-reproducible local builds and onboarding friction | ADR-045 |
| API versioning and deprecation policy | Repo generates APIs and BFF assets but has no explicit lifecycle policy for versioning or compatibility | [src/commands/api.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/api.ts), no API versioning ADR or policy file found | Breaking generated APIs and undefined compatibility expectations | Future ADR candidate |
| Service-to-service authentication | Runtime and BFF surfaces mention JWT and daemon transport but no unified service auth policy exists | [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L150), [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L1) | Inconsistent trust boundaries across daemon, CLI, and generated services | Future ADR candidate |
| Observability SLO and trace propagation policy | Prometheus and OTel config schemas exist, but operational policy does not | [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279) | Metrics may exist without usable service-level objectives or trace semantics | Future ADR candidate |
| Multi-tenancy isolation | Enterprise-facing platform code should make tenant boundary expectations explicit | no tenant or tenancy policy found in runtime, commands, or ADR set; repository search only returns absence-level signals | Future shell/BFF expansion could encode tenant assumptions accidentally | Future ADR candidate |
| Idempotency for mutating operations | CLI, runtime, and generated APIs all expose mutating operations but there is no idempotency policy | no idempotency key support or ADR found; repository search returned no first-party implementation | Retried mutations may produce duplicate side effects | Future ADR candidate |
| Retry/backoff and circuit breaker conventions | Error taxonomy includes `retryable`, and archived DSL artifacts mention retry/backoff, but the active source tree lacks a codified cross-cutting standard | [packages/contracts/src/errors/TimeoutError.ts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/src/errors/TimeoutError.ts#L1), [packages/contracts/src/errors/NetworkError.ts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/src/errors/NetworkError.ts#L1), no accepted ADR for operational retry policy | Services and generators may each invent different failure handling semantics | Future ADR candidate |
| License compliance scanning | Root license exists, but no scanning or policy is present for transitive dependency licenses | [LICENSE](/Users/sean/Documents/Development/seans-mfe-tool/LICENSE#L1), no license scan tooling or workflow in [.github/workflows](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows) | Legal review becomes manual and error-prone as dependency count grows | Future ADR candidate |
| Branch protection and merge policy | Branch naming exists in ADR-038, but merge/review protection is not encoded in repo automation | [docs/architecture-decisions/ADR-038-conventional-commits-branch-discipline.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-038-conventional-commits-branch-discipline.md), no repo-local branch protection artifact | Critical policy lives outside the repo and is not auditable here | Future ADR candidate |

### Gap deep dives

#### Secrets management and rotation

The most direct evidence is generated deployment output that instructs operators to replace placeholder secret values in [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L413). Runtime and generated API code then consume those values through direct environment reads, for example [src/runtime/handlers/auth.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/handlers/auth.ts#L16) and [src/commands/api.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/api.ts#L76). There is no repo-level document describing where secrets should live, how they should be rotated, which scopes are required in CI versus local development, or how to prevent unsafe defaults from leaking into committed files.

Risk if left undocumented:
- placeholder secrets become operational defaults
- generated examples teach inconsistent secret hygiene
- CI and local workflows handle secrets differently without traceable policy

#### API versioning and deprecation policy

The DSL requires semantic versions for MFEs in [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L379), and plugin compatibility guarantees are partially described in [PLUGIN-CONTRACT.md](/Users/sean/Documents/Development/seans-mfe-tool/PLUGIN-CONTRACT.md#L160). What is missing is a policy for generated REST/BFF/API evolution: no accepted ADR defines versioning, deprecation notices, compatibility windows, or upgrade contracts for generated service surfaces. The repository-wide need is acknowledged indirectly in [docs/product-decisions/PDR-004-plugin-first-ecosystem.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/product-decisions/PDR-004-plugin-first-ecosystem.md#L70), which calls for real release discipline.

#### Service-to-service authentication

The repo clearly models authentication as a platform concern. `authorizeAccess` is a first-class platform capability in the DSL, and JWT validation exists in [src/runtime/handlers/auth.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/handlers/auth.ts#L1). However, there is no accepted ADR describing how CLI-to-daemon, BFF-to-upstream, or runtime-to-control-plane trust should work. [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L1) focuses on process isolation, not authn/authz. That is a missing architecture decision, not just missing code.

#### Observability and trace propagation

There is partial implementation evidence that observability matters:
- correlation ID is created in [src/hooks/init.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/hooks/init.ts#L1)
- runtime state updates carry correlation IDs in [src/runtime/remote-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/remote-mfe.ts#L688)
- DSL schemas expose Prometheus and OpenTelemetry config in [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279)

What is missing is the policy layer: no SLOs, no trace propagation standard, no golden-signal baseline, and no accepted ADR defining when those schemas are required, advisory, or ignored.

#### Idempotency and mutating operations

The platform includes mutating capabilities such as `emit` and `updateControlPlaneState` in [src/runtime/base-mfe.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/base-mfe.ts#L132). Generated APIs and deployment flows also perform mutating actions, but there is no idempotency-key standard, no retry contract for client-facing mutation safety, and no accepted ADR covering duplicate suppression. Because the error taxonomy already models retryable failures, this omission becomes more important, not less.

#### Retry/backoff conventions

The codebase already distinguishes retryable and non-retryable failure classes in the contracts package, for example [packages/contracts/src/errors/NetworkError.ts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/src/errors/NetworkError.ts#L1) and [packages/contracts/src/errors/TimeoutError.ts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts/src/errors/TimeoutError.ts#L1). Archived and generated artifacts mention retry and backoff, but there is no accepted, active ADR that defines when retries are allowed, what backoff shape to use, and where circuit breakers should live. This is a missing standard around an already-important design dimension.

## 7. ADR Index

| ADR ID | Filename | Title | Category | Decision type | Status | Primary evidence | Enforcement summary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADR-045 | `ADR-045-package-manager-and-runtime-pinning.md` | Package Manager and Local Runtime Pinning | A | standardize | Proposed | [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3), [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml) | CI plus repo file checks for package manager and Node pin alignment |
| ADR-046 | `ADR-046-environment-configuration-and-secret-validation.md` | Environment Configuration and Secret Validation | D/E | new | Proposed | [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279), [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399) | Type-safe config module, CI validation, generated `.env.example` |
| ADR-047 | `ADR-047-codeowners-and-review-routing.md` | CODEOWNERS and Review Routing for Architectural Surfaces | G/F | new | Proposed | absence of CODEOWNERS, [docs/architecture-decisions](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions), [packages/contracts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts) | CODEOWNERS plus required review on critical paths |
| ADR-048 | `ADR-048-dependency-update-and-vulnerability-response.md` | Dependency Update and Vulnerability Response Policy | A/E | new | Proposed | no Renovate/Dependabot config, no `SECURITY.md`, dependency surface in [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L67) | dependency bot plus CI audit and security policy |
| ADR-049 | `ADR-049-release-versioning-and-publish-automation.md` | Release, Versioning, and Publish Automation | A/E | new | Proposed | [MERGE-PLAN.md](/Users/sean/Documents/Development/seans-mfe-tool/MERGE-PLAN.md), [.github/workflows](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows) | release workflow, changelog generation, package publish gates |

## 8. Full ADR Documents

This first implementation tranche writes the ADR files listed in the index into [docs/architecture-decisions](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions).

## 9. Enforcement Matrix

| ADR | Objective | Primary Mechanism | Secondary | Tool(s) | Example Rule | Autofix? | Latency | Owner | Rollout Strategy | Exception Process |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADR-045 | Unify contributor toolchain and local runtime pinning | CI gate | Scaffolding/docs | GitHub Actions, repo file checks | Fail when `packageManager`, runtime pin file, and contributor docs diverge | Partial | PR | Platform maintainer | Observe in docs, then warn in CI, then block | Superseding ADR if package manager changes |
| ADR-046 | Make env/config validation typed and fail-fast | Type system / compiler plus CI gate | Scaffolding/codegen | Zod, TypeScript, GitHub Actions | All production env reads must flow through a validated config module | Partial | PR and runtime startup | Platform maintainer | Introduce module, migrate hotspots, then block new raw env reads | Temporary exception with tracked issue and dated TODO |
| ADR-047 | Require owner review on architecture-critical paths | CODEOWNERS + required review | CI coverage check | GitHub CODEOWNERS, branch protection, custom path audit | Fail if critical directories have no owner coverage | Partial | PR | Platform maintainer | Add broad ownership first, refine by area later | Fallback owner documented in same change window |
| ADR-048 | Automate dependency updates and vulnerability response | Dependency policy + CI audit | Documentation/process | Dependabot or Renovate, GitHub Actions, `SECURITY.md` | High-severity direct dependency vulnerabilities block release | Partial | Nightly and PR | Platform maintainer | Start with advisory PRs, then block release-critical issues | Deferred upgrade issue with risk and review date |
| ADR-049 | Make release/versioning/publish process executable | CI release workflow | Changelog/review discipline | GitHub Actions, changelog tool, package publish gates | Release workflow cannot publish unless lint, typecheck, test, build, and schema checks pass | Partial | PR and release time | Platform maintainer | Draft workflow first, then require it for publishable packages | Manual hotfix allowed only with reconciliation follow-up |

## 10. Traceability Matrix

| Evidence | Inferred pattern or gap | ADR / action | Enforcement mechanism |
| --- | --- | --- | --- |
| [package.json](/Users/sean/Documents/Development/seans-mfe-tool/package.json#L3) plus [pnpm-workspace.yaml](/Users/sean/Documents/Development/seans-mfe-tool/pnpm-workspace.yaml) | package manager ambiguity | ADR-045 | CI alignment check and local runtime pin |
| [test.yml](/Users/sean/Documents/Development/seans-mfe-tool/.github/workflows/test.yml#L14) with no local Node pin file | local runtime standard missing | ADR-045 | checked-in runtime pin plus CI check |
| [src/dsl/schema.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/dsl/schema.ts#L279) versus [src/mcp/server.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/mcp/server.ts#L55) | schema-first validation does not extend to env/config | ADR-046 | validated config module and raw-env detection |
| [src/runtime/handlers/auth.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/handlers/auth.ts#L16) and [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L413) | secrets and config read directly from env / placeholders | ADR-046 | boot-time fail-fast validation and safer scaffolding |
| absence of `CODEOWNERS` with critical surfaces under [packages/contracts](/Users/sean/Documents/Development/seans-mfe-tool/packages/contracts) and [src/runtime](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime) | governance gap in review routing | ADR-047 | CODEOWNERS plus required review |
| absence of Renovate/Dependabot and `SECURITY.md` | dependency maintenance and vulnerability response gap | ADR-048 | dependency automation and CI audit gate |
| [MERGE-PLAN.md](/Users/sean/Documents/Development/seans-mfe-tool/MERGE-PLAN.md) and [docs/product-decisions/PDR-004-plugin-first-ecosystem.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/product-decisions/PDR-004-plugin-first-ecosystem.md#L70) | release discipline is required but not implemented | ADR-049 | release workflow and changelog gate |
| [docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions/ADR-039-structured-logger-no-console-log.md) versus [src/commands/remote/generate.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/remote/generate.ts#L16) | logging policy drift | follow-up enforcement work under ADR-039 | lint rule plus migration plan |

## 11. Consolidated References Index

- Local ADR corpus in [docs/architecture-decisions](/Users/sean/Documents/Development/seans-mfe-tool/docs/architecture-decisions)
- Project governance in [CLAUDE.md](/Users/sean/Documents/Development/seans-mfe-tool/CLAUDE.md)
- Project instructions in [.github/copilot-instructions.md](/Users/sean/Documents/Development/seans-mfe-tool/.github/copilot-instructions.md)
- Plugin API and compatibility expectations in [PLUGIN-CONTRACT.md](/Users/sean/Documents/Development/seans-mfe-tool/PLUGIN-CONTRACT.md#L160)
- Plugin-first release implications in [docs/product-decisions/PDR-004-plugin-first-ecosystem.md](/Users/sean/Documents/Development/seans-mfe-tool/docs/product-decisions/PDR-004-plugin-first-ecosystem.md#L70)
- Operational config and secret examples in [src/commands/deploy.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/commands/deploy.ts#L399)
- Runtime auth handler evidence in [src/runtime/handlers/auth.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/runtime/handlers/auth.ts#L1)
- Correlation and tracing bootstrap in [src/hooks/init.ts](/Users/sean/Documents/Development/seans-mfe-tool/src/hooks/init.ts#L1)

## 12. Rollout Plan

### 30 days
- Ratify ADR-046 and ADR-047 first because they close the most immediate operational gaps: configuration safety and review routing.
- Add `CODEOWNERS`, `SECURITY.md`, and a checked-in runtime/package-manager pin file.
- Move enforcement from observe-only to CI warning for env validation and dependency audit.
- Start a focused cleanup list for direct `console.*` use in command code so ADR-039 can move from convention to real enforcement.

### 60 days
- Ratify ADR-045 and ADR-048.
- Introduce dependency-update automation and CI audit checks.
- Reconcile npm vs pnpm workspace intent and update contributor docs.
- Decide whether runtime becomes a first-class workspace package or remains intentionally source-coupled to the CLI, and document that decision explicitly.

### 90 days
- Ratify ADR-049.
- Add automated release workflow, changelog generation, and publish checks for first-party packages.
- Resolve the highest-impact deviations, especially direct `console.*` use in command code and ambiguous runtime packaging boundaries.
- Begin the next ADR tranche for API lifecycle/versioning, service-to-service auth, observability/SLO policy, and retry/idempotency conventions.
