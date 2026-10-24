# `decompose:propose` and `decompose:score` — a decomposition, and how good it is

The third stage of an agent-driven decomposition (PDR-011). [`decompose:capture`](./decompose-capture.md)
records what the monolith does, and [`decompose:analyze`](./decompose-analyze.md) reads its source.
`decompose:propose` turns both into a **proposal**: `decomposition.yaml`, the one document people
and the agent agree on (ADR-110). `decompose:score` grades a proposal against an answer key.

```bash
seans-mfe-tool decompose:propose ./evidence/source --name meridian         # the deterministic draft
#   … the agent (or a person) edits ./evidence/proposal/decomposition.yaml …
seans-mfe-tool decompose:propose --from ./evidence/proposal/decomposition.yaml   # re-derive
seans-mfe-tool decompose:score ./evidence/proposal/decomposition.yaml \
  --answer-key examples/meridian-monolith/answer-key.yaml --corpus ./corpus
```

## Two halves: a deterministic draft, then judgment

`propose` is deterministic: the same analysis always gives the same draft, so it can be
tested and scored in CI (ADR-110 §1a). It builds the draft in four steps:

1. **Seeds.** Each route that fills the primary area (`main`) seeds a domain, and the files
   only that route reaches join it.
2. **Shell.** Files only the app's entry reaches form the shell.
3. **Data affinity.** A leftover component — rendered by the shell, or by a route with no
   primary area — joins the domain that supplies at least half of the data it reads. That is
   how a berth tile in the always-on header lands in docking.
   **Chrome** (navigation, headers, the route table) stays in the shell, and any reads it makes
   of another domain's data are flagged as couplings.
4. **Shared** files (the API client, the global store, helpers) get a suggestion, not an
   owner: replace with a BFF per domain, dissolve, duplicate, or split.

Judgment belongs to the operating agent: names, merges, splits, and files the draft could not
place. The agent edits `decomposition.yaml`, and `propose --from` re-derives everything from
it. `proposal.base.yaml` keeps the draft, so the edits can be listed.

## Editing, and the proposal PR

Judgment is applied as named edits, not text edits, so nothing is left pointing at an old name:

```bash
seans-mfe-tool decompose:edit decomposition.yaml \
  --rename-domain shell=console --move src/utils/constants.ts=console \
  --rename-capability LifeSupportPage=TelemetryDashboard --rename-slot aside=status
seans-mfe-tool decompose:edit decomposition.yaml --merge docking,cargo=harbor
```

Each run re-derives and validates the fleet. A merge carries both domains' files,
capabilities, backends and placements, and drops couplings that are now internal.

`decompose:present <proposal-dir> --evidence <bundle>` writes what a reviewer reads before
agreeing (ADR-110 §3):

- **`PROPOSAL.md`:** domains and their evidence, why each boundary is where it is, shared
  files, risks (couplings, unassigned files, untested capabilities), the test triage, the
  composition, and how to change it.
- **`overlay/index.html`:** each captured screen with every proposed domain outlined where it
  begins, labelled *domain · MFE · slot · backends*. Couplings are drawn dashed red, where
  they show.
- **`overlay/figma-plugin/`:** the same page as Figma layers (Plugins → Development → Import
  plugin from manifest). The screenshots are embedded, so it needs no network access.

Merging the PR that carries these is the agreement; nothing is scaffolded before it merges.

## What the proposal holds

| Section | |
|---|---|
| `domains` | files, capabilities, backends, endpoints, a 0–1 score per signal (route, data, imports, runtime, co-change, ownership), and the reasons |
| `shared` | files several domains use, with a suggestion |
| `couplings` | a domain reading another's data through the shared store (`store-read`), or the shell showing a domain's data (`shell-read`) |
| `slots`, `routes`, `repeated` | where each capability is placed, per route; one-per-item placements (a tile per berth) |
| `tests` | each existing test: **keep**, **rewrite** or **discard**, with reasons |
| `uncovered` | capabilities no kept test exercises |

Derived beside it: an `mfe-manifest.yaml` per domain and `control-plane/control-plane.yaml`.
The layout is a fleet's, so `compose:validate <proposal dir>` checks it like any project.

## Scoring

`decompose:score` never compares names: `shell` and `console`, or `aside` and `status`, score
the same. Proposed domains are matched to the answer key's by the files they share, and slots
by the placements they share. It reports:

- **file assignment:** precision, recall and F1 over every file in the key (`shared` counts as a label);
- **backends:** per domain, against the key's backends (matched through the proxy paths);
- **slot structure:** answer-key placements reproduced;
- **test triage:** verdicts agreeing with the key's;
- **gap detection:** untested behaviors whose component (or, failing that, domain) the
  proposal flags as uncovered.

When `proposal.base.yaml` is beside the proposal, the draft is scored too, and the agent's
edits are listed, so it is clear which half earned the result. `--corpus` writes the run as
one training record (PDR-009): evidence, draft, edits, proposal, answer key, and both scores.

## On meridian-monolith

| | assignment F1 | backends | slots | test triage | gap recall |
|---|---|---|---|---|---|
| deterministic draft | **0.963** (26/27) | 1.000 | 1.000 | 1.000 | 0.786 |
| + agent judgment (9 edits) | **1.000** (27/27) | 1.000 | 1.000 | 1.000 | 0.786 |

- **The draft's one miss** is `examples/meridian-monolith/src/utils/constants.ts`, filed as shared. It holds the
  console's domain menu and berth list.
- **The agent's edits** (applied with `decompose:edit`):
  - renamed domains: `shell` → `console`, and `simulator` → `docking-simulation` (the id
    `constants.ts` uses);
  - renamed capabilities, from the code's own comments ("Telemetry dashboard",
    "Concourse directory");
  - renamed slots: `aside` → `status` (the "status rail" in `App.tsx`);
  - moved `constants.ts` to the console.
- **All three couplings in the answer key are flagged:** cargo and the concourse read docking's
  dockings from the store, and the shell shows life-support telemetry.

Read the test-triage score with care. The triage rules are ordinary test smells (excluded,
skipped, snapshot-only, mocks, structural selectors, fixed sleeps), but they were written with
this answer key in view. A second subject is what will say whether they generalize.

## Limits

- **BFF specs are not inferred yet.** Each derived BFF names `./specs/<backend>.yaml`;
  inferring it from traffic and client code is #440.
- **Repeated placements stay in the proposal.** Their keys (`{id}`) are bound with `forEach`
  when composed, and the source does not know them.
- **Typed props for capabilities** wait on #422.
- **One subject so far.** The thresholds (half of a component's data, one route's primary
  area) are judged on meridian-monolith only.
