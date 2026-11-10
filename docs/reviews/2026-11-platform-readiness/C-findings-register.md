# C. Quality and Consistency Findings Register

Every recommendation elsewhere in this review points back to an id here.

**Severity:** P0 critical · P1 high · P2 medium · P3 future.
**Evidence:** Fact (read in code) · Inference (follows from code, not executed) · Unknown.
**Effort:** S under a day · M days · L weeks.

## Summary

| Id | Sev | Title | Effort |
|---|---|---|---|
| SEC-01 | P0 | Shell injection in `deploy` and `build:docker` | S |
| SEC-02 | P0 if networked | Control plane has no authentication; registry controls what the shell executes | L |
| SEC-06 | P0 | MCP exposes every command with no validation or allow-list | M |
| SEC-04 | P1 | Raw JWT and claims written to telemetry | S |
| SEC-03 | P1 | Authorization fails open | S |
| SEC-05 | P1 | Generated BFF trusts an unverified JWT payload | S |
| ARC-01 | P1 | CLI and runtime are not distributable | L |
| ARC-02 | P1 | Control plane is demo-grade but declared canonical | L |
| ARC-03 | P1 | MCP federation lists tools it cannot call | S to remove, M to finish |
| ARC-04 | P1 | `deploy` cannot succeed on a generated MFE | S |
| SEC-07 | P2 | Workspace API accepts cross-site requests | S |
| SEC-08 | P2 | Generator writes to unconfined paths | S |
| SEC-09 | P2 | No supply-chain controls | M |
| SEC-10 | P2 | Capture bundles store unredacted response bodies | M |
| ARC-05 | P2 | CLI telemetry hook does nothing | S |
| ARC-06 | P2 | High concept count | M |
| ARC-07 | P2 | Scope exceeds the core's maturity | M |
| ARC-08 | P2 | `plugin-api` is legacy JavaScript outside the standards | L |
| QC-01 | P2 | Stated standards and enforcement disagree | S |
| QC-02 | P2 | Pre-commit hook is dead | S |
| QC-03 | P2 | Coverage gate measures less than it appears to | S |
| QC-04 | P2 | Flag and argument vocabulary is inconsistent | M |
| QC-05 | P2 | `--dry-run` claim is not true | S |
| QC-07 | P2 | Runtime tests are not type-checked | S |
| QC-08 | P2 | Root end-to-end suite tests a fixture | M |
| DOC-01 to DOC-07 | P2 | Documentation findings | see [F](./F-documentation-audit.md) |
| QC-06 | P3 | Small stale artifacts | S |
| SEC-11 | P3 | JWT limited to a shared secret; `eval('require')` | M |
| SEC-12 | P3 | No security policy | S |

---

## Security findings

Full threat model in [D](./D-security-assessment.md).

### SEC-01 · P0 · Shell injection in `deploy` and `build:docker`

- **Evidence (fact).** `src/commands/deploy.ts:171-203` builds `docker build`, `docker stop`, `docker rm` and `docker run` as template strings passed to `execSync`. The `name` argument (`deploy.ts:333`) has no pattern. `src/commands/build/docker.ts:143` does the same with `--tag` and the working directory.
- **Impact.** A name such as `x; <command>` runs on the host. Both commands are MCP tools (`schemas/deploy.json`, `schemas/build-docker.json`), so text an agent reads can reach this.
- **Recommendation.** Use `execFile('docker', [...])`. Validate names against Docker's name grammar. Add a lint rule banning `execSync` with a template literal.
- **Acceptance.** A test passes `name = "a;touch /tmp/x"` and asserts a `ValidationError` and no spawn. `grep -rn "execSync(\`"` over `src` and `packages/*/src` returns nothing.

### SEC-02 · P0 if networked, P1 as a local demo · Unauthenticated control plane

- **Evidence (fact).**
  - Registry `POST /mfes` and `POST /render` accept any caller (`simple-registry.js:430-443`).
  - Both services bind `0.0.0.0` (`simple-registry.js:508`, `simple-daemon.js:757`). Compose publishes the ports.
  - The daemon sends the user's bearer token to the registered `baseUrl` (`simple-daemon.js:486`).
  - The shell injects the registered `remoteEntryUrl` as a script (`packages/runtime/src/layout-adaptors.ts:200-205`) with no origin allow-list.
  - Neither WebSocket server checks `Origin`.
