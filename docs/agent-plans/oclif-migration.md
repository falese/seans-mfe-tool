# oclif Migration + Agent-Callable JSON CLI + Unification Foundation

> Status: active. Tracked by issues #90–#115.
> Owner: @falese.

## Objective

Migrate `seans-mfe-tool` from Commander to oclif, establish a strict JSON command envelope for agent/MCP execution, and extract shared contracts/base-command packages needed for plugin-first ecosystem growth.

## Scope summary

- **Epic A (#90–#99):** oclif migration and dual runtime entrypoints (Bun dev + Node publish).
- **Epic B (#100–#108):** machine-readable JSON command interface with typed errors, schemas, and MCP server support.
- **Epic C (#109–#115):** shared package extraction and unification foundation for plugin/federation roadmap.

## Epic A — oclif Migration (#90–#99)

### Outcomes

- oclif command scaffolding replaces Commander boot path.
- New runtime entries: Bun (`bin/dev.ts`) for development; Node (`bin/run.js`) for published package.
- Existing command surface preserved via migration shims where required.
- Hooks and plugin support enabled.

### Work breakdown

| Issue | Title | Primary output |
|---|---|---|
| #90 | [A1] Add @oclif/core scaffold with Bun dev entry and Node published entry | base oclif scaffold, dual bin entries |
| #91 | [A2] Create BaseCommand abstract class with runCommand hook and global --json flag | shared oclif command base |
| #92 | [A3] Port deploy command to oclif Command class | deploy command migrated |
| #93 | [A4] Port api command to oclif (rename create-api.ts to api.ts with shim) | api command migrated + shim |
| #94 | [A5] Port BFF colon-topic commands to nested oclif directory (bff/{init,build,dev,validate}.ts) | bff nested command layout |
| #95 | [A6] Port remote:* commands to nested oclif dirs and implement remote:generate:capability | remote command migration + new capability |
| #96 | [A7] Swap bin entry to oclif, remove commander, delete legacy bin file | Commander removal and oclif as default entry |
| #97 | [A8] Add oclif hooks: init, prerun, postrun, command_not_found | lifecycle hooks wired |
| #98 | [A9] Enable @oclif/plugin-plugins for runtime plugin install; reserve daemon and coder topics | plugin install path and reserved topics |
| #99 | [A10] Add Bun dev script, oclif manifest generation to build, README updates | build/docs integration |

### Epic A verification gate

- `bun bin/dev.ts --help` works.
- `node bin/run.js --help` works.
- All migrated commands execute via oclif namespace layout.
- Build emits oclif manifest successfully.

## Epic B — JSON Agent Interface (#100–#108)

### Outcomes

- `CommandResult<T>` envelope standardized for all commands.
- `--json` mode emits exactly one stdout line; diagnostics to stderr.
- Typed error taxonomy with deterministic exit-code mapping.
- JSON schemas generated for command contracts.
- MCP server executes tools through child-process command isolation.

### Work breakdown

| Issue | Title | Primary output |
|---|---|---|
| #100 | [B1] Define CommandResult envelope, CommandError, and sysexits-style exit code table | envelope and exit code contract |
| #101 | [B2] Wire JSON envelope into BaseCommand with stdout/stderr split and prompt rejection | BaseCommand JSON behavior |
| #102 | [B3] Convert command functions from Promise<void> to typed result interfaces | typed command returns |
| #103 | [B4] Replace raw throw new Error in commands with typed errors from src/runtime/errors | typed error migration |
| #104 | [B5] Auto-generate JSON Schemas for every command (inputs + outputs) to schemas/ | schema generation pipeline |
| #105 | [B6] Add `seans-mfe-tool schemas` command for live tool catalog discovery | schema discovery command |
| #106 | [B7] Implement `seans-mfe-tool mcp serve` MCP server (child-process per tool call) | MCP server + tool execution bridge |
| #107 | [B8] Normalize --dry-run across all mutating commands and surface plannedChanges in JSON | dry-run normalization |
| #108 | [B9] Integration test: JSON contract round-trip with ajv schema validation | end-to-end JSON validation tests |

### Epic B verification gate

- Every migrated command supports `--json` envelope semantics.
- Error classification/exit mapping aligns with contract.
- Generated schemas are up to date and validated in integration tests.
- MCP tool execution path is concurrency-safe and process-isolated.

## Epic C — Unification Foundation (#109–#115)

### Outcomes

- Shared contracts and oclif base extracted into reusable packages.
- Plugin contract and skeleton published for third-party ecosystem.
- Federation and telemetry hooks prepared for daemon/coder integration.
- Monorepo/workspace foundation created for phased unification.

### Work breakdown

| Issue | Title | Primary output |
|---|---|---|
| #109 | [C1] Extract @seans-mfe/contracts workspace package (runtime contracts, typed errors, classifier, envelope) | contracts package |
| #110 | [C2] Write PLUGIN-CONTRACT.md and publish examples/plugin-skeleton | plugin contract docs + skeleton |
| #111 | [C3] Extract @seans-mfe/oclif-base package (BaseCommand, json-output, envelope glue) | oclif base package |
| #112 | [C4] Wire postrun hook to emit telemetry to daemon over graphql-ws | telemetry emission integration |
| #113 | [C5] MCP federation: tool registry loads from local, oclif plugins, and remote MCP sources | federated tool registry |
| #114 | [C6] pnpm workspaces + Turborepo scaffolding for the two extracted packages | workspace/turbo scaffolding |
| #115 | [C7] Write MERGE-PLAN.md: phased path to absorb Falese/daemon and Falese/coder | merge plan document |

### Epic C verification gate

- `@seans-mfe/contracts` and `@seans-mfe/oclif-base` are consumed by CLI and plugin path.
- Plugin contract and skeleton are usable as external starter.
- MCP federation resolves local, plugin, and remote sources.
- Workspace tooling (`pnpm`, Turborepo) builds and tests package graph.

## Sequencing and dependencies

1. Run Epic A first to establish oclif runtime baseline.
2. Start Epic B once BaseCommand and command ports are stable.
3. Begin Epic C package extraction after B1/B2 shape the canonical envelope/errors contract.
4. Keep plugin-first architecture throughout; monorepo absorption remains phased and explicit in `MERGE-PLAN.md`.

## Cross-epic invariants

- Locked decisions in `CLAUDE.md` remain authoritative unless superseded by a new ADR.
- JSON envelope contract is stable for MCP and external callers.
- Legacy compatibility shims remain until migration checkpoints explicitly remove them.
- No direct coupling to Falese/daemon or Falese/coder internals before merge-plan phases.

## Verification gates (global)

Run before merge for each issue/PR:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test` (or `npm run test:ci` when runtime coverage gates apply)
4. `npm run build`
5. Post-B5 issues: `npm run build:schemas && git diff --exit-code schemas/`

## Risks and mitigations

- **Migration drift across many small PRs** → enforce issue-scoped acceptance checks and prompt-required reads.
- **Contract breakage for agents/tools** → keep envelope + schema generation under integration tests.
- **Package extraction churn** → sequence C1/C3/C6 and keep import-path transitions explicit.
- **Plugin/runtime coupling regressions** → maintain child-process MCP execution and typed error boundaries.

## Open items deferred

- Exact timing and operational mechanics for absorbing `Falese/daemon` and `Falese/coder` remain governed by `MERGE-PLAN.md` deliverables (C7) and follow-on implementation issues.
