---
id: 0120
title: >-
  The decomposition proposal model is a package that every caller reaches in-process, and the
  workspace's agent reaches a hosted model through the coder seam's API transport, its edits
  checked by the same deterministic floor before anything acts on them
status: Implemented
date: 2026-10-25
deciders: [sean]
area: Decomposition / packaging / agent
enforcement: code
tags: [decomposition, packaging, layering, coder, agent, transport]
relates-to: [19, 84, 85, 88, 110, 116, 118]
supersedes: [117]
superseded-by: []
implements-pdr: [9, 10, 11]
implemented-by:
  - packages/decompose/src/index.ts
  - packages/decompose/src/ask.ts
  - packages/plugin-coder/src/api-runner.ts
  - packages/plugin-coder/src/adaptors/decomposition-edit.ts
  - src/decompose/agent.ts
  - packages/workspace/src/api/server.ts
verified-by:
  - src/__tests__/import-direction.test.ts
  - packages/decompose/src/__tests__/ask.test.ts
  - packages/plugin-coder/src/__tests__/api-runner.test.ts
  - src/decompose/__tests__/agent.test.ts
tracked-by: ["#454"]
summary: >-
  ADR-117 (the coder seam gains an `api` transport and in-repo prompt adaptors) is folded in
  here beside ADR-118's package decision, because the two are one choice seen from two sides:
  the agent can sit behind the workspace's API without a child process per edit only because
  the model is a package. This ADR records the two choices and what was rejected; what each
  command does lives in docs/decompose-propose.md. Its other purpose is to say how ADRs are
  written in this track from here.
rationale-summary: >-
  Ten ADRs in a month for one feature (#454) meant several described a command rather than
  recorded a choice. Folding 117 into one successor keeps both choices and their costs in one
  place; ADR-118 stays, as the layering decision this builds on.
long-form: true
---

## Context

ADR-117 added an `api` transport and prompt adaptors to `@seans-mfe/plugin-coder`. ADR-118
moved the proposal model into `@seans-mfe/decompose`. Both are Implemented and both stand; they
were written a day apart for one feature (#425) and each restates the other's seam. #454 asked
which ADRs in the decomposition track record a choice and which describe a command.

## Decision

### 1. The model is a package; the CLI is one of its callers (carries ADR-118)

Every consumer — commands, the workspace API, the coder adaptor — calls `@seans-mfe/decompose`
in-process. Nothing shells out to the CLI to read a proposal or copies its edit schema. The
rejected arrangement cost three child-process round trips per agent edit, a second edit schema
with no gate holding the two together, and a `decompose` topic split across core and a plugin.
`src/__tests__/import-direction.test.ts` enforces the direction.

### 2. The agent uses the coder seam's `api` transport (carries ADR-117)

`CoderTransport` gains `{ kind: 'api', provider, model? }` beside `subprocess` and `serve`. The
key comes from the environment only. A hosted model takes no weights, so an adaptor on this
transport is a **prompt adaptor** — system prompt, context assembler, output schema — kept in
this repository as data. The first is `decomposition-edit`: a request and the current
`decomposition.yaml` in, the named edit operations `decompose:edit` already applies out.
Rejected: a second agent channel beside the coder seam.

### 3. The oracle decides, whatever the transport

Every edit the model proposes is dry-applied to a copy of the document and the derived fleet
validated; failures are dropped with the reason. Survivors are written as pending suggestions
and nothing changes until a person accepts one. This is PDR-010's floor applied to the agent.

## Boundaries

- Intent→manifest in `coder:compile` keeps ADR-085's local default.
- Recorded response bodies are not sent to the model; redaction is #424's.
- Whether `src/decompose/` (capture, analyze, verify, which need a browser or the TypeScript
  parser) should become its own package was measured in #454 and left alone: only the CLI calls
  it. A second caller — a hosted relay, an MCP tool, a plugin — is the reason to revisit.

## How decomposition ADRs are written from here

An ADR records a **choice and the alternative it rejected**. What a command does, its flags and
its output belong in the explainer under `docs/`, which can change without a new decision. If an
ADR has no rejected alternative, it is probably an explainer.

## Consequences

The agent pane gets a capable model with no install beyond an API key, through the seam the
platform already governs. The costs are an outbound dependency on a provider, prompt adaptors
that need their own tests because a prompt can change behavior with no code diff, and the
discipline in the last section. A worse prompt yields fewer accepted edits, never an invalid
document.