- **Impact.** Whoever reaches the registry gets script execution in the shell's origin and receives user tokens.
- **Recommendation.** Authenticate registration (shared secret or mTLS at minimum). Allow-list MFE origins in the shell. Check `Origin` on WebSocket upgrade. Bind to loopback by default.
- **Acceptance.** An unauthenticated `POST /mfes` returns 401. `LayoutManager` refuses a `remoteEntryUrl` outside its allow-list, with a test.

### SEC-03 · P1 · Authorization fails open

- **Evidence (fact).** `simple-daemon.js:463-465`: an MFE that does not declare `authorizeAccess` is treated as authorized.
- **Recommendation.** Default to deny. Make "public" an explicit manifest declaration.

### SEC-04 · P1 · Token and claims in telemetry

- **Evidence (fact).** `packages/runtime/src/handlers/auth.ts:81` puts the raw `token` in event metadata on failure. Lines 67, 114 and 134 put the full decoded `user` object in success and permission events.
- **Impact.** Credentials and personal data land wherever telemetry goes.
- **Recommendation.** Emit a token fingerprint (first 8 hex of a SHA-256) and the subject id only.
- **Platform reach.** This is in `packages/runtime/src/**`. It changes emitted data, not an API, so no `PLATFORM_MIGRATIONS` entry should be needed. Confirm when implementing.

### SEC-05 · P1 · Generated BFF trusts an unverified payload

- **Evidence (fact).** `packages/plugin-bff/templates/mesh-context.js.ejs:22-31` base64-decodes the JWT payload and exposes `userId` with no signature check. `server.ts.ejs:40` defaults CORS to `*`.
- **Impact.** Any resolver using `context.userId` can be impersonated.
- **Recommendation.** Verify before decoding, or rename the field to `unverifiedUserId` and document it. Require `CORS_ORIGIN` in production.
- **Platform reach.** Template change. Generator-owned files are fixed by `check:mfe-drift`. Check whether `mesh-context.js` is generator-owned before deciding on a migration entry.

### SEC-06 · P0 · MCP server exposure

- **Evidence (fact), `src/mcp/server.ts` and `tool-registry.ts`.**
  - Input is never validated against `inputSchema`. `buildArgv` turns any key into `--key value` (`tool-registry.ts:128-140`).
  - Every command with a schema is a tool, including `deploy`, `build:docker`, `build:dev`, `bff:dev` and `decompose:workspace`.
  - `cwd` may be any existing directory (`server.ts:62-76`).
  - The child inherits the whole environment (`server.ts:85`).
  - On timeout only the direct child gets `SIGTERM` (`server.ts:92`). Dev servers started by it survive.
  - There is no cancellation, no concurrency limit, and stdout is buffered without bound.
- **Recommendation.** Validate with the schema already on disk. Let each command declare `mcp: { expose, readOnly, destructive }`. Default to read-only tools. Confine `cwd` to a root given at startup. Kill the process group.
- **Acceptance.** `tools/list` omits long-running and destructive commands unless a flag enables them. An unknown input key returns a validation error without spawning.

### SEC-07 · P2 · Workspace API accepts cross-site requests

- **Evidence (fact).** `packages/workspace/src/api/server.ts:71-75, 170-196`. The API binds to loopback, which is right. It does not check `Origin`, `Host` or `Content-Type`, has no token, and reads the body without a size limit.
- **Impact.** A web page open in the same browser can post an `approve` edit, attributed to the developer, or trigger paid model calls through `/api/ask`.
- **Recommendation.** Require a per-session token header. Reject requests whose `Origin` is not the front door. Cap body size.

### SEC-08 · P2 · Generator writes to unconfined paths

- **Evidence (fact).** Capability names are `z.record(z.string(), …)` keys with no pattern (`packages/dsl/src/schema.ts:389`). Manifest `name` is `z.string().min(1)` (`schema.ts:657`). `packages/codegen/src/template-io.ts:123-124` writes each planned path as given. `packages/dsl/src/type-system.ts:394` interpolates a manifest regex into generated source.
- **Inference.** A capability named with `../` segments writes outside the project. Not executed.
- **Why it matters now.** Manifests are increasingly machine-written (`coder:compile`, the decomposition flow).
- **Recommendation.** Constrain names to an identifier grammar in the schema. Assert every planned path resolves inside the target directory before any write.

### SEC-09 · P2 · No supply-chain controls

- **Evidence (fact).**
  - No Dependabot or Renovate config, no `npm audit` step, no CodeQL.
  - Actions use mutable tags, several on deprecated majors: `actions/checkout@v3`, `actions/setup-node@v3`, `codecov/codecov-action@v3`.
  - `Dockerfile.cli` runs `npm install` without copying the lockfile.
  - Control-plane Dockerfiles run `npm install` beside a lockfile and never set `USER`.
  - The registry depends on `apollo-server-express` 3, which is end-of-life.
  - No provenance or SBOM.
