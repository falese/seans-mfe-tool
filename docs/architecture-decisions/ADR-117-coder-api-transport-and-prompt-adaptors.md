---
id: 0117
title: >-
  The coder seam gains an API transport to a hosted model and prompt adaptors that live in this
  repository; whatever the transport, coder's output is a typed artifact the deterministic floor
  checks before anything acts on it
status: Implemented
date: 2026-10-25
deciders: [sean]
area: Generation / coder seam / transports
enforcement: code
tags: [coder, agent, transport, adaptor, decomposition, model]
relates-to: [19, 84, 85, 88, 110, 116]
supersedes: []
superseded-by: []
implements-pdr: [9, 10, 11]
implemented-by:
  - src/decompose/propose/status.ts
  - src/decompose/propose/edit-file.ts
  - packages/plugin-coder/src/api-runner.ts
  - packages/plugin-coder/src/adaptors/decomposition-edit.ts
  - packages/plugin-coder/src/suggest.ts
  - packages/plugin-coder/src/commands/coder/suggest.ts
  - packages/plugin-workspace/src/api/server.ts
verified-by:
  - src/decompose/propose/__tests__/status.test.ts
  - src/decompose/propose/__tests__/edit-file.test.ts
  - packages/plugin-coder/src/__tests__/api-runner.test.ts
  - packages/plugin-coder/src/adaptors/__tests__/decomposition-edit.test.ts
  - packages/plugin-coder/src/__tests__/suggest.test.ts
  - packages/plugin-workspace/src/api/__tests__/server.test.ts
tracked-by: ["#410", "#425"]
summary: >-
  `@seans-mfe/plugin-coder` gains a third transport beside `subprocess` and `serve`: `api`,
  which sends the request to a hosted model over HTTPS using a key from the environment. A
  hosted model has no LoRA to load, so an adaptor on that transport is a prompt adaptor — a
  system prompt, context assembly and an output schema — kept in this repository as data and
  versioned with the contract it targets. The first is `decomposition-edit`: a plain-language
  request plus the current `decomposition.yaml` in, a list of the named edit operations
  `decompose:edit` already applies out. As for every coder output, the oracle decides: the
  edits are dry-applied to a copy of the document and the derived fleet is validated, and only
  edits that pass are offered. The workspace's agent pane (ADR-116 §4) is the first caller.
rationale-summary: >-
  ADR-085 put coder on a local open weight because intent→manifest needed tuning. The
  decomposition agent needs judgment over a large, changing document more than a tuned
  vocabulary, and a product owner's machine has no MLX. Adding a transport keeps one seam,
  one contract and one oracle, so the agent pane, `coder:compile` and any later caller differ
  only in adaptor and transport, never in how the result is trusted.
long-form: true
---

## Context

ADR-085 decided that intent compilation is done by coder, out of process, behind a typed
contract, and that coder runs a local open weight tuned with LoRA adaptors. ADR-088 made the
seam a first-party package, `@seans-mfe/plugin-coder`, with two transports: `subprocess`
(`coder generate`) and `serve` (coder's local SSE endpoint).

The decomposition workspace (ADR-116) needs an agent the product owner can talk to. The agent
reads `decomposition.yaml` and the evidence, and answers with edits to the document. Two facts
make the existing seam a poor fit as it stands:

- **The task is judgment, not vocabulary.** "Split cargo from docking" asks for reasoning over
  dozens of files and their evidence. A general model does this well without tuning, and a 7B
  local model with a manifest adaptor was not trained for it.
- **The product owner's machine is not a model host.** coder's local engine needs Apple
  silicon and MLX. The workspace is for someone who does not run a terminal beyond launching
  it (ADR-116 §1).

The user directed that the agent be reached through the coder plugin surface, extending it to
use an API rather than adding a second agent channel.

## Decision

### 1. A third transport: `api`

`CoderTransport` gains `{ kind: 'api', provider, model? }`. The runner posts the assembled
request to the provider's HTTPS API and returns the completion, behind the same `CoderRunner`
interface the other transports implement, so callers and tests are unchanged. The key comes
from the environment (for Anthropic, `ANTHROPIC_API_KEY`), never from a flag, a file in the
repository, or the document. A missing key is a typed error that says which variable to set.

The first provider is Anthropic's Messages API. Another provider is another runner behind the
same transport kind, not a new seam.

### 2. Prompt adaptors live here, as data

A LoRA adaptor is weights and belongs to coder (ADR-085 §3). A hosted model takes no weights,
so an adaptor on the `api` transport is a **prompt adaptor**:

- a **system prompt** that explains the task and the contract;
- a **context assembler** that builds the request from the caller's inputs (here, the
  document, the evidence summary and the request);
