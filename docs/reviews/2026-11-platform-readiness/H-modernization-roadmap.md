# H. Modernization Roadmap

Finding ids refer to the [register](./C-findings-register.md). Effort is relative: S under a day, M days, L weeks.

## Shape of the plan

| Phase | Goal | Relative effort | Depends on |
|---|---|---|---|
| 1. Stabilize | Nothing unsafe, nothing that lies | 1x | Nothing |
| 2. Standardize | One way to do each thing | 1.5x | Phase 1 |
| 3. Simplify | A smaller core with labelled edges | 2x | Phase 2 |
| 4. Productize | Installable, versioned, documented | 3x | Phases 1 to 3; one decision on the control plane |
| 5. Extend | New capability on a stable base | Open | Phase 4 |

Two decisions are needed from the owner before Phase 4. They are listed at the end.

## Quick wins

Each is under a day and independent of the others.

| # | Change | Finding |
|---|---|---|
| 1 | Argument arrays and name validation in `deploy` and `build:docker` | SEC-01 |
| 2 | Drop `token` and `user` from auth telemetry | SEC-04 |
| 3 | Default-deny in daemon authorization | SEC-03 |
| 4 | Hide `deploy` from help and MCP; mark deprecated | ARC-04 |
| 5 | Delete the remote MCP source and its README section | ARC-03 |
| 6 | Delete or repair the `postrun` telemetry hook | ARC-05 |
| 7 | Delete or repair `.husky/pre-commit` | QC-02 |
| 8 | One Node version; fix `package.json` description and keywords | QC-01 |
| 9 | Add `SECURITY.md` and Dependabot config | SEC-12, SEC-09 |
| 10 | Rewrite `docs/README.md` as an index; fix the stale ADR count | DOC-02, DOC-03 |
| 11 | Copy the lockfile and use `npm ci` in `Dockerfile.cli` and both control-plane Dockerfiles | SEC-09 |

## Larger changes

| Change | Finding | Effort | Why it is large |
|---|---|---|---|
| Publish runtime, core packages and CLI | ARC-01 | L | Touches every generated `package.json` and Dockerfile; needs a migration entry |
| MCP exposure model | SEC-06 | M | New command metadata, registry change, conformance tests |
| Control-plane hardening | SEC-02, ARC-02 | L | Auth design, typing, tests, an ADR |
| Flag vocabulary | QC-04 | M | Breaking for scripts; needs aliases and a deprecation window |
| Core and labs split | ARC-07 | M | Moves commands into plugins; schema names and MCP tool names change |
| Documentation restructure | DOC-05 | M | Many files move; link gates will catch breakage |
| `plugin-api` port or demotion | ARC-08 | L | 2,296 lines of JavaScript |

---

## Phase 1 — Stabilize

**Prerequisites:** approval of this review.

**Deliverables**

| Item | Finding | Effort |
|---|---|---|
| Quick wins 1 to 7, 9, 11 | as above | S each |
| MCP: validate input against the tool schema; deny unknown keys; confine `cwd` to a startup root; pass an explicit environment; kill the process group on timeout | SEC-06 | M |
| MCP: exclude long-running commands (`build:dev`, `bff:dev`, `decompose:workspace`) and `deploy`, `build:docker` unless enabled by flag | SEC-06 | S |
| Workspace API: session token, `Origin` check, body size cap | SEC-07 | S |
| Schema grammar for manifest and capability names; assert planned paths stay inside the target directory | SEC-08 | S |
| BFF template: stop exposing an unverified `userId`; require `CORS_ORIGIN` when `NODE_ENV=production` | SEC-05 | S |
| `npm audit --omit=dev` as a CI step; Actions pinned by commit SHA and moved off deprecated majors | SEC-09 | S |

**Platform reach.** Two items touch generated code: the BFF template and the name grammar. For each, either add a `PLATFORM_MIGRATIONS` entry or state in the PR why none is needed (ADR-082). A stricter name grammar could reject an existing manifest. Run it over `examples/**` first and widen the grammar rather than break a fleet.

**Exit criteria**

- A test proves a shell metacharacter in `deploy`'s name or `build:docker`'s tag is rejected before any spawn.
- A search for `execSync` with a template literal in `src` and `packages/*/src` returns nothing, and a lint rule keeps it so.
- `tools/list` from `mcp:serve` contains no long-running or destructive tool by default. An unknown input key returns a validation error.
- No test or source line emits a JWT or a full claims object.
- A cross-origin POST to the workspace API returns 403, in a test.
- `npm audit` runs in CI and its result is recorded.
- All existing gates in `test.yml` are green. **This review did not run them, so establish the baseline first.**

---

## Phase 2 — Standardize

**Prerequisites:** Phase 1 exit.

**Deliverables**

| Item | Finding | Effort |
|---|---|---|
| Command metadata: `mutating`, `mcp: { expose, readOnly }`, `state`. The conformance sweep asserts every command declares them | QC-05, SEC-06, ARC-07 | M |
| Every `mutating` command offers `--dry-run`, asserted by the sweep | QC-05 | M |
| `--out` everywhere; integer ports; directory as first positional. Old spellings kept as hidden aliases for one release | QC-04 | M |
| One output helper on `BaseCommand`; `no-console` on in `src/commands/**` and plugin command code | QC-01 | M |
| Type-check tests: add a test-inclusive project to `npm run typecheck` | QC-07 | S |
| Coverage collection widened to all `packages/*/src` and `src/**`, with per-package thresholds set at current levels | QC-03 | S |
| Control plane: one module system, one logger, renamed entry files | ARC-02 | M |
| A single `npm run verify` that selects gates from changed paths | E §5 | M |

