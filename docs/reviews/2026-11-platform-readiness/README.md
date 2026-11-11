# Platform Architecture, Quality, Safety and Production Readiness Review

**Date:** 2026-11-10 · **Commit reviewed:** `e41c731` (main) · **Status:** assessment only, no production code changed

This directory holds a read-only review of the repository. Nothing outside this directory was modified.

## Read in this order

| # | Document | What it answers |
|---|---|---|
| A | [Executive assessment](./A-executive-assessment.md) | Where the platform stands, the top risks, the top five moves, and the ten synthesis questions |
| B | [Architecture assessment](./B-architecture-assessment.md) | What is built, how the parts depend on each other, where it diverges from intent, target state |
| C | [Findings register](./C-findings-register.md) | Every finding with an id, severity, evidence, impact and recommendation |
| D | [Security and safety assessment](./D-security-assessment.md) | Threat model, trust boundaries, risks, mitigations, open questions |
| E | [Developer experience assessment](./E-developer-experience.md) | CLI design, the eight developer journeys, the concept load |
| F | [Documentation audit](./F-documentation-audit.md) | Inventory, accuracy, gaps, proposed structure |
| G | [Production readiness checklist](./G-production-readiness-checklist.md) | Status per capability, with evidence |
| H | [Modernization roadmap](./H-modernization-roadmap.md) | Five phases, the first milestone, acceptance criteria |

## How to read the evidence labels

- **Fact**: read directly in the code or configuration at the cited path.
- **Inference**: follows from code that was read, but the behaviour was not executed.
- **Unknown**: could not be established in this review.

## What was and was not verified

| Check | Result |
|---|---|
| `node scripts/check-doc-links.js` | Ran. 642 files, 2,314 relative links, 0 broken |
| `node scripts/check-doc-paths.js` | Ran. 444 path citations, 0 broken |
| `npm run lint`, `typecheck`, `test`, `build`, and every `check:*` gate | **Not run.** `node_modules` was absent and the review brief forbids installing dependencies. No claim in this review rests on a test passing |
| `npm audit` | **Not run.** Dependency vulnerability status is not evaluated |
| Any exploit of a security finding | **Not attempted**, by design. Security findings are code-read |

## Coverage

The repository has 2,811 tracked files. This review is a prioritized sample, not an exhaustive audit.

| Depth | Areas |
|---|---|
| Read in full | `packages/oclif-base/src/BaseCommand.ts`, `src/hooks/*`, `src/mcp/**`, `src/commands/mcp/serve.ts`, `src/commands/deploy.ts`, `packages/runtime/src/handlers/auth.ts`, `packages/workspace/src/api/server.ts` (handler), `.github/workflows/test.yml`, `eslint.config.js`, `jest.config.js`, `package.json`, `bin/*`, `Dockerfile.cli`, `README.md`, `docs/getting-started.md`, `packages/README.md` |
| Read in part | `packages/control-plane/{daemon,registry}/*.js` (network handlers, authorization path), `src/commands/build/docker.ts`, `packages/dsl/src/schema.ts`, `packages/codegen/src/{catalog,template-io,unified-generator}.ts`, `packages/runtime/src/{base-mfe,layout-adaptors}.ts`, `packages/plugin-coder/src/{api-runner,coder-service}.ts`, `src/decompose/{capture,bundle}.ts`, `docs/PROJECT-STATUS.md`, `docs/README.md`, generated example Dockerfile |
| Surveyed by search only | All command files (flags, args, subprocess calls, console use), all package manifests, test file distribution, doc inventory and dates |
| Not reviewed | `packages/plugin-api` generator internals, Swift and Rust templates, the contents of the 120 ADRs and 12 PDRs, decomposition analysis and clustering algorithms, the workspace MFE UI, example fleet application code, `composition.yml`, `pages.yml`, `docs/api/**` |