- an **output schema** the model must answer in — tool use / structured output, never free
  text that is parsed by pattern.

Prompt adaptors live in `@seans-mfe/plugin-coder`, versioned with the contract they target, and
are tested against recorded model answers. They are data plus small pure functions; no model,
weights or training code enters the repository, which keeps ADR-085's boundary.

### 3. `decomposition-edit`: a request in, named edits out

The first prompt adaptor turns a plain-language request about a decomposition into the named
edit operations `decompose:edit` already applies: rename domain, merge, split, move file,
rename capability, rename slot, comment. The output schema is exactly those operations, so the
model has no other way to express a change. It may also return a short explanation for each
edit, which the workspace shows beside it.

### 4. The oracle decides, whatever the transport

coder's output is never trusted for being produced (PDR-010). For `decomposition-edit` the
oracle is deterministic and already exists:

1. each proposed edit is dry-applied, in order, to a copy of `decomposition.yaml`;
2. the derived manifests and composition are validated (ADR-110 §2);
3. edits that fail are dropped, with the reason, and never shown as acceptable.

What survives is written to the document as pending suggestions (ADR-116 §4).

As implemented (#425, part 1), the check runs on every pending suggestion each time the workspace
reads the proposal (`proposalStatus`), so a suggestion that was valid when made, and is not after
a later edit, shows as failing rather than stale-but-green. Nothing the model
says changes the document until a person accepts it.

## As implemented (#425, part 4)

- **Transport.** `CoderTransport` has `{ kind: 'api', provider: 'anthropic', model? }`, served by
  `makeApiRunner` (`packages/plugin-coder/src/api-runner.ts`) through the official SDK. The key is
  read from `ANTHROPIC_API_KEY` only; without it, a `ValidationError` names the variable.
  `coder:compile --api` uses this transport for intent → manifest; its DSL oracle is unchanged.
- **Prompt adaptors.** `PromptAdaptor` is `{ id, version, system, assemble, output }`.
  `runPromptAdaptor` sends the system prompt and the assembled context first, both marked for
  prompt caching, and the request last. It asks for structured output in the adaptor's zod schema
  and opts into the provider's server-side fallback for declined requests. It then checks
  `stop_reason` before reading anything: a refusal or a truncated answer is a `BusinessError`.
  Provider errors map to `SecurityError` (key refused) or `NetworkError` (unreachable,
  rate-limited, failed).
- **The schema is enforced by parsing, not decoding.** The SDK's structured-output transform
  carries a literal `kind` as a description rather than a constraint. So the answer is parsed
  again against the adaptor's schema, and the CLI parses each edit a third time when it
  dry-applies it.
- **The oracle.** `decompose:edit --dry-run` applies and validates without writing.
  `coder:suggest <proposal> "<request>"` (`suggestEdits`) dry-runs each edit on top of the ones
  that passed before it, and drops a failure with its reason. It then writes, in one
  `decompose:edit`, the question (signed by the asker) and the answer (signed `agent`) as
  comments, and each survivor as a pending suggestion.
- **The workspace.** `GET /api/agent` and `POST /api/ask` (Mesh: `getAgent`, `askAgent`) run
  `coder:suggest`, one question at a time. `decompose:workspace` connects the agent when
  `ANTHROPIC_API_KEY` is set; `--no-agent` turns it off. The agent pane shows the answer and any
  edits the check dropped.

## Boundaries

- This ADR does not change ADR-085's choice for intent→manifest. `coder:compile` keeps its
  local default; the `api` transport is available to it, but whether to use it is the
  caller's choice.
- The model sees what the caller assembles, and only that. For `decomposition-edit`, that is
  the proposal and evidence summaries already in the repository. Captured response bodies are
  not sent; redaction of recorded data is #424's.
- Cost and rate limits are the caller's to bound. The workspace makes one request per question
  the product owner asks, never in a loop.
- Hosted-mode agents (ADR-116 §6) are out of scope here.

## Consequences

The agent pane gets a capable model with no install beyond an API key, through the seam the
platform already governs. Every future agent task is an adaptor, not a new channel. The cost is
an outbound dependency on a provider and a key to manage. The prompt adaptors also need their
own tests, because a prompt change can change behavior with no code diff. The oracle bounds the
damage: a worse prompt yields fewer accepted edits, never an invalid document.

## References

- ADR-085, ADR-088: the coder seam and its first-party package.
- ADR-019: out-of-process isolation.
- ADR-110: `decomposition.yaml`, the named edits and validation of the derived fleet.
- ADR-116: the workspace and its agent pane.
- PDR-009, PDR-010, PDR-011.
