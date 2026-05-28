---
id: 0018
title: CommandResult<T> JSON envelope — single stdout line under --json
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [cli, json-envelope, oclif, ai-native, stdout]
summary: Under --json, every command emits exactly one CommandResult<T> JSON object to stdout; all other output (progress, warnings, interactive prompts) goes to stderr.
rationale-summary: AI agents parsing CLI output need a guaranteed single parseable line on stdout; mixing progress messages with data output makes stdout unparseable without complex filtering.
long-form: true
---

# ADR-018: CommandResult<T> JSON envelope — single stdout line under --json

## Context

ADR-033 established that the CLI serves two heads: a human head that reads colored output and an AI head that parses structured output. The AI head needs a contract it can rely on:

- **Exactly one line** on stdout when `--json` is active
- **Machine-parseable** — valid JSON, not a stream of partial updates
- **Typed result** — data typed as `T`, error as a structured object with `code`
- **No process.exit** surprises — BaseCommand controls exit code, not individual commands

Without this contract, every MCP tool wrapper (ADR-019) would need ad-hoc parsing logic.

## Decision

`CommandResult<T>` from `packages/contracts/src/envelope.ts`:

```typescript
interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    type: string;  // matches typed error class name
  };
  meta?: {
    dryRun?: boolean;
    duration?: number;
  };
}
```

Rules enforced by BaseCommand (ADR-016):

1. In `--json` mode: write exactly `JSON.stringify(result)` + newline to **stdout**. Nothing else goes to stdout.
2. All `this.log()`, `this.warn()`, progress output goes to **stderr** — including in `--json` mode.
3. On success: `{ success: true, data: T }` 
4. On typed error: `{ success: false, error: { message, code, type } }`
5. Exit code 0 on success, non-zero on error (following sysexits.h convention from ADR-033)

## Consequences

**Positive:**
- MCP child-process tools (ADR-019) parse stdout with `JSON.parse()` — no regex needed
- Integration tests use `ajv` to validate the envelope schema (B9 integration tests)
- `--dry-run` result carries `meta.dryRun: true` so callers can distinguish simulated runs

**Negative:**
- Human-readable progress messages are silenced on stdout in `--json` mode (expected, by design)
- Breaking change from Commander's ad-hoc output: all output contracts changed at migration time

## References

- `packages/contracts/src/envelope.ts`
- `packages/oclif-base/src/BaseCommand.ts`
- ADR-016: BaseCommand pattern
- ADR-019: MCP child-process isolation
- ADR-033: Two-headed giant developer model