- **Unknown.** Current vulnerability count. `npm audit` was not run.

### SEC-10 · P2 · Unredacted capture bundles

- **Evidence (fact).** `src/decompose/capture.ts:230-234` stores every response body. `src/decompose/bundle.ts:187` writes them into the replay bundle.
- **Unknown.** Which parts of a bundle reach the hosted model.
- **Recommendation.** Redact by header and key pattern at capture. Document that bundles must be captured against non-production data. State in the docs what is sent to the model.

### SEC-11 · P3 · JWT limits

`auth.ts` verifies HS256 with one shared secret and loads the library through `eval('require')`. Enterprises will need asymmetric keys and JWKS. The algorithm pin is correct and should stay.

### SEC-12 · P3 · No security policy

No `SECURITY.md`, no disclosure contact, no `CODEOWNERS`.

---

## Architecture findings

### ARC-01 · P1 · The platform cannot be installed

- **Evidence (fact).**
  - Root `package.json` lists ten `file:` dependencies. `npm publish` would produce an uninstallable package.
  - `packages/runtime/package.json` is `private: true`.
  - `packages/codegen/src/catalog.ts:72-78` declares the runtime as `^0.1.0` with the comment "Not published to npm yet (ADR-064)".
  - ADR-064 is Accepted with `impl.stage: deferred`.
  - There is no release workflow and no git tag.
  - The generated Dockerfile needs an uninstall, a copy and a delete to place the runtime (`examples/meridian-station/meridian-cargo-ops/Dockerfile`).
- **Inference.** `remote:init` followed by `npm install` outside this repository fails to resolve the runtime.
- **Impact.** No external adoption is possible. Third-party plugins have nothing to depend on.
- **Recommendation.** Implement ADR-064. Publish runtime, contracts, dsl, codegen, oclif-base and the CLI from one release workflow. `check:publish-shape` already proves four of them pack correctly.
- **Acceptance.** In an empty directory on a clean machine: `npm i -g seans-mfe-tool`, `remote:init demo`, `npm install`, `npm run build` all succeed, in CI.

### ARC-02 · P1 · Control plane maturity does not match its status

- **Evidence (fact).** 1,375 lines of JavaScript in `packages/control-plane`. No test file in that directory, though the registry's `package.json` has a `test` script. State is in memory. No signal handling. The daemon is CommonJS with a structured logger. The registry is ESM with emoji `console.log`.
- **Recommendation.** Decide: harden or relabel. If hardened: TypeScript, unit tests for the resolution pipeline, health and readiness endpoints, graceful shutdown, then SEC-02.

### ARC-03 · P1 · MCP federation is listing-only

- **Evidence (fact).** `src/mcp/sources/remote.ts` implements only `tools/list`. `executeToolCall` (`server.ts:83`) always spawns the local CLI with a command id derived by stripping the tool's prefix. A remote tool `coder:refactor` becomes `run.js refactor --json`.
- **Evidence (fact).** `sources/plugin.ts` reads `~/.local/share/<cli>/config.json`, ignoring `XDG_DATA_HOME` and Windows.
- **Recommendation.** Remove the remote source and its README section now. Reintroduce it only with a real proxy and tests.

### ARC-04 · P1 · `deploy` cannot succeed

- **Evidence (fact).**
  - It requires `App.jsx` and `bootstrap.jsx` under the project source directory, plus `public/index.html` (`deploy.ts:72-78`). Generated React MFEs have `App.tsx` and no `bootstrap.jsx` (see `examples/abc-kids/flappy/src`).
  - It looks for templates one level above the compiled command (`deploy.ts:106`). The build copies them under `dist/codegen/templates` (`scripts/copy-runtime-files.js:13`).
  - It swallows a failed `docker build` unless the message contains "Build failed". The comment gives the reason as unit-test setup (`deploy.ts:179-183`).
- **Note.** `jest.config.js` holds this file to 90% line coverage. The tests pass against mocks while the command is unusable. Coverage is not evidence of function.
- **Recommendation.** Mark deprecated, hide from help and MCP, delete when ADR-062's plugin axis lands.

### ARC-05 · P2 · CLI telemetry hook is inert

- **Evidence (fact).** `src/hooks/postrun.ts:128-136` sends `mutation { telemetry }` with a variable the query does not declare. The daemon's schema defines only `sendMessage`. Under `--json`, `BaseCommand` exits right after the hook returns, and the send is fire-and-forget.
- **Recommendation.** Delete the hook, or send a valid `sendMessage` and await it with a short cap.

