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
  - src/commands/test/crawl.ts
  - src/testgen/crawl.ts
  - src/testgen/crawl-page.ts
  - src/testgen/record.ts
  - src/testgen/spec-contract.ts
  - packages/codegen/templates/base-mfe/mfe.test.ts.ejs
  - packages/codegen/templates/base-mfe-angular/mfe.test.ts.ejs
  - packages/runtime/src/base-mfe.ts
  - src/decompose/bundle.ts
  - src/decompose/capture.ts
  - packages/decompose/src/bff-plan.ts
verified-by:
  - src/testgen/__tests__/select.test.ts
  - src/testgen/__tests__/plan.test.ts
  - src/testgen/__tests__/harness.test.ts
  - src/testgen/__tests__/emit.test.ts
  - src/testgen/__tests__/contract.test.ts
  - src/testgen/__tests__/png.test.ts
  - src/testgen/__tests__/generate.test.ts
  - src/testgen/__tests__/crawl.test.ts
  - src/testgen/__tests__/crawl-page.test.ts
  - src/testgen/__tests__/spec-contract.test.ts
  - packages/runtime/src/__tests__/error-result-lifecycle.test.ts
  - src/decompose/__tests__/bundle.test.ts
  - src/decompose/__tests__/capture.test.ts
  - packages/decompose/src/__tests__/bff-plan.test.ts
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

`e2e/characterization.e2e.ts` replays every journey in which one of the MFE's capabilities
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

### 5a. An MFE that reads through its own BFF

Built natively, not ported, an MFE's screens call one GraphQL endpoint for every read, and the
browser never sees the backends behind it. Three things follow, first met building
meridian-arrivals:

- **One endpoint, many documents.** Capture keeps the body of every GraphQL POST, on any origin,
  and records each response under `METHOD url #<FNV-1a of the body>` as well as the bare key
  (`bodyKey`). Capture's replay, the alone harness and the journey spec all look the body key up
  first. The bare key still holds the first response, so existing bundles replay as before.
- **Upstream traffic is recorded on request.** `--upstream` asks each spec's server for the GET
  operations the capture holds no response for, for the contract tests only. The alone and
  journey suites still answer from the capture alone.
- **The BFF's real configuration.** Root fields are each operation id camel-cased, as the
  naming-convention transform renames them (`list_vessels` → `listVessels`). Hoists are the
  manifest's `hoistField` rules, not ones inferred from the spec (`bffOperations` takes them).
  The connector expects back the recording as far as the spec declares it. Fields the backend
  sends beyond its spec are not exposed by the BFF, and `TESTS.md` names them.

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

### 9. The journey file is the source of the UI tests

What an MFE's UI tests cover is a journey file in the journey DSL (`goto`, `click`, `fill`,
`press`, `wait`; ADR-109 §5), committed beside the manifest as `journeys.yaml`. It has two
authors:

- **A person** writes or edits it: the interactions worth holding, the inputs to fill.
- **The crawler** writes it: `test:crawl <url>` opens the running MFE and finds every operable
  control by role and accessible name. It performs each control in each state it is offered in,
  and walks every new state it reaches, breadth first, up to a budget. Each interaction becomes
  one journey that replays on its own from the start, addressed by an exact role selector.
  Selectors that do not resolve to exactly one element on the live page are dropped, so the
  file names nothing the runner cannot find.

**Forms.** A text field is filled, not clicked: a typed field (`email`, `url`, `tel`, `number`,
`date`, `password`) with a value of its type; a free-text or search field with the median word
of the page's text (the page's data, not its title — a likely match) and with a word no page
shows (the empty, no-results state). A dropdown has each of its other options chosen, up to
five, through the DSL's `select` step. Form values are part of a state's identity, so a fill
that shows nothing until submitted is still a new state. A form action — a value into a field,
an option of a dropdown — is performed once, from the first state that offers it: every value
is exercised without trying every combination. Clicks are still tried in every state.

`test:generate <mfe> --url <url>` records the journey file against the running MFE and generates
the tests from the recording. With no journey file it crawls first and writes one. The recording
is a means, not an artifact: the journey file and the generated tests are what is committed.
`--evidence` still generates from an existing bundle, as decomposition does.

