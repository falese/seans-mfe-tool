---
id: 0121
title: >-
  An MCP tool call is untrusted input: it is checked against the tool's schema, held inside a
  root directory, and offered only tools that can answer
status: Implemented
date: 2026-11-10
deciders: [sean]
area: CLI / MCP / safety
enforcement: code
tags: [mcp, agent, security, cli]
relates-to: [18, 19, 77, 122]
supersedes: []
superseded-by: []
implements-pdr: [3]
implemented-by:
  - src/mcp/policy.ts
  - src/mcp/server.ts
  - src/mcp/tool-registry.ts
  - src/commands/mcp/serve.ts
  - src/commands/_docker.ts
verified-by:
  - src/mcp/__tests__/tool-policy.test.ts
  - src/mcp/__tests__/cwd-targeting.test.ts
  - src/commands/__tests__/docker-exec.test.ts
tracked-by: []
summary: >-
  The MCP server validates every tool call against the tool's input schema before it spawns
  anything, confines the call's working directory to a root chosen at startup, leaves three
  commands out of the tool list unless the operator allows them, stops a timed-out call
  together with the processes it started, and no longer lists tools from external MCP servers
  it cannot call. Command code runs Docker with an argument array, never a shell string.
rationale-summary: >-
  The caller of a tool is an agent acting on text it has read, so anything it sends may have
  been written by whoever wrote that text. ADR-019 isolated the child process from the server;
  it did not put anything between the caller's input and the command line. Two commands then
  interpolated that input into a shell.
long-form: true
---

## Context

ADR-019 made each tool call a child process, `seans-mfe-tool <cmd> --json`. That isolates
`process.exit` and working-directory changes. It says nothing about what the caller may send.

The 2026-11 readiness review (`docs/reviews/2026-11-platform-readiness/`, findings SEC-01 and
SEC-06) read the path from `tools/call` to the command line and found:

- `buildArgv` turned every key of the input into `--key value`. The tool's `inputSchema` was
  advertised to the caller and never applied to what came back.
- `cwd` could be any existing directory on the machine.
- Every command with a schema was a tool. That included `build:dev`, `bff:dev` and
  `decompose:workspace`, which start a server and do not return, so a call to one could only
  end at the five-minute timeout. The timeout sent `SIGTERM` to the child alone, and the
  server it had started kept running.
- `deploy` (since removed, ADR-122) and `build:docker` built `docker …` as a template string
  for `execSync`, from a name and a tag the caller chose. `x; touch /tmp/pwned` as a name ran on the host.
- A third tool source listed tools from external MCP servers named in
  `~/.config/seans-mfe/mcp.json`. `tools/call` only spawns this CLI, so each of those tools
  resolved to a command that does not exist. Loading the list ran whatever command the file
  named.

An agent reads READMEs, issues and web pages. Text in any of them can ask for a tool call.

## Decision

A tool call is checked as untrusted input, at the server, before a process is spawned.

### 1. Input is validated against the tool's schema

`validateToolInput` (`src/mcp/policy.ts`) refuses an argument the tool does not declare, a
missing required argument, a wrong type, a value outside an `enum`, a control character in a
string, and a positional that starts with `-`. The refusal is a `validation` error naming each
problem. Nothing is spawned.

A number is accepted where the command takes a string, because argv is text either way and
callers send `port: 8080`. A schema with no `properties` is passed through: a third-party
plugin's schema may predate them.

The validator is written here rather than taken from `ajv`, which is a devDependency. The
schemas `schema-derivation.ts` emits for flags and args use a small, fixed subset of JSON
Schema, and this checks exactly that subset.

### 2. The working directory is held inside a root

`mcp:serve` takes `--root <dir>`, defaulting to the directory it was started in. A call's `cwd`
must resolve, through symlinks, to a directory at or under it. A call that names no `cwd` runs
in the root. A relative `cwd` resolves against the root.

`executeToolCall` applies no root when none is passed. That is the library default and keeps
its existing callers working; the command always passes one.

### 3. Three commands are off by default

`MCP_DEFAULT_OFF` names `build:dev`, `bff:dev` and `decompose:workspace`, each with its reason. They are left out of `tools/list` unless the operator starts the server with
`--allow <command>`. An id that is not in the list is a validation error, so a typo does not
look like a missing tool.

This is separate from `CATALOG_EXCLUDED`. These commands keep their schemas in `schemas/`: they
are real commands with real contracts. What they lack is a way to answer a caller that waits
for one result: each starts a server and does not return.

### 4. A timed-out call is stopped with what it started

The child is spawned as a process-group leader. On timeout the server signals the group, and
falls back to the child alone where groups do not exist or the signal fails.

The other end of a call's life is handled too: when the client closes stdin, the server answers
the calls still in flight before it exits. It used to exit at once, which dropped the reply to
any call that had awaited anything.

### 5. No tool is listed that the server cannot call

The remote source and its configuration file are removed. It returns when there is a proxy
that forwards `tools/call` to the server that owns the tool, with tests.

### 6. Command code does not hand a shell an interpolated string

Docker runs through `runDocker` (`src/commands/_docker.ts`), which passes an argument array to
`execFileSync`. An image reference is checked against Docker's grammar first, so a value cannot be read as a Docker option either. A lint rule refuses `exec` and
`execSync` called with an interpolated template literal in `src` and `packages/*/src`.

## Boundaries

- **The environment is still inherited.** A child process receives the server's whole
  environment, including any model API key. Commands such as `decompose:ask` need that key, and
  an allow-list would break commands that read variables this repository does not know about.
  It is left as it was and is an open item.
- **Standard error still reaches the caller.** A tool result includes the child's stderr.
- **`cwd` is confined; file arguments are not.** A flag such as `--manifest` or `--out` may
  still name a path outside the root. Confining those needs each command to say which of its
  arguments are paths, which the schemas do not carry today.
- **No cancellation and no concurrency limit.** A client cannot cancel a running call, and
  nothing bounds how many run at once.
- **Plugin tools are validated only as far as their schema goes.** See §1.

## Consequences

Better: text an agent reads can no longer reach a shell through `build:docker`, cannot
pass a flag the tool never offered, and cannot point a command at a directory outside the
project. A tool call that would have hung for five minutes is no longer offered.

Worse: an operator who relied on `build:dev` as a tool must now pass `--allow build:dev`. A
client that sent undeclared arguments, which were previously passed through and usually
rejected by the command, is now refused one step earlier with a different message. Anyone who
had a `~/.config/seans-mfe/mcp.json` loses a tool list that could not be called.

The cost accepted knowingly is the hand-written validator: a second place that understands the
schema dialect. It is small, and `tool-policy.test.ts` runs it against the real `schemas/`.

## References

- ADR-018 — the one-line JSON envelope each child prints.
- ADR-019 — one child process per tool call; this record adds what is checked before the spawn.
- ADR-122 — `deploy`, one of the two commands §6 was written for, has since been removed.
- ADR-077 — the agent contract and the catalog derived from the oclif registry.
