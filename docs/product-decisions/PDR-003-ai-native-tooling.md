---
id: 0003
title: AI-native, agent-operable tooling
status: Accepted
date: 2026-05-21
deciders: [sean]
supersedes: []
superseded-by: []
tags: [dx, ai, cli, mcp]
summary: The developer is increasingly an AI agent in a sandbox; the tool serves an AI head (machine-readable output, typed errors, no TTY/registry) and a human head (audit, ownership markers, explain/map) through one CLI rather than two diverging surfaces.
---

# PDR-003: AI-native, agent-operable tooling

## Problem space

The tool was built for a single-headed human: interactive prompts, chalk-colored
output, no machine-readable mode, and the assumption that a person is present to
interpret an ambiguous error. Building real MFEs with AI assistance exposed the
mismatch — the "developer" is often an **AI agent in a sandbox** with no live npm
registry, no TTY, and no ability to read colored output. It needs structured output it
can parse, non-interactive execution, and typed exit codes it can branch on.

But the human does not disappear. They need to understand what the agent built, audit
the decisions, and know exactly which files are safe to take over. A tool that serves
only the agent is unauditable; a tool that serves only the human cannot be driven at
agent speed. The risk is building **two diverging tool surfaces** — one for humans, one
for agents — that must be kept in sync forever.

## Decision

One CLI, two profiles. `--json --no-interactive` is the **agent profile**: exactly one
`CommandResult<T>` envelope on stdout, everything else on stderr, typed exit codes
(64–124) per failure class. The default is the **human profile**: colored output,
prompts, spinners. The same commands serve both. The **manifest is the boundary**
between the heads — the agent writes the manifest, the tool generates from it, and the
human reads it (as prose via `explain`). Human-facing affordances (`explain`,
`system:map`, an audit log, `// GENERATED` / `// DEVELOPER-OWNED` markers) layer on
without changing the agent profile.

## Why this over alternatives

- **MCP server as a separate AI interface (rejected as primary).** Exposing generation
  as MCP tools while keeping the CLI for humans means two surfaces to keep in sync and a
  running-process dependency. MCP is kept as a *thin wrapper* over the same
  `CommandResult` envelopes (`mcp serve`), not a second interface design.
- **Library / SDK mode only (rejected as primary).** A zero-dependency `@seans-mfe/codegen`
  library is useful and additive, but the CLI remains the right unit of composition for
  humans, CI, and agents alike.

## Success signals

- An agent runs `remote:generate --json --no-interactive` in a registry-blocked,
  TTY-less sandbox, branches on `result.error.code`, and fixes-and-retries with no human
  in the inner loop.
- A human runs `explain` / `system:map` and understands what the agent built and which
  files they own — without reading generated source.
- New commands work for both heads on day one purely by extending `BaseCommand`; no
  command needs bespoke JSON or exit-code handling.

## Consequences / trade-offs

- **Positive:** No diverging tool surfaces. The contract that makes the agent profile
  work (typed errors → exit codes) is the same contract that gives humans legible
  failures.
- **Positive:** This is the decision that lets agents safely scale MFE generation — the
  precondition for the ecosystem thesis (PDR-006).
- **Negative:** Every command must be written to the `BaseCommand` contract; raw
  `console.log` / `process.exit(1)` are disallowed. Enforced structurally by
  `BaseCommand.run()` but still requires discipline from command authors.
- **Neutral:** "Convention, no automated gate" today — adherence is verified in review
  and by smoke tests, not yet by CI lint rules.

## Implemented by

- ADRs: ADR-033 (two-headed giant — AI-native + human-legible DX), ADR-016 (`BaseCommand`
  pattern), ADR-017 (typed error hierarchy), ADR-018 (`CommandResult<T>` JSON envelope),
  ADR-019 (MCP child-process isolation), ADR-030 (error classification → the exit codes
  the agent profile branches on).
- Code: `packages/oclif-base/src/BaseCommand.ts` (envelope, exit codes, stdout/stderr
  split), `packages/contracts/src/envelope.ts` + `packages/contracts/src/errors/`
  (`CommandResult<T>`, typed error taxonomy), `src/commands/mcp/serve.ts` + `src/mcp/`
  (federated MCP tool registry), `schemas/*.json`.
- Related: PDR-001 (manifest as the agent's primary interface), PDR-004 (MCP federation
  across the plugin ecosystem).
