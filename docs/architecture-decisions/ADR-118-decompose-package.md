---
id: 0118
title: >-
  The decomposition proposal model is a package, @seans-mfe/decompose; every command, plugin and
  library that reads or changes a proposal calls it in-process, and the CLI is one of its callers
  rather than the only door to it
status: Implemented
date: 2026-10-25
deciders: [sean]
area: Decomposition / packaging / layering
enforcement: code
tags: [decomposition, packaging, layering, plugins, workspace, agent]
relates-to: [19, 61, 81, 88, 110, 116, 117]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by:
  - packages/decompose/src/index.ts
  - packages/decompose/src/ask.ts
  - packages/decompose/src/files.ts
  - packages/workspace/src/api/server.ts
  - packages/plugin-coder/src/adaptors/decomposition-edit.ts
  - src/decompose/agent.ts
  - src/commands/decompose/ask.ts
  - src/commands/decompose/workspace.ts
verified-by:
  - src/__tests__/import-direction.test.ts
  - packages/decompose/src/__tests__/ask.test.ts
  - packages/workspace/src/api/__tests__/server.test.ts
  - packages/workspace/src/run/__tests__/workspace.test.ts
  - packages/plugin-coder/src/adaptors/__tests__/decomposition-edit.test.ts
  - src/decompose/__tests__/agent.test.ts
tracked-by: ["#425"]
summary: >-
  The proposal model — the decomposition.yaml schema, the named edits, the derivation and
  validation of the fleet, the status the workspace renders, the agent's suggest-and-check flow,
  and reading and writing a proposal directory — moves out of `src/decompose/propose/` into
  `packages/decompose` (`@seans-mfe/decompose`, on contracts and dsl). The `decompose:*` commands
  become thin wrappers over it. The workspace becomes a library package, `@seans-mfe/workspace`,
  which reads and edits proposals through the package; `decompose:workspace` and a new
  `decompose:ask` are core commands. `@seans-mfe/plugin-coder` keeps the `api` transport and the
  `decomposition-edit` prompt adaptor, whose edit schema it now takes from the package. Each
  topic has one owning package. Child processes inherit the command's trace.
rationale-summary: >-
  The model lived in `src/`, which no package may import, so every consumer outside `src/` had
  to shell out to the CLI to read a proposal or copy its schema to describe one. Parts 2–4 of
  #425 did both: three child-process round trips per agent edit, a second copy of the edit
  schema with no gate holding the two together, decomposition logic inside the generic coder
  seam, a `decompose` topic split between core and a plugin, and a plugin that had to know the
  model provider's environment variable. Packaging the model removes the reason for all of it,
  and the import-direction gate can then hold the layering.
long-form: true
---

## Context

ADR-110 made `decomposition.yaml` the one document a decomposition is agreed in, and named
edits (ADR-110 §4) the only way it changes. Everything that implements that lived in
`src/decompose/propose/`: the schema (`model.ts`), the edits (`edit.ts`), the derived fleet
(`derive.ts`), the workspace's read model (`status.ts`), and the I/O (`io.ts`).

`src/` is the CLI. Packages may not import it, and `src/__tests__/import-direction.test.ts`
enforces the package layering. So each package that needed the model worked around its
absence:

- **plugin-workspace** (ADR-116 §2) read the proposal by spawning `decompose:status` and wrote it
  by spawning `decompose:edit`, then parsed the JSON envelope back.
- **plugin-coder** (ADR-117, #451) did the same three times per agent edit: status, a
  `--dry-run` per edit, then the write. It also copied the suggestable edit schema into
  `AgentEditSchema`, and no gate checks that the copy matches.
- Because the suggest flow had to live somewhere a plugin could reach, it went into
  plugin-coder as `coder:suggest`. That command knows the shape of the decompose commands'
  output, although plugin-coder is the generic coder seam (ADR-088).
- `decompose:workspace` lived in plugin-workspace, so the `decompose` topic was split between
  core and a plugin. No other topic is.
- plugin-workspace decided whether the agent was connected by reading `ANTHROPIC_API_KEY`
  itself, and called `coder:suggest` by name with no declared dependency.
- None of these child processes received the command's `traceparent` (ADR-081 §5,
  `BaseCommand.childTraceEnv()`), so the work they did was not attributed to the command.

Child processes are the right boundary for the MCP server (ADR-019): it runs commands on an
agent's behalf and must survive their `process.exit` and `chdir`. They were never meant as the
way one part of the platform reaches another part's data model.

## Decision

