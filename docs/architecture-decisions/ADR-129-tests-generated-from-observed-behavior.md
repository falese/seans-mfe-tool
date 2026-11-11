---
id: 0129
title: >-
  test:generate writes an MFE's tests from an evidence bundle — each capability alone in jsdom on
  the recorded network, every journey in Playwright with a masked visual baseline per capability
  per step, and its BFF held to its specs and recorded traffic at the fixtures and through the
  connector — as developer-owned files a re-run never overwrites once changed
status: Implemented
date: 2026-11-11
deciders: [sean]
area: Testing / generation
enforcement: tooling
tags: [testing, characterization, visual-regression, contract, playwright, jest, decomposition, bff]
relates-to: [52, 87, 109, 111, 112, 113, 119, 126, 127, 128]
supersedes: []
superseded-by: []
implements-pdr: [14, 11, 13]
implemented-by:
  - src/testgen/select.ts
  - src/testgen/plan.ts
  - src/testgen/harness.ts
  - src/testgen/emit.ts
  - src/testgen/contract.ts
  - src/testgen/png.ts
  - src/testgen/generate.ts
  - src/commands/test/generate.ts
verified-by:
  - src/testgen/__tests__/select.test.ts
  - src/testgen/__tests__/plan.test.ts
  - src/testgen/__tests__/harness.test.ts
  - src/testgen/__tests__/emit.test.ts
  - src/testgen/__tests__/contract.test.ts
  - src/testgen/__tests__/png.test.ts
  - src/testgen/__tests__/generate.test.ts
tracked-by: ["#410", "#418"]
summary: >-
  Implements ADR-113 §2 and §5 for each MFE's own CI, as a core command rather than a decomposition
  step (PDR-014). From an evidence bundle (ADR-109) and an MFE, `test:generate` writes four suites.
  Alone: each capability rendered by itself in jsdom at every path it was first captured at, with
  fetch and XMLHttpRequest answered from the recorded responses, asserting the text its regions
  showed, the calls behind them and no new console error. Journeys: a Playwright spec replaying
  every captured journey against any URL, with the same checks per step plus a visual baseline per
  capability cut from the capture's screenshot, other placements masked. Contract: each BFF
  operation's recorded response held to its spec and to the demo fixtures, then the built Mesh run
  in-process with its upstream answered from the recording, expected to return it. Migrated: tests
  the proposal triaged keep, moved beside their ported code. Every file is the MFE's; a re-run
  replaces one only while it is still as generated.
rationale-summary: >-
  The capture already holds an outside-in specification of every state the app was driven through.
  Generating from it gives each MFE the tests PDR-013 makes it depend on, at the cost of one
  command, and the same four suites serve any MFE with a capture, not only a decomposed one.
  Rendering a capability alone proves it works without the shell; the journey spec proves the same
  in a browser against the monolith and the composed app alike; the connector test is the only
  place a BFF's renaming and unwrapping is checked against what the backend actually sent.
long-form: true
---

## Context

ADR-113 defines the parity gate's four parts and `decompose:verify` runs the browser half against
the composed app. Its own text left three things to #418: characterization specs for each MFE's
own CI, contract tests from the inferred specs (ADR-112), and migrating the tests triaged keep.
PDR-013 then made those per-MFE tests the only proof that a capability works in a shell other than
the monolith's. PDR-014 makes generating them a platform function, not a decomposition step.

Two facts from the reference fleet shaped the design:

- The BFF's demo mode answers from `mocks.json` above the connector (ADR-052, the mock switch
  wraps `Query.*`). A test through demo mode never exercises the OpenAPI handler, the naming
  transform or the hoist. The connector has to be driven with its upstream stubbed.
- A ported capability, run alone, runs the monolith's own data code (ADR-128). In jsdom it calls
  the monolith's REST paths through axios, which uses `XMLHttpRequest`. A fetch-only stub would
  answer nothing.

## Decision

### 1. One command, any MFE

`test:generate <mfe> --evidence <bundle>` generates for one MFE; `test:generate <proposal>
--proposal` generates for every MFE of a scaffolded fleet. Its inputs are the bundle, the MFE's
`mfe-manifest.yaml` and `specs/*.yaml`, and, for a decomposition, `decomposition.yaml` (components,
placements, triage) and the monolith's source (keepers).

### 2. A capability's view of a capture