### ARC-06 · P2 · Concept count

A newcomer meets: manifest, capability (platform and domain), lifecycle hook, handler, target, framework plugin, command plugin, codegen variant, file contributor, adaptor (two meanings: layout and prompt), slot, placement rule, control-plane document, registry, daemon, shell, flow, sentinel port, platform migration. See [E](./E-developer-experience.md) for the minimum set.

### ARC-07 · P2 · Scope exceeds core maturity

- **Evidence (fact).** 18 packages. 120 ADRs dated July to October 2026. Five product lines: generator and runtime, control plane, API generator, native targets, decomposition and workspace.
- **Evidence (fact).** `docs/PROJECT-STATUS.md` notes it drifted by two months once already.
- **Impact.** The core's missing pieces (ARC-01, SEC-02) are older than several shipped side features.
- **Recommendation.** Label every command and package Core, Reference, Labs or Internal. Freeze new Labs surface until Phase 2 exits.

### ARC-08 · P2 · `plugin-api` is outside the standards

2,296 lines of JavaScript and 123 console calls, exempt from strict TypeScript. Either port it or label it Labs and exclude it from the published CLI.

---

## Quality findings

### QC-01 · P2 · Standards and enforcement disagree

| Standard | Reality |
|---|---|
| "No `console.log` in production code" | `eslint.config.js` sets `no-console: off` globally. About 175 calls in `src`, 61 in `plugin-bff`, 123 in `plugin-api` |
| "Node ≥18" (`CLAUDE.md`, `docs/getting-started.md`) | `engines.node >=20`, `.nvmrc` 22, CI matrix 20 and 22 |
| Product description | `package.json` says "CLI tool for scaffolding Module Federation applications with React and MUI" |

**What is enforced well, for balance:** zero `throw new Error` in production TypeScript; 10 `any` matches; 5 `@ts-` suppressions; `process.exit` banned in command code.

**Recommendation.** Either enforce `this.log` and the logger in commands, or rewrite the rule to say what is actually intended: libraries never print, commands print through one helper.

### QC-02 · P2 · Dead pre-commit hook

`.husky/pre-commit` sources `_/husky.sh`, but `husky` is not in `package.json`. The hook guards a `generators` directory that used to sit under `src/codegen` and has since moved to `packages/plugin-api`. Fix it to run lint and typecheck, or delete it.

### QC-03 · P2 · Coverage gate scope

`jest.config.js` `collectCoverageFrom` includes `src/commands/*.{js,ts}` (top level only: `deploy.ts`, `schemas.ts`), `plugin-api`, `dsl`, `runtime`, and a `build` directory under `src` that does not exist. It omits `codegen`, `contracts`, `oclif-base`, `src/mcp`, `src/decompose`, command subdirectories and every other package. The 80% threshold says nothing about them.

### QC-04 · P2 · Flag and argument vocabulary

| Concept | Spellings found |
|---|---|
| Output location | `--out` (6 commands), `--output` (1), `--output-dir` (1) |
| Port | `Flags.string` (4 commands), `Flags.integer` (2) |
| Which project | positional `dir`, `project`, `proposal`, `analysis`; `--cwd` (3); `--manifest` (7); `--manifests`; `--src`; `--source-root` |

### QC-05 · P2 · `--dry-run` coverage

Declared in nine command files. Absent from commands that write: `build:docker` (writes `Dockerfile.generated`, may build an image), `decompose:capture`, `decompose:propose`, `decompose:present`, `decompose:ask`, `design:export`, `build:prod`.

### QC-06 · P3 · Small stale artifacts

- `bin/run.js` registers `ts-node` when `dist/` is missing, with a comment promising removal in "A7".
- MCP `serverInfo.version` is the literal `'1.0.0'` (`server.ts:202`).
- CI ignores `NodemonServer.test.js` and `create-shell.test.js`. Whether those files still exist was not checked.
- The `mcp:serve` help example and its Claude Desktop snippet use `mcp serve` with a space. No `topicSeparator` is configured, so the colon form is likely required (inference).

### QC-07 · P2 · Runtime tests are not type-checked

Stated in `CLAUDE.md`: ts-jest runs with `isolatedModules`. A test can assert against a signature that no longer exists. Add a `tsconfig` that includes tests to `npm run typecheck`.

### QC-08 · P2 · End-to-end coverage

`playwright.config.ts` says the root suite "cannot fail when a real generated MFE breaks". Real composition is covered only by `composition.yml`. No test installs the CLI the way a user would.
