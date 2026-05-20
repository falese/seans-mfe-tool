---
id: 0068
title: Two-headed giant — AI-native + human-legible developer experience
status: Accepted
date: 2026-04-26
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [dx, ai, cli, meta]
summary: The target developer of seans-mfe-tool is a two-headed giant — one head is an AI agent that moves fast and makes decisions; the other is a human who rationalizes, audits, and can take over. The CLI is the universal interface for both heads.
rationale-summary: Building ABC Kids exposed that the tool was designed for a single-headed human. The AI head needs zero-registry scaffolding, machine-readable output, and structured errors it can parse and fix. The human head needs audit trails, a system map, and file ownership markers so it always knows what the AI did and where it can safely take over. A shared CLI with --json/--no-interactive as the "agent profile" serves both without diverging tool surfaces.
long-form: true
enforcer-config:
  cli-agent-profile-flags: [--json, --no-interactive, --dry-run]
  cli-human-profile: colored output with prompts (default when flags absent)
  ownership-markers: [GENERATED, DEVELOPER-OWNED]
  exit-codes: [0, 2, 64, 65, 66, 69, 70, 77, 124]
---

# ADR-068: Two-headed giant — AI-native + human-legible developer experience

## Context and problem statement

Building ABC Kids (issues #133–#137) using `seans-mfe-tool` as the scaffolding tool exposed a fundamental mismatch between how the tool was designed and how it is actually used in an AI-assisted workflow.

The tool was built for a single-headed human: interactive prompts, colored terminal output, no machine-readable output mode, and the implicit assumption that the developer is present to interpret ambiguous errors. In practice, the developer is often an AI agent operating in a sandboxed environment with no live npm registry, no TTY, and no ability to interpret chalk-colored output.

But the human developer does not disappear — they need to understand what the AI built, audit the decisions, identify where to take over, and hand back cleanly when done.

### The two heads

**The AI head** moves fast. It:
- Writes manifests from natural language descriptions
- Scaffolds remotes, generates platform code, iterates on generated stubs
- Runs builds, parses errors, and attempts fixes — without human input in the inner loop
- Needs structured output it can parse (`--json`), non-interactive mode (`--no-interactive`), and typed exit codes it can branch on

**The human head** rationalizes. It:
- Reads what the AI built and understands why decisions were made
- Audits the generated system to decide where to take over
- Hands back to the AI with a clear picture of what changed
- Needs audit trails, a system map, and explicit file ownership markers

## Decision drivers

- The tool must serve both heads without maintaining two separate tool surfaces
- The AI head must be able to work in sandboxed, registry-blocked, TTY-less environments
- The human head must be able to understand any AI-generated artifact without reading source code
- Neither head should be a second-class citizen

## Considered options

### Option A: CLI as the universal interface (CHOSEN)
One CLI, two profiles. `--json --no-interactive` is the agent profile; colored prompts are the default human profile. The same commands work in both modes. Structured output, typed errors, and typed exit codes make the agent profile machine-parseable. Human-facing additions (`explain`, `system:map`, audit log, ownership markers) layer on without changing the agent profile.

### Option B: MCP server as the AI interface
Expose generation directly as MCP tools, keep the CLI for humans. Two separate surfaces that must be kept in sync. Every new capability requires MCP plumbing in addition to CLI wiring. MCP servers add a running process dependency. **Rejected**: the CLI already has the right shape; MCP wrapping would add complexity without adding capability.

### Option C: Agent SDK / library mode only
Publish `@seans-mfe/codegen` as a zero-dependency library that agents call directly, deprecate the CLI. **Rejected as the primary interface**: the CLI remains the right unit of composition for both human and CI use. The library is additive (see issue #140), not a replacement.

## Decision outcome

**Option A.** The CLI is the universal interface for both heads. The design principle:

> If a command works for a human, it must also work with `--json --no-interactive`. If it produces colored output for a human, it must produce a `CommandResult<T>` envelope on stdout under `--json`. If it exits 0 for success, it must exit a typed code (64–124) for every failure class so an agent can branch without parsing stderr.

### Agent profile (AI head)

```bash
seans-mfe-tool remote:generate --json --no-interactive 2>/dev/null
# → stdout: exactly one line, CommandResult<GenerateResult> envelope
# → exit:   0 (ok) | 64 (validation) | 65 (business rule) | 69 (system/fs)
```

The agent reads `result.success`, branches on `result.error.code`, and retries or escalates. No TTY required. No npm registry required for generation (issue #140 — `@seans-mfe/codegen` as zero-dependency package).

### Human profile (human head)

Same commands, no flags: chalk output, interactive prompts, spinners. Additionally:

- `seans-mfe-tool explain [path]` — one-page human-readable summary of any MFE: what it does, what was generated, what decisions were made, what files the developer owns (issue #147)
- `seans-mfe-tool system:map` — full MFE graph: all remotes, their capabilities, their connections, their health — no running services required (issue #146)
- Audit log (`~/.seans-mfe-tool/audit.log` or `.seans-mfe-tool/audit.jsonl` per project) — every generation command logs what was written, what was skipped (DEVELOPER-OWNED), and why (issue #145)
- File ownership markers — generated files carry `// GENERATED — do not edit` headers; developer-owned files carry `// DEVELOPER-OWNED` headers so the AI knows not to overwrite them (issue #145)

### Manifest as the AI's primary interface

The manifest (`mfe-manifest.yaml`) is the boundary between the two heads. The AI writes the manifest; the tool generates from it. This means:

- The manifest must have a published JSON Schema so the AI gets validation feedback before generation, not at build time (issue #141)
- Capability types must be richer than `domain` — `game-canvas`, `ui-card`, `data` generate meaningfully different stubs (issue #142)
- The manifest must be human-readable too: the `explain` command renders it as prose

### Shell first-class

The host app is as important as the remotes. It needs the same generator treatment: `shell:init` scaffolds the host; `shell:sync-types` regenerates `remotes.d.ts` from the registered remote manifests (issue #144). Without this, the AI writes the shell by hand (as it did for ABC Kids) and type declarations drift.

## Consequences

- **Positive:** One CLI, two modes. No diverging tool surfaces. Every new command works for both heads from day one if it follows the `BaseCommand` pattern (which enforces the `--json` envelope).
- **Positive:** The human always has a legible picture of what the AI built (`explain`, `system:map`, audit log).
- **Positive:** The AI can work in fully isolated environments (no registry, no TTY, no running services).
- **Negative:** Every new command must be written to the `BaseCommand` contract. Shortcuts (raw `console.log`, `process.exit(1)`) are disallowed. This is enforced by `BaseCommand.run()` but requires discipline in command authors.
- **Neutral:** MCP is not ruled out as an additional surface later — but it would be a thin wrapper over `CommandResult` envelopes, not a new interface design.

## Verification

`enforcement: convention`. There is no automated gate today. The convention is:

1. Every command extends `BaseCommand` and implements `runCommand(): Promise<T>` — enforced by TypeScript
2. Every command works with `--json --no-interactive` — verified manually per command
3. Every generated file carries the correct ownership marker header — verified in code review
4. `system:map` and `explain` produce output parseable without running services — verified by CI smoke test

## Implementation

Issues implementing this ADR:

| Issue | Feature | Theme |
|-------|---------|-------|
| #140 | `@seans-mfe/codegen` zero-dependency package | Generator Liberation |
| #141 | Manifest JSON Schema + structured validation | Manifest as Truth |
| #142 | Richer capability shapes (`game-canvas`, `ui-card`, `data`) | Manifest as Truth |
| #143 | Universal `--json` / `--dry-run` / `--no-interactive` + `status` command | CLI as universal interface |
| #144 | `shell:init` + `shell:sync-types` | Shell First-Class |
| #145 | AI decision audit log + file ownership markers | Human Visibility |
| #146 | `system:map` command | Human Visibility |
| #147 | `explain` command | Human Visibility |
| #148 | Structured build error output | AI First-Class |
| #149 | Fix rspack alias depth + `dsl-mfe` example | DX housekeeping |

## Related

- ADR-065 (error classification — exit codes 64–124 that make the agent profile work)
- Epic #139 (two-headed giant DX epic — parent of issues above)
- `examples/abc-kids/` — the ABC Kids build that motivated this ADR