The proposal model is a package. Whatever reads or changes a proposal calls the package; the
CLI wraps it for people and agents, as it wraps `@seans-mfe/dsl` for manifests.

### 1. `@seans-mfe/decompose` holds the proposal model and nothing that runs a browser

`packages/decompose`, depending on `contracts` and `dsl` only, holds:

- the schema of `decomposition.yaml` and of every named edit, including which edits may be
  suggested;
- applying edits, the approval hash and its status;
- deriving the fleet: manifests, composition, and each BFF's spec cut, with its validation;
- the read model the workspace renders (`proposalStatus`), and loading it from a proposal
  directory and an evidence bundle;
- reading, editing (with a dry run) and writing a proposal directory;
- the agent's suggest-and-check flow (ADR-117 §4), with the model call **injected**: the
  package never names a provider.

Capture, source analysis, clustering, scoring and parity stay in `src/decompose/`. They need a
browser, a TypeScript parser or the layout of an evidence bundle's analysis, and only the CLI
calls them. The OpenAPI module and the report renderers move with the model. Derivation cuts
each BFF's spec with the same operation helpers that inference uses, and the workspace draws
the same overlay the report does. All of them are pure functions.

### 2. Consumers call it in-process

- The `decompose:*` commands are thin wrappers over the package.
- The workspace API reads and edits proposals through the package, not through
  `decompose:status` and `decompose:edit` child processes. This supersedes the child-process
  clause of ADR-116 §2. That clause existed so the API "cannot reach the document by any path
  the CLI does not validate". The path is now the same code, so the guarantee holds.
- The agent's edits are dry-applied in-process. This supersedes the `decompose:edit --dry-run`
  round trip from #451. `--dry-run` stays on the command, for people and scripts.

### 3. The coder seam stays generic

`@seans-mfe/plugin-coder` keeps what ADR-117 §1–§3 gave it:

- the `api` transport;
- `runPromptAdaptor`;
- prompt adaptors as data.

The `decomposition-edit` adaptor builds its output schema from the package's suggestable edits,
dropping only the `by` and `at` the caller signs with. There is one schema, so there is nothing
to drift.

The suggest flow and its command leave plugin-coder: `coder:suggest` becomes core's
`decompose:ask`, which wires the package's flow to the adaptor.

### 4. One package owns each topic; the workspace is a library

- `decompose:workspace` is a core command.
- The workspace becomes `packages/workspace` (`@seans-mfe/workspace`), a library: the API
  server, the front door, the BFF lifecycle, the approval commit, and the generated MFE in
  `decomposition-workspace/`. It ships no commands, so it is no longer "a plugin".
- Questions to the agent reach the server as an injected function. The command decides
  whether an agent is connected; the library never reads a provider's key.

### 5. Children inherit the trace

Every child process a command starts carries the command's `traceparent` (ADR-081):

- the workspace MFE's BFF and its build;
- the git commit of an approval.

### 6. The layering is enforced

The import-direction allow-list gains:

| Package | May import |
|---|---|
| `decompose` | `contracts`, `dsl` |
| `workspace` | `contracts`, `decompose` |
| `plugin-coder` | `contracts`, `dsl`, `oclif-base`, `decompose` |

Nothing in `packages/` may import `src/`.

## Boundaries

- No behavior changes for a person using the CLI or the workspace, beyond the command renames
  in §3. `decompose:edit --dry-run` and `coder:compile --api` stay.
- ADR-117's decisions stand; this ADR moves where its §4 flow runs.
- ADR-116's decisions stand except the child-process clause of §2.
- The MCP server still spawns one child process per tool call (ADR-019).

## Consequences

- Each agent question makes one model call and no CLI round trips; the workspace's reads and
  edits stop paying a Node start-up each.
- A new edit kind is added in one place and reaches the CLI, the workspace and the agent's schema
  together.
- The cost is one more package in the layering, and a rename that touches CI, the gates' MFE
  roots and the docs.
- Later consumers of proposals, such as a hosted workspace relay (ADR-116 §6), import the package
  instead of embedding a CLI.

## References

- ADR-019: out-of-process isolation, for MCP tool calls and external services.
- ADR-061: `@seans-mfe/dsl` and `@seans-mfe/codegen` as first-class packages — the precedent for lifting a model out of the CLI.
- ADR-081: trace propagation to child processes.
- ADR-088: the coder seam as a first-party plugin.
- ADR-110: the proposal document and its edits.
- ADR-116, ADR-117: the workspace and the agent.
