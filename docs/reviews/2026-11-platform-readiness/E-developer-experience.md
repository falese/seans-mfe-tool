# E. Developer Experience Assessment

The CLI was not executed in this review (no installed dependencies). Everything here comes from command source, the generated schemas and the documentation. Help output and error text as a user sees them are **not verified**.

## 1. The CLI as an interface

### What works

| Property | Evidence |
|---|---|
| One machine contract for every command | `packages/oclif-base/src/BaseCommand.ts`: one `CommandResult` line on stdout under `--json`, all else on stderr |
| Failure classes a script can branch on | Typed errors map to sysexits codes in both JSON and human mode |
| No hanging on prompts | `--no-interactive`, implied by `--json` |
| Typo recovery | `src/hooks/command-not-found.ts` returns up to three nearest command ids inside the envelope |
| Self-describing | `schemas/<topic>-<cmd>.json` generated from flags and return types, gated in CI |
| Trace continuity | `TRACEPARENT` adopted and passed to children |
| "Where am I" for multi-step work | `flow:status` derives the next command from files on disk |

This is a better agent-facing contract than most commercial CLIs have.

### What does not

| Problem | Evidence | Finding |
|---|---|---|
| No install path | Not on a registry; `file:` dependencies | ARC-01 |
| 33 commands in one flat help, with no stability signal | Core, proof-of-concept and repo-maintenance commands are peers | ARC-07 |
| Three spellings for output, two types for port, five ways to name the project | Flag survey | QC-04 |
| `--dry-run` promised everywhere, present in nine files | Flag survey | QC-05 |
| Human output bypasses the framework | About 385 direct `console.*` calls with `chalk` | QC-01 |
| No `--version` detail, no `doctor` for the environment | `mfe:validate` checks a project, nothing checks the toolchain (Docker, Bun, Node, Swift, Cargo) | new, P2 |
| No shell completion | `@oclif/plugin-autocomplete` is not in `oclif.plugins` | new, P3 |
| No update notice | No `@oclif/plugin-warn-if-update-available` | new, P3 |
| Cross-platform gaps | Gate scripts are bash. `sources/plugin.ts` hardcodes `~/.local/share`. `execSync` strings depend on a POSIX shell. Windows is **not evaluated** and likely broken | new, P2 |

### Configuration precedence

There is no single configuration model. Settings come from:

- flags and positional arguments,
- `mfe-manifest.yaml` and `control-plane.yaml` in the project,
- environment variables (`SEANS_MFE_DAEMON_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET`, `CORS_ORIGIN`, `TRACEPARENT`, `DEBUG`, and more),
- user files (`~/.config/seans-mfe/mcp.json`).

No document lists the environment variables or states which source wins. That is a documentation gap first (see [F](./F-documentation-audit.md)).

## 2. Eight journeys

Status reflects an adopter **outside** this repository. Inside it, journeys 2 to 5 work for the author.

| # | Journey | Status | Where it breaks |
|---|---|---|---|
| 1 | Install | **Blocked** | Only "clone, `npm install`, `npm run build`". No package to install |
| 2 | Initialize a project | Works in-repo | `remote:init <name>` is clear. Then `npm install` cannot resolve the runtime (inference, ARC-01) |
| 3 | Configure | Unclear | Manifest is well specified, with a generated field reference. Environment variables are undocumented |
| 4 | Discover capabilities | Partial | `--help` and `schemas` exist. README lists under half the commands (DOC-01) |
| 5 | Run a command | Good | Consistent envelope and exit codes |
| 6 | Troubleshoot | Partial | Error types are good. No troubleshooting guide. The runbook that exists is under `docs/archive/` |
| 7 | Extend | Blocked for third parties | Good authoring guides. Nothing to depend on until packages are published |
| 8 | Upgrade | **Absent** | No versions, changelog or upgrade guide. `PLATFORM_MIGRATIONS` and `mfe:validate` are a strong mechanism with no release to attach to |

Journey 8 deserves a note. The migration registry (ADR-082) detects stale developer-owned code by usage and prints a fix. That is the hard part of upgrades, already solved. It needs version numbers and a changelog around it to become an upgrade story.

## 3. Concept load

A newcomer currently meets about twenty concepts (ARC-06). Most are needed only by a specific role.

### The minimum set

| To do this | You must understand |
|---|---|
| Build one MFE | **Manifest**, **capability**, **generate**, and **which files are yours** |
| Add data | plus **BFF** (a `data:` section) |
| Compose a fleet | plus **slot**, **placement rule**, **shell** |
| Run a fleet | plus **registry** and **daemon** |

Four concepts for the first success. Everything else (targets, variants, contributors, adaptors, sentinel ports, flows, migrations) is for extenders and maintainers and should stay out of the first hour.

### Where the model leaks

| Leak | Where a user meets it |
|---|---|
| "Plugin" means two things | `packages/README.md` has to warn about it |
| "Adaptor" means two things | Layout adaptors in the runtime, prompt adaptors in `plugin-coder` |
| ADR numbers in user-facing text | Command descriptions, topic descriptions, error fixes. For example the `coder` topic: "…(ADR-085/ADR-088)" |
| The tool's name varies | `seans-mfe-tool`, "SMT", `@seans-mfe`, `@seans-mfe-tool` |
| Repository process as product surface | `adr:*` and `sentinel:*` appear in the product's help |

## 4. A consistent interaction model

Proposed rules. Each one can be checked by the existing conformance sweep (`src/oclif/__tests__/command-conformance.test.ts`).

1. **Project location.** The first positional argument is always the directory, defaulting to the current one. `--manifest` overrides the file inside it. Retire `--cwd`, `--src`, `--source-root` as separate ideas where they mean the same thing.
2. **Output.** Always `--out`. Alias the other two for one release, then remove.
3. **Ports.** Always `Flags.integer`.
4. **Writes.** A command that writes declares `mutating = true` and must offer `--dry-run`. The sweep asserts it. This makes the README's claim true by construction.
5. **Checks.** `--check` always means "exit non-zero if output would change". Already the pattern in `compose:validate` and the gate scripts.
6. **Human output.** Commands print through one helper on `BaseCommand`. Libraries never print (already true).
7. **Stability.** Each command carries `state: core | beta | experimental | deprecated`. oclif renders this in help.
8. **Agent exposure.** Each command declares whether it is an MCP tool and whether it is read-only (SEC-06).
9. **Text.** No ADR numbers in descriptions or error messages. Link a docs page instead.

## 5. Reducing the surface

| Change | Effect |
|---|---|
| Move `decompose:*`, `design:*`, `flow:*` to opt-in plugins | Default help drops from 33 to about 16 commands |
| Move `adr:*`, `sentinel:*` to a dev-only plugin not shipped in the published CLI | Removes repository governance from the product |
| Remove `deploy` | Removes a command that cannot work (ARC-04) |
| Fold `build:check` into `mfe:validate` (alias `doctor`) | One "is my project healthy" command. Needs a closer read of both before deciding |
| Add `doctor --env` | Answers journey 6 for toolchain problems |
| Collapse the sixteen pre-push gates behind `npm run verify` that picks gates from the changed paths | Contributor experience. `turbo` is already present |

## 6. Suggested measures

| Measure | Today | Target after Phase 4 |
|---|---|---|
| Commands from clean machine to a running MFE | Cannot be completed | 4 or fewer |
| Concepts needed for first success | About 20 visible | 4 |
| Commands in default help | 33 | About 16 |
| Mutating commands with `--dry-run` | 9 files | All, asserted by test |
| Documented commands in the reference | Under half in README | All, generated |