Generated journey specs compare console errors with source locations masked: a rebuild renames
the bundle (`main.c8107cfa.js:42548`) without changing what was logged.

### 10. Generated with the MFE: platform conformance

`remote:generate` writes `src/platform/base-mfe/mfe.test.ts` (generator-owned, held by
`check:mfe-drift`, both framework lanes). It is the MFE's conformance suite: the class
constructed from its own manifest and held to the platform contract, not checked for the
shape of its methods:

- every capability in `@seans-mfe/contracts` exists (ADR-041, ADR-080);
- it starts `uninitialized`, loads to `ready` offering exactly the manifest's domain
  capabilities, and refuses to render before it has loaded (ADR-042);
- each domain capability renders into a container and draws, and an unknown component is
  a typed `ValidationError`;
- health, describe, schema, authorizeAccess, refresh, emit (with and without telemetry),
  updateControlPlaneState (no control plane) answer as the contract says;
- query asks the BFF the manifest derives and answers a transport failure in the envelope
  (ADR-053, ADR-106), or, with no `data:`, answers `{ data: null }` with no request (ADR-070);
- each lifecycle hook the manifest declares on load and render runs in its phase, before
  hooks ahead of after hooks, and each `error` hook runs when its capability fails, with no
  `after` hook.

The last check found that a failure a capability *reports* (`{ status: 'error' }`, as `doLoad`
and `doRender` answer) never ran the declared error hooks and ran the after hooks as if it had
succeeded. `BaseMFE.executeCapability` now treats a reported failure as ADR-042 says: error
phase, no after phase. It does **not** move the MFE to the `error` state. ADR-042 says it
should, but one MFE instance renders into many slots (six BerthTiles from one instance). In
`error`, its next render in every other slot would throw. That conflict is left to its own
decision.

### 11. Generated with the MFE: the BFF's contract from its specs

For an MFE with `data:` sources, `remote:generate` reads the OpenAPI documents the manifest
names and writes `src/platform/bff/contract/spec.json` and `spec.contract.ts` (generator-owned,
re-stamped every run). For each read operation it synthesises an upstream answer from the
response schema: every declared field, the spec's `example` first (Mesh infers a scalar's type
from it), two distinct items per list. The test runs the built Mesh against it and expects
every declared value back, then fails each upstream once and expects a GraphQL error, not
data. Writes, and parameters the BFF does not take, are listed as uncovered. A recording
(§5) later adds the same test over real traffic. Both run under `npm run test:contract`, which
new MFEs now get in `package.json`.

The generated tests read their data files with `fs` rather than importing JSON: an Angular
spec tsconfig does not allow JSON modules.

### 12. A composition's tests, run together: `test:run`

Each MFE owns its tests (§1–§11). A composition is the control plane's `rules.json`
(ADR-083): for each action, which MFE's capability goes into which slot. `test:run <project>`
reads it and runs, in one report:

