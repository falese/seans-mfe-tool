---
id: 0016
title: BaseCommand pattern — every oclif command extends BaseCommand
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [cli, oclif, base-command, json-envelope, error-handling]
summary: Every oclif command must extend BaseCommand from @seans-mfe/oclif-base and implement runCommand() instead of run(), which provides automatic JSON envelope output, structured error handling, and hook lifecycle.
rationale-summary: Without a shared base, each command reimplements --json output, error serialisation, and exit code logic differently; BaseCommand enforces a single contract that works for both human (colored) and AI (--json) consumers.
long-form: true
---

# ADR-016: BaseCommand pattern — every oclif command extends BaseCommand

## Context

After the oclif migration (ADR-015), commands were standalone oclif Command subclasses with no shared behavior. The ADR-033 two-headed-giant model requires every command to:

1. Emit exactly one `CommandResult<T>` JSON line to stdout when `--json` is passed
2. Send all non-data output (progress, warnings) to stderr
3. Throw typed errors (ADR-017) instead of raw `Error`
4. Support `--dry-run` for all mutating commands
5. Exit with structured exit codes (0, 2, 64–70, 77, 124)

Repeating this logic in every command is fragile and inconsistent.

## Decision

Extract `BaseCommand` into `packages/oclif-base/src/BaseCommand.ts`. Rules:

- Every command **extends BaseCommand** from `@seans-mfe/oclif-base`
- Commands implement **`runCommand()`** not `run()` — BaseCommand's `run()` handles the envelope
- BaseCommand wraps `runCommand()` in a try-catch that serialises typed errors into `CommandResult<T>` on failure
- `--json` flag is declared on BaseCommand; all commands inherit it
- `--dry-run` is declared as a shared flag for mutating commands
- On success: BaseCommand writes `JSON.stringify(result)` to stdout; all `this.log()` calls go to stderr
- On failure: BaseCommand writes the error envelope to stdout (not stderr) when `--json` is active

## Consequences

**Positive:**
- Single source of truth for envelope format, exit codes, and error serialisation
- AI agents can rely on exactly one stdout line in `--json` mode
- New commands automatically get `--json`, error handling, and dry-run behavior

**Negative:**
- All commands must extend BaseCommand — no plain `Command` subclasses allowed
- BaseCommand is a shared dependency; breaking changes require coordinated updates across all commands

## References

- `packages/oclif-base/src/BaseCommand.ts`
- `packages/contracts/src/envelope.ts` (CommandResult<T>)
- ADR-018: CommandResult<T> JSON envelope
- ADR-033: Two-headed giant developer model
