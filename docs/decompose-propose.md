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

### The workspace edits (ADR-116)

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

`decompose:status <proposal-dir>` returns everything the workspace shows:
- the document;
- whether the derived fleet validates;
- the approval, and whether it is still `current` or has gone `stale`;
- each pending suggestion, checked by applying it alone and validating the result;
- the captured screens with the domains outlined.

`@seans-mfe/plugin-workspace` serves this as the workspace API
(`packages/plugin-workspace/decomposition-workspace/specs/workspace-api.yaml`). Reads go to `decompose:status`, and
writes go to `decompose:edit`, each run as a child process.

### Opening the workspace

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

### Asking the agent (ADR-117)

With `ANTHROPIC_API_KEY` set, the workspace's agent pane takes plain-language requests, such as
*"Split hazards out of cargo — they're a separate team"* or *"Why is constants.ts shared?"*.
The same thing works from the command line:

```bash
export ANTHROPIC_API_KEY=…
seans-mfe-tool coder:suggest ./evidence/proposal "Split hazards out of cargo — they're a separate team"
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

## Backends and route families

**Backends.** An app's API URLs name backends one of two ways, and a URL alone can't tell which:

- a gateway, `/api/<backend>/<resource>`: meridian-monolith, with three backends;
- one API, `/api/<resource>`: RealWorld, where `/api/tags` is already a resource.

The draft judges this once, over every concrete URL observed or in source: a resource at the top
level means one API. It records the answer as `app.gateway`, which can be corrected by hand.
Clustering, spec inference and each MFE's spec cut all read that field.

**Route families.** Routes under one first segment are one domain: `/editor` and `/editor/:slug`,
or a profile and its favorites tab (`/@:username`, `/@:username/favorites`). A family is named
for that segment. When the segment has no literal part, as in `/@:username`, it is named for the
page of its shortest route (`Profile` → `profile`). State keys keep parameter names, so every
route gets its own key (`conduit.open.editor.slug`).

## BFF specs (ADR-112)

Each domain's BFF fronts the backends its screens call, and the BFF is generated from an
OpenAPI document per backend. A monolith's backends rarely publish one, so `decompose:propose`
infers it from the evidence bundle's recorded traffic and the client code's endpoint templates:

```
specs/<backend>.yaml                 one per backend: inferred, or the published spec
specs/<backend>.mocks.json           recorded responses, by operationId
specs/<backend>.differences.json     inferred vs published, when a published spec is given
<mfe>/specs/<backend>.yaml           cut to the operations this MFE's domain calls
<mfe>/src/platform/bff/mocks.json    the BFF's demo fixtures (ADR-052)
```

An inferred document is a lower bound: only what the app was seen, or written, to call. Every
operation names the requests behind it (`x-smt-observed`) and whether code, traffic or both
gave it (`x-smt-source`). Each manifest's source carries `hoistField` rules that unwrap the
lists its backend wraps (`{ result }`, `{ Data }`).

A published spec wins (`--spec stationos=./station-os.yaml`, or any document in `specs/`
without `x-smt-inferred`). The inferred one then reports what it saw that the spec lacks.
`--evidence` names the bundle when it is not the analysis directory's parent.

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

**Specs.** The capture's 13 calls become 13 operations across three backends. Each validates
as OpenAPI 3 and loads through the Mesh `openapi` handler the BFFs pin. Against
meridian-station's hand-written specs (`--spec`):

- all 13 inferred operations match a published one, with no type mismatches;
- the derived `hoistField` names (`payroll`, `crew`, `certifications`, …) are the ones written
  by hand;
- the inferred specs carry `id`, `createdAt` and `updatedAt`, which every backend returns and no
  published spec declares. That is spec drift the inference makes visible.

Two gaps show up as well:

- The ledger's lists were empty in this capture, though the seed holds rows, so their item fields
  are unknown (`items: {}`). Re-capturing against a seeded ledger fills them.
- The harbormaster and StationOS published specs do not validate: an unquoted comma in a YAML
  flow mapping adds stray keys (#444).

Read the test-triage score with care. The triage rules are ordinary test smells (excluded,
skipped, snapshot-only, mocks, structural selectors, fixed sleeps), but they were written with
this answer key in view. A second subject is what will say whether they generalize.

## Limits

- **Inferred specs are a lower bound.** Operations the journeys never reached appear only if the
  client code names them, and without a response shape. Request bodies are not recorded, so a
  write operation's body is untyped. Each `servers` URL is the origin the capture ran against.
- **Repeated placements stay in the proposal.** Their keys (`{id}`) are bound with `forEach`
  when composed, and the source does not know them.
- **Typed props for capabilities** wait on #422.
- **One subject so far.** The thresholds (half of a component's data, one route's primary
  area) are judged on meridian-monolith only.
