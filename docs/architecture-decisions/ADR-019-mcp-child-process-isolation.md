---
id: 0019
title: MCP child-process isolation — spawn seans-mfe-tool per tool call
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [mcp, child-process, isolation, ai-native, concurrency]
summary: Each MCP tool call spawns seans-mfe-tool <cmd> --json as a child process, parses stdout as CommandResult<T>, and maps it to the MCP tool response — never calling command logic in-process.
rationale-summary: In-process command invocation is unsafe because oclif commands call process.exit, mutate process.cwd, and assume a clean global state; child-process isolation makes each tool call atomic and concurrency-safe.
long-form: true
---

# ADR-019: MCP child-process isolation — spawn seans-mfe-tool per tool call

## Context

The MCP server (`src/commands/mcp/serve.ts`) exposes CLI commands as MCP tools callable by AI agents. The naive implementation would call command logic directly in-process. This is unsafe for three reasons:

1. oclif commands call `process.exit()` on validation failure — killing the MCP server
2. Some commands mutate `process.cwd()` — affecting all subsequent tool calls in the same process
3. Concurrent tool calls share mutable global state in oclif's registry — race conditions

The CommandResult<T> envelope (ADR-018) provides a clean stdout contract that makes child-process parsing trivial.

## Decision

Every MCP tool implementation in `src/mcp/tool-registry.ts`:

1. Spawns `seans-mfe-tool <cmd> [args] --json` as a child process
2. Captures stdout (the `CommandResult<T>` envelope) and stderr (logs/warnings)
3. Parses stdout with `JSON.parse()` — no regex
4. Maps `CommandResult.success` → MCP tool success/error response
5. Forwards stderr content as MCP tool metadata (visible to the AI agent for debugging)

The spawned process inherits the **caller's cwd** — not the MCP server's cwd. This ensures commands like `remote:generate` operate in the project directory the agent is working in.

## Consequences

**Positive:**
- `process.exit()` in a command kills only the child process, not the MCP server
- Each tool call is fully isolated — no shared state between concurrent calls
- Child process uses the same binary path, so the MCP server always tests the real CLI
- stderr forwarding gives the AI agent full visibility into warnings and progress

**Negative:**
- Each tool call pays the Node.js/Bun startup cost (~200–400ms)
- For batch operations (e.g., generating many files), startup cost accumulates
- Streaming progress output is not possible (only batch stdout capture)

## References

- `src/mcp/tool-registry.ts`
- `src/commands/mcp/serve.ts`
- `packages/contracts/src/envelope.ts` (CommandResult<T>)
- ADR-018: CommandResult<T> JSON envelope
