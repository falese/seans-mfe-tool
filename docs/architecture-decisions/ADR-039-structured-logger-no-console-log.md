---
id: 0039
title: Structured logger — no console.log in production code
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [logging, observability, cli, production-code]
summary: Production src/ and packages/ code uses the structured logger from @seans-mfe/oclif-base; console.log is forbidden outside tests and scripts.
rationale-summary: console.log in --json mode corrupts stdout and breaks the CommandResult<T> contract (ADR-018); structured logging routes output to stderr and adds context fields for observability.
long-form: false
---

# ADR-039: Structured logger — no console.log in production code

## Context

`console.log` in a CLI command's production code writes to stdout. When `--json` mode is active (ADR-018), stdout must contain exactly one `CommandResult<T>` JSON line. Any `console.log` call corrupts the output and breaks every tool that parses it — including the MCP child-process tools (ADR-019).

Additionally, unstructured log lines provide no context fields (timestamp, command, level) for debugging in production environments.

## Decision

In all `src/` and `packages/` production code:

- `console.log` and `console.error` are forbidden
- Use `this.log()` / `this.warn()` / `this.error()` from BaseCommand (routes to stderr)
- For library code that does not extend BaseCommand: use the structured logger from `@seans-mfe/oclif-base`
- The logger writes to stderr in all modes and includes structured fields

Allowed exceptions:
- `__tests__/**/*.ts` — test files may use `console.log` for debugging
- `bin/dev.ts` startup diagnostics — one-line startup message permitted

The linter enforces this via `no-console` rule on `src/` and `packages/`.

## Consequences

**Positive:**
- stdout is clean in `--json` mode — the `CommandResult<T>` contract is never corrupted
- All human-readable output goes to stderr, which tools can optionally forward or discard
- Structured logger fields (level, timestamp, command) are available for production debugging

**Negative:**
- Developers used to `console.log` debugging must switch to `this.log()` or temporary debug statements removed before commit

## References

- `packages/oclif-base/src/BaseCommand.ts` (this.log/warn/error)
- ADR-018: CommandResult<T> JSON envelope
- ADR-019: MCP child-process isolation
