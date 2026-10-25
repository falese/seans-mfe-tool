# The decomposition workspace — shaping, the agent, approval

Where a person shapes a proposal and approves it (ADR-116), and the commands behind it:
`decompose:workspace`, `decompose:edit` and `decompose:ask`. [`decompose:propose`](./decompose-propose.md)
writes the proposal this page edits; the [step-by-step guide](./decompose-runbook.md) says when
to come here. `edit` and `ask` are hidden from `--help` because they serve agents and scripts;
they are still MCP tools.

## The workspace edits

The decomposition workspace changes the document only through these same edits. Six more
exist for it, and `--ops` takes any edit as JSON:

| Edit | What it does |
|---|---|
| `--split cargo=hazmat:src/pages/cargo/HazardSummary.tsx` | Moves the named files, with their capabilities, placements and couplings, into a new domain |
| `comment` | Adds `{ by, at, text, about? }` to the document's `comments` |
| `suggest` | Holds an edit an agent proposed in `suggestions`, unapplied |
| `accept-suggestion` / `reject-suggestion` | Applies the held edit and drops it from `suggestions`, or just drops it |
| `approve` | Records `{ by, at, hash }`. The hash covers what the proposal decides, not its comments or suggestions |

```bash
seans-mfe-tool decompose:edit decomposition.yaml --ops '[{"kind":"approve","by":"sean","at":"2026-10-25T12:00:00Z"}]'
```

A proposal records what each file calls (`fileEndpoints`), so a split or a move recomputes each
domain's backends and endpoints. A proposal written before this field existed keeps its data
as it was.

`flow:status <bundle> --proposal` returns, under `proposal`, everything the workspace shows:
- the document;
- whether the derived fleet validates;
- the approval, and whether it is still `current` or has gone `stale`;
- each pending suggestion, checked by applying it alone and validating the result;
- the captured screens with the domains outlined.

`@seans-mfe/workspace` serves this as the workspace API
(`packages/workspace/decomposition-workspace/specs/workspace-api.yaml`). Reads and writes go
through `@seans-mfe/decompose`, the same code `flow:status --proposal` and `decompose:edit` wrap
(ADR-118).

## Opening the workspace

```bash
npm run build:workspace                                  # once, in the repository: builds the workspace MFE
seans-mfe-tool decompose:workspace ./evidence/proposal   # then open http://127.0.0.1:4611
```

The page is the generated `decomposition-workspace` MFE in standalone mode. It has four
screen areas: the map, shaping, the agent, and approval. Everything runs on this machine
only, on ports 4610 (the API), 5611 (the MFE's BFF) and 4611 (the page). The command
refuses to start if any of them is taken. An approval is committed to the repository,
covering only the proposal directory; `--no-commit` turns that off. Comments and
approvals are recorded under git's `user.name`, or under `--who`.

## Asking the agent (ADR-117, ADR-120)

With `ANTHROPIC_API_KEY` set, the workspace's agent pane takes plain-language requests, such as
*"Split hazards out of cargo — they're a separate team"* or *"Why is constants.ts shared?"*.
The same thing works from the command line:

```bash
export ANTHROPIC_API_KEY=…
seans-mfe-tool decompose:ask ./evidence/proposal "Split hazards out of cargo — they're a separate team"
```

The model sees the whole proposal, including its conversation, and answers in the named edits
above, never in free text. Each edit is checked before anyone sees it:
`decompose:edit --dry-run` applies it on top of the edits that passed before it and validates
the derived fleet. An edit that fails is dropped, and the reason is shown. The rest become
pending suggestions. The question and the answer are added to the proposal's comments, so the
next question has the conversation as context. Nothing changes until a person accepts a
suggestion.

The key is read from the environment only. `--model` picks another model, and
`decompose:workspace --no-agent` turns the pane off. Each question is one request to the
provider, and the pane never asks on its own.
