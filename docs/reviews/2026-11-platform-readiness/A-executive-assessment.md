# A. Executive Assessment

## The verdict

The platform's core idea is sound and its engineering discipline is well above what a project of this age usually has. It is not yet a product someone outside this repository can install, and its runtime control plane is not safe to expose to a network.

Three things hold it back:

1. **There is no distribution.** The CLI and the runtime are not published. A generated MFE depends on a runtime that exists only as a folder inside a checkout or a Docker image.
2. **The control plane trusts everyone.** The registry and daemon have no authentication. Whoever can reach the registry can make the shell load their script and receive users' tokens.
3. **Scope has outrun the core.** Decomposition, design export, an agent workspace, Swift and Rust targets all shipped while the core path (install, scaffold, run, deploy) still cannot be completed by an outsider.

## Scorecard

Ratings are 1 (absent) to 5 (production grade). They are judgments, each tied to findings in the [register](./C-findings-register.md).

| Dimension | Rating | Basis |
|---|---|---|
| Overall maturity | 3 | Strong internals, no external delivery path |
| Architectural coherence | 4 for the core, 2 for the edges | One-way package layering enforced by a test; control plane and API generator sit outside every standard (ARC-02, ARC-08) |
| Developer experience | 3 inside the repo, 1 outside it | Consistent JSON envelope and exit codes; no install path, README covers under half the commands (ARC-01, DOC-01) |
| Code quality | 4 | Zero `throw new Error` and 10 `any` hits in production TypeScript; standards and lint disagree in places (QC-01) |
| Security posture | 2 | Shell injection in two commands reachable by agents; unauthenticated control plane; token written to telemetry (SEC-01, SEC-02, SEC-04) |
| Documentation | 3 | Links and path citations are gated and clean; the entry points are stale or misdirected (DOC-01 to DOC-04) |
| Production readiness | 2 | No releases, tags, changelog, dependency scanning, or security policy (see [checklist](./G-production-readiness-checklist.md)) |

## What is strong

- **Drift control.** Generated files, schemas, the ADR index and even doc counts are regenerated and diffed in CI. Seventeen such gates run in `.github/workflows/test.yml`.
- **The agent contract.** One `CommandResult` line on stdout, typed exit codes, a `--no-interactive` switch. `BaseCommand` owns all of it, so a command cannot opt out by accident.
- **Layering.** `contracts` imports nothing. An import-direction test enforces the package graph.
- **Candor.** Comments and docs state what a gate does not cover. That made this review faster and is rare.

## The most important risks

| # | Risk | Finding |
|---|---|---|
| 1 | An agent connected over MCP can be steered into running arbitrary shell commands on the developer's machine | SEC-01, SEC-06 |
| 2 | Anyone who can reach the registry port can run script in the shell's origin and collect user tokens | SEC-02 |
| 3 | A failed JWT validation writes the raw token into the telemetry stream | SEC-04 |
| 4 | An adopter following the getting-started guide outside this repository cannot install a generated MFE | ARC-01 |
| 5 | One maintainer carries 18 packages, 120 ADRs and five product lines. The core gets less attention than its edges | ARC-07 |

## Top five recommendations

1. **Close the two injection paths and gate MCP.** Replace shell strings with argument arrays in `deploy` and `build:docker`. Give the MCP server an allow-list and schema validation. Small effort, removes the worst exposure.
2. **Publish the runtime and the CLI.** ADR-064 already decided this and deferred it. It is the single change that turns a repository into a product.
3. **Decide what the control plane is.** Either harden it (auth, origin allow-list, tests, types) or label it a reference implementation and say so everywhere. Today PDR-008 calls it canonical while the files are named `simple-*.js`.
4. **Draw a line between core and labs.** Core is manifest, generate, runtime, compose, validate. Everything else gets a stability label and stops shaping the front door.
5. **Make the front door true.** README, docs index, getting-started and project status should describe the product a newcomer will meet. Generate the CLI reference from the oclif manifest.

## Final synthesis

**1. What is this platform today?**
A contract-first code generator and runtime for micro-frontends, with a reference control plane and two demo fleets. It works well for its author inside its own repository. It also carries a second product, agent-driven monolith decomposition, at an earlier stage.

**2. What should it become?**
An installable toolchain with a small stable core: write a manifest, generate, validate, compose. The runtime ships as a versioned package. The control plane is either a hardened service or an explicit reference. Decomposition and native targets are opt-in plugins on that core.

**3. What is unnecessarily complicated?**
- Runtime delivery. Generated Dockerfiles uninstall, copy and re-delete the runtime to work around it not being on a registry.
- The concept count. Two kinds of plugin, plus contributors, variants, adaptors, targets and kernel ports.
- Pointing a command at a project. There are five different ways (see QC-04).

**4. What is inconsistent or duplicated?**
- Three stated Node minimums: 18, 20 and 22.
- A "no console.log" rule beside roughly 385 console calls and a lint rule set to off.
- `--out`, `--output` and `--output-dir`. `--port` as a string in four commands and an integer in two.
- The daemon is CommonJS with structured logs. The registry is ESM with emoji `console.log`.
- About ten overlapping architecture documents at the top of `docs/`.

**5. What is missing for production adoption?**
A published CLI and runtime. Releases, tags and a changelog. An upgrade path. Authentication on the control plane. Dependency scanning. A security policy. A CLI reference and a troubleshooting guide.

**6. What presents the greatest security or reliability risk?**
Security: the unauthenticated registry feeding script URLs to the shell (SEC-02), then shell injection reachable through MCP (SEC-01).
Reliability: control-plane state lives in memory with no tests in its directory (ARC-02).

**7. What should be fixed immediately?**
SEC-01, SEC-04 and SEC-06. Then remove or quarantine `deploy`, which cannot succeed against any MFE the generator produces today (ARC-04).

**8. What should be standardized before adding features?**
Flag and argument vocabulary. Logging in command code. One Node floor. One release and versioning scheme. A stability label on every command and package.

**9. What should be simplified or removed?**
- Remove `deploy` until it returns as a plugin (ADR-062 already says so).
- Remove MCP remote federation or finish it. It lists tools it cannot call.
- Remove the CLI telemetry hook or make the daemon accept it.
- Remove the dead pre-commit hook.
- Archive the plan documents that have been carried out or voided.

**10. What is the smallest practical path to a coherent, production-ready platform?**
Three steps, in order:
1. Make it safe: the first milestone below.
2. Make it installable: publish the runtime and CLI, with a release workflow.
3. Make it legible: one quick start that works from `npm install`, a generated CLI reference, and stability labels.

Nothing in that path requires a rewrite.

## Recommended first milestone

**"Safe by default, honest at the door."** About one to two weeks of focused work. No architectural change.

| Deliverable | Finding |
|---|---|
| `deploy` and `build:docker` use argument arrays and validate names | SEC-01 |
| MCP validates input against each tool's schema, excludes long-running and destructive commands by default, and stops forwarding the full environment | SEC-06 |
| JWT and user claims removed from auth telemetry | SEC-04 |
| `deploy` hidden from help and MCP, marked deprecated | ARC-04 |
| Dependency scanning, pinned Actions, `SECURITY.md` | SEC-09, SEC-12 |
| README command table generated from the oclif manifest; Node floor stated once; docs index rewritten | DOC-01, DOC-02, QC-01 |
| Pre-commit hook fixed or deleted | QC-02 |

Exit criteria are in the [roadmap](./H-modernization-roadmap.md#first-milestone).

**This review stops here. No implementation will start without approval.**