**Exit criteria**

- The conformance sweep fails if a command lacks metadata, a mutating command lacks `--dry-run`, or a flag uses a retired spelling.
- `npm run lint` fails on a `console.log` in command code.
- Coverage is reported for every package.

---

## Phase 3 — Simplify

**Prerequisites:** Phase 2 exit. Command metadata exists.

**Deliverables**

| Item | Finding | Effort |
|---|---|---|
| Move `decompose:*`, `design:*`, `flow:*` into opt-in plugins, as `plugin-coder` already is | ARC-07 | M |
| Move `adr:*` and `sentinel:*` to a dev-only plugin not in the published CLI | ARC-07 | S |
| Delete `deploy` and its Docker templates | ARC-04 | S |
| Decide `plugin-api`: port to TypeScript or label Labs and unbundle | ARC-08 | S to decide |
| Remove ADR numbers from command descriptions, topic text and error fixes | E §3 | M |
| Rename one of the two "adaptor" concepts | ARC-06 | S, needs an ADR |
| Merge architecture documents; archive executed plans | DOC-05 | M |

**Compatibility.** Moving commands into plugins keeps command ids. MCP tool names stay stable if the `mfe:` prefix rule is kept. Verify with the schema drift gate.

**Exit criteria**

- Default `--help` lists 16 or fewer commands, each with a stability state.
- One architecture overview. Every other architecture document is linked from it or archived.
- No ADR number appears in `oclif.manifest.json`.

---

## Phase 4 — Productize

**Prerequisites:** Phases 1 to 3. Decisions D1 and D2 below.

**Deliverables**

| Item | Finding | Effort |
|---|---|---|
| Publish `@seans-mfe-tool/runtime` under its current name (ADR-064) | ARC-01 | M |
| Publish contracts, dsl, codegen, oclif-base, framework plugins, the CLI. Rewrite `file:` links to versions at pack time | ARC-01 | M |
| Generated `package.json` and Dockerfile use the registry version. Add a `PLATFORM_MIGRATIONS` entry for the Dockerfile staging steps that go away | ARC-01 | M |
| Release workflow: version, changelog, tag, publish with provenance | G | M |
| Install smoke test: pack, install in a clean container, `remote:init`, `npm install`, build | QC-08 | M |
| Quick start rewritten from `npm install`, executed in CI | DOC-04, F §7 | M |
| Generated CLI reference; configuration reference; troubleshooting guide; `CONTRIBUTING.md` | F | M |
| `doctor --env`, shell completion, update notice | E | S each |
| Control plane, per D1: either auth, origin allow-list, health, shutdown, tests; or a "reference only" banner in every entry point | SEC-02, ARC-02 | L or S |

**Exit criteria**

- From a clean machine: four commands or fewer to a running MFE, proven by a CI job.
- A tagged release exists with a changelog entry.
- The readiness checklist has no "Initial" row at Not ready.

---

## Phase 5 — Extend

Only after Phase 4. In rough order of value:

1. Deploy-target plugins (ADR-062).
2. Asymmetric JWT and JWKS (SEC-11).
3. A real MCP proxy for remote servers, with tests (ARC-03).
4. Marketplace for capability packages, the stated long-term goal.
5. Decomposition steps 5 to 7.
6. Windows support.
7. Metrics and a readiness model for the control plane.

---

## First milestone

**Name:** Safe by default, honest at the door.
**Scope:** Phase 1 in full, plus quick wins 8 and 10 and the generated README command table.
**Size:** one to two weeks. About fifteen small pull requests. No architectural change, no new ADR expected except possibly one for MCP exposure metadata.

**Why this first.** It removes every P0. It deletes more than it adds. It touches generated code in only two places. And it makes the README true, which costs little and changes how the project reads to anyone evaluating it.

**Suggested order**

1. Establish the baseline: install, run every gate, record results. This review could not.
2. SEC-01 and SEC-04. Independent, small, highest value.
3. MCP hardening (SEC-06).
4. Deletions: `deploy` exposure, remote MCP source, telemetry hook, pre-commit hook.
5. SEC-07, SEC-08, SEC-05.
6. CI and supply chain (SEC-09, SEC-12).
7. Documentation truth pass (DOC-01, DOC-02, DOC-03, DOC-06, QC-01).

**Acceptance for the milestone:** the Phase 1 exit criteria, plus a README whose command table is generated and whose every claim in [F, DOC-06](./F-documentation-audit.md) is corrected.

---

## Decisions needed from the owner

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | What is the control plane? | (a) A product component: harden it. (b) A reference implementation: label it and leave auth to adopters | (b) now, (a) when a real deployment asks for it. It keeps Phase 4 small and is honest about today's state. Needs a short ADR, since PDR-008 says "canonical" |
| D2 | What ships in the published CLI? | (a) Everything. (b) Core only, with labs as separate plugins | (b). It is the difference between a 16-command and a 33-command first impression |
| D3 | Is `plugin-api` part of the platform? | Port, demote, or remove | Demote to Labs. It predates the contract and nothing in the core depends on it |
| D4 | Freeze new Labs features until Phase 2 exits? | Yes or no | Yes. The core's oldest gaps are older than its newest features |

**No implementation has been started. This plan awaits approval.**