A capability's regions are its root regions — instances of its component, or regions stamped
`data-smt-capability=<name>` (#408) — and everything nested in them, down to the root of another
placed capability. A placed capability is one the composition places anywhere: the shell's root
and every route placement. A capability drawn by another once per item (`repeated`) has no alone
test, since its props come from its renderer. Its journey checks still run.

### 3. Alone: jsdom, per capability

`src/features/<Cap>/<Cap>.characterization.test.tsx` renders the capability at each path it was
first seen at, with the capture's clock frozen (Date only; every other timer is real) and the
network answered by `src/__smt__/recorded-network.ts` from `recorded.json`. It asserts:

- **text:** each region's own text, in order, with whitespace ignored, since a page runs adjacent
  elements together;
- **calls:** the `METHOD url`s attributed to the capability's regions by that step were made, and
  nothing unrecorded was requested;
- **console:** no `console.error` the captured step did not already have. React's act() warning
  and jsdom's "Not implemented" are dropped as noise.

It runs in the MFE's plain `npm test`.

### 4. Journeys: Playwright, text, calls, console and pixels

`e2e/characterization.spec.ts` replays every journey in which one of the MFE's capabilities
appears, against `SMT_TARGET_URL` (default: the captured app), on the captured clock, fulfilling
recorded REST responses and letting everything else through, so a composed app's BFFs answer in
demo mode. After each step, for each capability on screen:

- text, scoped to `[data-smt-capability]` when the page stamps it, else the page;
- calls, where a GraphQL request counts as the backend calls its root fields stand for, from the
  MFE's specs (ADR-127 §4), compared by endpoint;
- pixels: the capability's rectangle, with other placements inside it painted `#ff00ff` on the live
  page and in the baseline alike, against a baseline cut from the capture's screenshot. As with
  `toHaveScreenshot`, no pixel may differ by default (`SMT_MAX_DIFF_PIXELS` raises the budget);
- console: no new error, per step.

`playwright.characterization.config.ts` fixes the capture's viewport and scale. It runs as
`npm run test:e2e`, first against the monolith (ADR-113 §3), then against the composed shell.

### 5. Contract: provider, fixtures, connector

`planContracts` pairs each GET operation of the MFE's specs with a recorded response
(`bffOperations` supplies the document, aliased to the REST names, and the hoist).

- `src/platform/bff/__tests__/contract.test.ts` (in `npm test`): the recording satisfies the
  spec's response schema, and the demo fixture for the field (or the hoisted field) equals it.
- `src/platform/bff/contract/connector.contract.ts` (in `npm run test:contract`, after
  `mesh build`): `getMeshOptions()` with `fetchFn` answering from the recordings, `getMesh()`,
  each document executed live (`x-bff-mode: live`). The wire form of the answer, with the hoisted
  list put back under its property, must equal the recording. A date-time is compared as the
  instant it names, because Mesh's DateTime scalar re-serialises `…:00Z` as `…:00.000Z`.

Operations no recording answers are listed as untested, not skipped silently.

### 6. Migrated: keepers move with their code

A test triaged `keep` (ADR-110, `triageTests`) is copied to `src/monolith/<its path>` in every MFE
whose copy of the monolith (ADR-126) resolves all of its relative imports, so it runs unchanged.
`rewrite` and `discard` are recorded in the MFE's `TESTS.md` with their reasons: the
characterization suites replace the rewrites.

### 7. Ownership

Every file is developer-owned (ADR-087). `.smt/tests.json` records the hash of what was last
written; a re-run replaces a file only while it still has that hash, so an edited test or an
updated baseline survives (`--force` replaces it). `package.json` is only added to: the
`test:e2e` and `test:contract` scripts, `@playwright/test`, and `<rootDir>/e2e/` in Jest's
`testPathIgnorePatterns`.

### 8. In the decomposition flow

`test:generate <proposal> --proposal` writes `proposal/tests.json` with provenance over
`decomposition.yaml` and the capture's `requests.json` (ADR-119), and is the `tests` step after
`port`.

## Boundaries

- Only captured behaviour is specified. A state no journey reached has no test, and `TESTS.md`
  says so. Coverage is the journeys'.
- Alone tests render a capability with no host. They prove what its own code and its data show,
  not what a host passes it: props, slots and composition are the journey spec's.
- Text checks assert presence, in order, not absence: extra text does not fail them. New text is
  the parity gate's to report (ADR-113), and the pixel baselines catch most of it.
- Writes are not contract-tested. Replaying a recorded write against a stub proves nothing about
  the write, and mutations are not inferred yet.
- Baselines are machine-specific, as ADR-113 notes. Capture where the gate runs.
- jsdom is not a browser: a capability needing WebGL or layout (the docking simulator) may not
  render alone, and its alone test fails rather than passing on nothing. The journey spec covers
  it.

## Consequences

Each MFE leaves decomposition with a suite that asserts what users saw, at every captured state,
in its own CI, and with a BFF whose connector is tested against real backend payloads. The suites
are data-driven: a new capture refreshes the JSON, not the tests. The costs are the ones of any
characterization suite. It pins today's behaviour, bugs included, so an intended change means a
visible test or baseline edit. It is only as broad as the journeys. And the generated tree adds
files a reviewer has to know are generated, which their headers and `TESTS.md` state.

## References

- PDR-014 — tests are a generated platform artifact; PDR-013 — each MFE's own tests are the proof.
- ADR-113 — the parity gate this extends into each MFE's CI.
- ADR-109 — the evidence bundle the tests are generated from.
- ADR-052 — demo mode, which the provider half checks and the connector half steps past.
- ADR-112 — the inferred specs the contract tests hold the BFF to.
- ADR-126, ADR-128 — the ported copy keepers move into, and the standalone data path alone tests run.
- ADR-087 — generated-then-owned files.
- ADR-119 — provenance for the flow step.
- #408 — the boundary stamps journey checks scope to; #418 — this work.
