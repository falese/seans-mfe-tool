---
id: 0015
title: oclif as CLI framework — replace Commander
status: Accepted
date: 2026-04-17
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [cli, oclif, commander, migration, plugin-architecture]
summary: Replace the Commander-based CLI with oclif, adopting colon-topic command structure, plugin architecture, and the @oclif/core scaffold.
rationale-summary: Commander lacks plugin architecture, machine-readable output, and structured command discovery; oclif provides all three plus first-class TypeScript support and a plugin registry compatible with the falese/* ecosystem.
long-form: true
---

# ADR-015: oclif as CLI framework — replace Commander

## Context

The CLI was built on Commander.js. As the tool grew toward a plugin ecosystem (ADR-022) and an AI-native developer model (ADR-033), Commander's limitations became blockers:

- No plugin architecture: third-party commands cannot be added without forking the CLI
- No structured output: no built-in `--json` flag or `CommandResult<T>` envelope support
- Flat command namespace: no colon-topic structure (e.g. `remote:init`, `bff:build`)
- Commander forces process-exit on validation errors, making child-process isolation (ADR-019) fragile

oclif had already emerged as the leading TypeScript CLI framework with a plugin system, auto-generated help, and tight oclif-manifest tooling for command discovery.

## Decision

Migrate the entire CLI to oclif v3 / @oclif/core:

- All commands use colon-topic structure: `remote:init`, `remote:generate`, `bff:init`, `bff:build`, `deploy`, `schemas`, `mcp:serve`
- `bin/dev.ts` — Bun dev entry, no transpile (see ADR-020)
- `bin/run.js` — Node published entry, loads `dist/commands/`
- Plugin architecture enabled via `@oclif/plugin-plugins`; `daemon` and `coder` ship as separate oclif plugins (ADR-022)
- Reserved topics: `daemon`, `coder` (for future falese/* plugins)

## Consequences

**Positive:**
- Plugin ecosystem: any team can publish `@falese/plugin-*` commands
- Structured help and manifest generation (`oclif manifest`)
- `--json` and `--no-interactive` flags integrate cleanly via BaseCommand (ADR-016)
- oclif lifecycle (init/prerun/postrun/command-not-found hooks) replaces ad-hoc Commander middleware

**Negative:**
- All existing Commander commands had to be ported (Epic A + B + C, PR #123)
- oclif manifest file must be regenerated after any command signature change (`npm run build:schemas`)

## References

- PR #123 (Epics A + B + C — full oclif migration)
- ADR-016: BaseCommand pattern
- ADR-020: Bun/Node split
- ADR-022: Plugin-first architecture