1. **Each MFE's own suites**, in its own directory, from the composition's `mfes:` list:
   `npm test`'s Jest (conformance, alone, provider contract, its developer's tests), then its
   connector contracts after a `mesh build`. A placement with no directory there (a second
   build, another project's MFE) is listed, not guessed at.
2. **Every action, fired in the running shell** the way the platform delivers one: posted to
   the daemon, which relays it to the connected shells. The root action first, until the root
   placement is there. Each placement is checked to mount in its slot, found by its boundary
   stamp (#408), with the slot's own `data-slot-state` as the verdict. When one does not mount,
   its remote entry is probed, so a remote that is not served (no answer, an error, or a dev
   server's HTML fallback) reads as the environment and not as a defect in the MFE.
3. **Each placed capability's pack, inside its slot.** `test:generate` writes
   `e2e/packs/<Capability>.json`: the capability's recorded states, cut loose from the page they
   were recorded on. A case starts where a journey first shows the capability, since how the page got
   there is the host's business, and keeps each step while the capability stays on screen. The run
   performs each step inside the slot, on the MFE's recorded responses (answered by origin and
   body) and recorded clock, and checks the text after it. A step whose control is not inside
   the capability (the standalone page's own tabs) is skipped when it changed nothing the
   capability shows, and fails otherwise.

**Console errors are reported once, at the first tier that sees them.** The errors raised
composing the root action alone are the shell's own, and are never charged to an MFE. Mounting
an action is charged with what it raises beyond those, and a pack case with what its steps raise
beyond both. An error a capability's own recording already had (each case carries them, masked
of sources as the journey spec masks them) is pinned, not new, as characterization pins
everything else. Page errors count the same way.

Add an MFE to the composition, or move a capability to another slot, and the aggregate follows:
nothing in the run names an MFE. A placed capability with no pack is listed as mounted but not
behaviour-checked. Composed cases check text, not pixels: a slot's layout is the host's, so the
per-capability baselines stay in each MFE's own journey spec. The report is
`<project>/test-results/test-run/report.{md,json}`, and the command fails when any tier does.

### 13. Recorded through the platform, in any framework: the capability host

Region attribution read React's development fiber (ADR-109 §2), so a recording saw nothing
of an Angular MFE, or of a React production build, and each framework's standalone page is its
own (Angular's generated one renders none of its capabilities). The recording surface is now
the one the platform owns. `test:host <mfe>` serves a page that mounts each capability
through the shell's own adaptor (`moduleFederationAdaptor`, ADR-100), through the remote's
sealed mount handle, which brings its own framework: a tab per capability (host chrome), and
the selected one in a slot carrying the boundary stamp a shell's slot carries (#408).
`test:crawl --host` and `test:generate --host` crawl and record it.

- **The stamp is the boundary.** An element with `data-smt-capability`, no component owner
  and no landmark starts a region named `capability:<Capability>`. React's attribution, where
  there is any, nests inside it, so a React development build loses nothing. A composed
  shell's slots are landmarks already, so its captures do not change.
- **Props ride the route.** `/#/BerthTile?berthId=b2` mounts the capability with the props a
  composition would pass it. Each pack case records the props it was mounted with, and
  `test:run` runs a case only in a slot whose placement passes the same props. A placement
  passing props no case was recorded with is reported as such, and is not checked against
  another slot's content. `test:run` finds each placement by its slot as well as its stamp,
  so a capability placed six times is checked six times.
- **The host is not the MFE.** It serves the runtime under `/__smt-host/`, which capture
  treats as infrastructure (never recorded, never replayed). The MFE's own calls go to its
  origin and are recorded by URL. It listens on 5180 by default, the port recordings name,
  so the journey spec replays against `test:host` without flags.
- **Alone tests, in each framework's own test bed.** React's render through React Testing
  Library; Angular's through TestBed under the MFE's jest-preset-angular, the standalone
  component with each prop set by `setInput`. One case file, one recorded network, the same four
  assertions (text, calls, no unexpected request, no new console error), and each case renders
  with the props its route named, in both lanes. A framework with neither lane is held by its
  journey spec and its pack, and `TESTS.md` says so.
- **A server that is down keeps its contract.** `--upstream` answers an operation it cannot
  reach from what the server returned last run, and says so, instead of dropping the test: a
  regeneration had silently deleted cargo-ops' connector contracts.
- The generated journey spec is `e2e/characterization.e2e.ts`, not `*.spec.ts`, which every
  Jest default `testMatch` collects and a developer's Jest config is theirs to keep.

Recording through the host found a runtime defect: outside a webpack host, the adaptor handed
each `container.init` a fresh share scope, so a remote mounted once and never again. It now
keeps one for the page's life.

On meridian-station, the three Angular MFEs (cargo-ops, docking-control, life-support) and
React's concourse are recorded through the host from their production builds, every tier
present in each. Each MFE's suites pass, every pack passes in its slots, and a changed heading in cargo-ops' Angular
`HazardSummary` failed that capability in both browser tiers and nothing else.

## Boundaries

- `test:run`'s composed tier needs the fleet running (the shell, the daemon, every remote).
  It checks a composition on the machine it runs on; CI runs it where the fleet is up.
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
