# Flows — where you are, and what to run next

Most SMT work takes several commands, in an order. Decomposing a monolith, for example, means
capture, analyze, propose, shape, present, approve, and later scaffold and verify. Each command
reports its own failures. A **flow** is what knows the order (PDR-012).

```bash
seans-mfe-tool flow:status ./evidence
```

```
  Decompose a monolith into MFEs  /work/evidence

  ✓ Run the app and record what it does
  ✓ Read the app's source, joined to the capture
  ✓ Propose the domains
  ○ Shape the proposal — merge, split, rename, ask the agent — 1 suggestion waiting
  ↻ Write the review package — proposal/decomposition.yaml changed after proposal/PROPOSAL.md was written
  ✓ Approve the proposal — approved by Sean
  ✗ Generate the MFEs, their BFFs and the legacy wrapper — not built yet (#410)
  · Prove the composed app behaves like the monolith — waits on scaffold

  next: seans-mfe-tool decompose:present /work/evidence/proposal
```

| Mark | State | Meaning |
|---|---|---|
| ✓ | done | every file the step produces exists, and its check (if any) passes |
| ↻ | stale | done, but something it follows changed after it, or its check says so (an approval after the proposal changed) |
| → | next | the command to run now |
| ⏸ | waiting | a person's decision, such as approving the proposal |
| · | blocked / ready | waits on an earlier step, or could run but is not first |
| ○ | optional | never blocks a later step |
| ✗ | unavailable | planned, not built yet; the issue is named |

`next` fills in the command's arguments from what earlier steps recorded, such as the app's URL
from `bundle.json` and its directory from `source/project.json`. Until a value has been recorded,
the command shows a placeholder like `<app-url>` and tells you to fill it in.

With `--json`, the same report is one envelope, so an agent over MCP can call `flow:status`
and then the command it names.

The full walkthrough of the decomposition flow is [decompose-runbook.md](./decompose-runbook.md).

## How it works (ADR-119)

- **A flow is data.** Each flow is a YAML file in `flows/`, such as `flows/decompose.yaml`. It
  lists the steps, the command each one runs, the steps it follows, the files it produces, and
  any named check. Checks are the facts a file's existence can't tell, such as whether the
  proposal is approved.
- **State is derived, never recorded.** Every call reads the files. Run a command by hand, edit
  the proposal, or delete a report, and the next `flow:status` reflects it.
- **Freshness is by content.** `analyze`, `propose` and `present` write
  `<output>.from.json` beside their output, holding the digest of each input they read. A
  `git checkout`, which rewrites every timestamp, cannot make a step look stale or fresh.
  Outputs written before this existed fall back to timestamps, and the report says so.
- **It borrows from others.** It takes Make's targets and DVC's content hashes. It adds human
  gates and agent-readable output, which neither has. ADR-119 compares the prior art.
- **It runs nothing.** Executing the remaining steps (`flow:run`) and a `next` hint in every
  command's output are later steps on the same definitions.
- **The engine is `@seans-mfe/flow`.** It is pure, and its checks are handed in. A test keeps
  each shipped flow honest: every command it names exists, and every check it names is
  registered.

## Adding a flow

1. Write `flows/<id>.yaml`. The schema is `FlowSchema` in `packages/flow/src/flow.ts`, and
   `flows/decompose.yaml` is the worked example.
2. Register any check it names in `src/flow/index.ts`.
3. Add a test that walks a real directory layout through it, as
   `src/flow/__tests__/decompose-flow.test.ts` does.
