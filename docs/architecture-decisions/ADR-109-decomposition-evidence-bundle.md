---
id: 0109
title: >-
  A decomposition starts from an evidence bundle — what the running app did, keyed by region
  and interaction and joined to source — and every later stage reads only that bundle
status: Accepted
impl:
  stage: phased
  refs: ["#437"]
date: 2026-10-03
deciders: [sean]
area: Decomposition / capture
enforcement: tooling
tags: [decomposition, capture, evidence, playwright, network, react]
relates-to: [52, 84, 110, 112, 113]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by:
  - src/commands/decompose/capture.ts
  - src/decompose/capture.ts
  - src/decompose/bundle.ts
  - src/decompose/regions.ts
  - src/decompose/attribution.ts
  - src/decompose/page-probe.ts
  - src/commands/decompose/analyze.ts
  - src/decompose/source/analyze.ts
  - src/decompose/source/parse.ts
  - src/decompose/source/graph.ts
  - src/decompose/source/join.ts
  - src/decompose/source/tests.ts
  - src/decompose/source/history.ts
verified-by:
  - src/decompose/__tests__/bundle.test.ts
  - src/decompose/__tests__/regions.test.ts
  - src/decompose/__tests__/attribution.test.ts
  - src/decompose/__tests__/page-probe.test.ts
  - src/decompose/source/__tests__/graph.test.ts
  - src/decompose/source/__tests__/join.test.ts
  - src/decompose/source/__tests__/meridian-monolith.test.ts
tracked-by: ["#410", "#413", "#414", "#424", "#437"]
summary: >-
  `decompose:capture` runs the monolith in headless Chromium, drives journeys, and writes an
  evidence bundle: DOM regions, network requests attributed to the region and interaction that
  caused them, navigation, console and page errors, recorded responses, and screenshots — with
  every region mapped to its React component and source file. `decompose:analyze` adds the
  source graph. Proposal, test generation and parity all read the bundle, never the live app,
  so a decomposition is reproducible from a directory on disk.
rationale-summary: >-
  Boundaries are only as good as the evidence behind them, and the strongest evidence —
  which backends a region calls — exists only at runtime. Capturing once into a stable,
  reviewable format lets every later stage, the scorer, and a human reviewer work from the
  same facts, and makes the capture the baseline the parity gate compares against.
long-form: true
---

## Context

PDR-011 makes decomposition evidence-driven. The `design:export` POC (#406) proved a
Playwright capture of DOM and computed styles works, but records only what is on screen,
not *why* — which backend fed it, which interaction produced it, which component drew it.
Data ownership is the clearest domain boundary, and it is visible only in traffic.

## Decision

### 1. One bundle, written once, read by everything downstream

A capture run writes a directory: a manifest of the run (app URL, build, journeys, seed),
then per-journey records. Proposal (ADR-110), OpenAPI inference (ADR-112), test generation
and the parity gate (ADR-113) read the bundle; none of them re-run the app to learn
behavior.

As implemented (`smt-evidence/1`, #413):

| File | Holds |
|---|---|
| `bundle.json` | app URL, viewport, frozen clock, journey names, stats |
| `journeys.yaml` | the journeys that ran, explored steps included — replayable |
| `journeys/<name>.json` | per step: action, path, navigations, regions, request ids, console, page errors, screenshot |
| `requests.json` | every XHR/fetch: step, method, app-relative URL, status, initiator files, attributed regions |
| `responses.json` | the first response per `METHOD url`, for replay |
| `screens/<step>.png` | a screenshot after each step |

JSON is written with sorted keys and no wall-clock data, and the page clock is frozen, so two
captures of the same journeys over the same recorded responses write identical files.

### 2. Every observation is keyed by region and interaction

Network requests, console errors and navigations carry the id of the interaction step that
caused them and the DOM region it targeted. A region is a captured element subtree;
regions are what domains are assembled from.

As implemented: a region is one rendered instance of an app component — the elements whose
owning component (through §3) is that instance — with an id of `<file>#<Component>`, numbered
`@n` when a step shows several. A request is attributed to regions by two signals, kept apart
so a later stage can weigh them:

- **initiator** — an app source file on the request's JavaScript call stack, async parents
  included (read over CDP), is the file of a region on screen: the component asked for it;
- **data** — an identifying value from the response appears in a region's own text: the
  component shows it. Values count only from fields whose values are mostly distinct across
  rows, so a status or category ties nothing together. This is the signal that sees through a
  global store, where the store initiates every request.

### 3. Regions are joined to source

In a development build, each region resolves to its React component and source file through
the fiber attached to its DOM node. `decompose:analyze` keys the source graph (routes,
imports, API call sites, co-change, ownership) by the same component/file ids, so runtime
and source evidence vote on the same units.

As implemented (#414), `decompose:analyze` writes `source/` into the bundle:

| File | Holds |
|---|---|
| `graph.json` | per file: components, resolved imports, the endpoints it reaches (URLs followed through wrapper functions to concrete paths), store reads resolved to the endpoints that load them, and its assignment; the route table with the landmark each route renders into |
| `tests.json` | per test file: what it imports and mocks, snapshots, skips, structural selectors, fixed waits, and per-test results from running the suite, including tests the project's config excludes |
| `history.json` | co-change pairs from `git log` and CODEOWNERS owners |
| `join.json` | each observed endpoint matched to the source that calls it, endpoints in source no journey exercised, and what the capture saw of each file |

A file's assignment is the set of route roots that reach it through the import graph: one
route is a **screen** file, several are **shared**, reached only from the entry is the
**shell**, and reached from nowhere is **unreached**. The store reads are what the runtime
data signal cannot see: a component that reads store data only to filter (§Boundaries) is
still a consumer of the endpoint that loads it.

### 4. Responses are recorded for replay

Captured responses are stored in the shape the BFF mock switch serves (ADR-052), so the
same journeys can be replayed deterministically against the monolith and the composed app.

As implemented: the capture records responses per request (`METHOD url`), and `--replay`
answers the app's API calls from them. The mock switch's fixtures are keyed by GraphQL field
name, and those names do not exist until a BFF is scaffolded, so the conversion into
`mocks.json` belongs to scaffolding (#417), which knows both sides.

### 5. Journeys come from three sources, in this order

The monolith's own e2e specs re-run under instrumentation; agent-authored journeys from
the route table and forms; bounded automatic exploration of interactive elements.

As implemented: journey files (`goto`, `click`, `fill`, `press`, `wait`) and exploration that
follows in-app links only — it presses no buttons and submits no forms, so it cannot change
the app's data. Re-running e2e specs is #437.

## Boundaries

- Source mapping depends on React development-mode metadata; production builds yield
  regions without source ids, and the bundle records that rather than guessing.
- The bundle records observed behavior only. Behavior no journey exercised is absent, and
  the proposal must treat absence as unknown, not as unused.
- Data a component uses without showing it — to filter, to count — leaves no trace in its
  text, and a store-initiated request has no component on its stack. Those couplings are for
  the source graph (`decompose:analyze`) to find.
- Sensitive data in recorded responses is the operator's responsibility; redaction rules
  are a follow-up, not part of this decision.

## Consequences

Captures become reviewable, diffable artifacts and the parity baseline. The cost is a new
on-disk format to version, and a dependency on running the app with seeded data.

## References

- PDR-011 — the product decision this serves.
- ADR-052 — BFF demo-mode mock switch; recorded responses use its format.
- ADR-084 — the manifest is the model's output; the bundle is the model's input.
- #406 — the `design:export` capture this extends; #409 its fidelity fixes.
- #413, #414 — `decompose:capture` and `decompose:analyze`.
