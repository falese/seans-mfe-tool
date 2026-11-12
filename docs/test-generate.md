# `test:generate` — an MFE's tests, from what the app was seen to do

SMT generates an MFE's tests the way it generates its code (PDR-014, ADR-129). The input is a
capture of the app running (`decompose:capture`, ADR-109), which records what every component
showed at each step, the calls behind it, the console and a screenshot. That record is the
specification, and the tests hold the MFE to it.

```bash
# an MFE you built: record its journey file against it running, and generate
# (with no journeys.yaml, it crawls the MFE and writes one first)
seans-mfe-tool test:generate ./my-mfe --url http://localhost:5008 --upstream

# just the journey file: every control in every state, one journey per interaction
seans-mfe-tool test:crawl http://localhost:5008 --out ./my-mfe/journeys.yaml

# every MFE of a ported decomposition
seans-mfe-tool test:generate ./evidence/proposal --proposal

# from a capture you already have
seans-mfe-tool test:generate ./my-mfe --evidence ./evidence
```

## The journey file is the source

What the UI tests cover is `journeys.yaml`, in the journey DSL (`goto`, `click`, `fill`, `press`,
`wait`). Write it by hand, or let `test:crawl` write it: it opens the running MFE, finds every
control a person can operate by role and accessible name, performs each one in each state it is
offered in, and walks every new state, up to `--max` interactions. Each interaction is one
journey that replays on its own:

```yaml
journeys:
  - name: crawl-002
    steps:
      - goto: /
      - click: role=tab[name="📦 PassengerManifest"s]
```

Forms are crawled too. A text field is filled with a value of its type, or, for free text and
search, with a word from the page's data and with one no page shows (the empty state); each
other option of a dropdown is chosen (`select:`). Each form action is tried once, so every value
is covered without every combination. On meridian-arrivals, a name search and a clearance
filter take the crawl to 11 states and 32 interactions, and the recording to 33 journeys and
126 checks.

Edit the crawled file freely (add `fill` steps, drop what is not worth holding, rename) and
commit it. `test:generate --url` records it and regenerates the tests; the recording itself is
not kept unless you pass `--record-to`. On meridian-arrivals the crawl finds 2 states and 4
interactions, and the recording gives 5 journeys, 11 checks and 11 baselines.

## What it writes

| Suite | Files | Runs with | It fails when |
|---|---|---|---|
| **Alone**: each capability rendered by itself in jsdom, at every path it was first captured at, with no host, shell or backend | `src/features/<Cap>/<Cap>.characterization.test.tsx` and `__characterization__/<Cap>.json`; `src/__smt__/recorded-network.ts`, `recorded.json` | `npm test` | a region's text is missing or out of order, a call behind it is not made, something unrecorded is requested, or a new console error appears |
| **Journeys**: every captured journey replayed in Chromium against any URL, step by step | `e2e/characterization.spec.ts`, `e2e/characterization/evidence.json`, `playwright.characterization.config.ts` | `npm run test:e2e` | the same, per step, in a browser; a GraphQL request counts as the backend calls it stands for |
| **Visual**: one baseline per capability per step, cut from the capture's screenshot | `e2e/characterization/baselines/*.png` | `npm run test:e2e` | any pixel of the capability differs, with other placements inside it masked (`SMT_MAX_DIFF_PIXELS` sets a budget) |
| **Contract, provider**: what each backend sent against the BFF's spec, and the demo fixtures against what it sent | `src/platform/bff/__tests__/contract.test.ts`, `contract/recorded.json`, `contract/schema-check.ts` | `npm test` | a recorded response breaks its spec, or `mocks.json` no longer matches it |
| **Contract, connector**: the built Mesh, in-process, its upstream answered from the recordings | `src/platform/bff/contract/connector.contract.ts` | `npm run test:contract` | the BFF drops, adds or changes a value the backend sent |
| **Migrated**: the monolith's tests triaged keep | `src/monolith/<path>` | `npm test` | — they are the monolith's own |

Each MFE also gets a `TESTS.md`: what each suite covers, the operations no recording covers, and
what happened to each of the monolith's tests (kept, rewritten as characterization, discarded,
with the reasons).

## An MFE built natively, not ported

`meridian-station/meridian-arrivals` was made with `remote:init` and `remote:generate` like the
rest of the fleet. Its screens read through its own BFF, so a capture of it sees only the BFF:

```bash
# serve it (a development build: capture maps regions through React's development metadata)
npx mesh build && NODE_ENV=development npx rspack build --mode development
PORT=5008 npx ts-node --transpile-only server.ts

seans-mfe-tool decompose:capture http://localhost:5008 --journeys journeys.yaml --out ./evidence
seans-mfe-tool test:generate . --evidence ./evidence --upstream
```

- **Each GraphQL document is answered with its own response.** Capture records them by body as
  well as by URL, and the generated tests look the body up first.
- **`--upstream`** records each spec operation the capture holds no response for from its
  server, so the contract tests have the backends' real payloads. Without it, those operations
  are listed in `TESTS.md` as untested.
- **The BFF's own configuration is what is tested:** its hoists from the manifest, its root
  fields as the naming convention renames them. Fields a backend sends beyond its spec are not
  exposed by the BFF; `TESTS.md` names them (meridian's three backends all send `id`,
  `createdAt` and `updatedAt`, which the fleet's specs do not declare).

On meridian-arrivals: 47 Jest tests (the 10 hand-written ones included), 16 connector contracts
and both journeys pass against the running MFE. Rewording "delinquent operator" fails the alone
test, naming the missing word. Recolouring the DELINQUENT badge fails only the journey pixels.

## Running the journeys

Point the spec at the monolith first. It must pass there, which proves the capture replays
deterministically (ADR-113 §3). Then point it at the composed shell:

```bash
npx playwright install chromium        # or set CHROMIUM_PATH to an installed Chromium
SMT_TARGET_URL=http://localhost:5090 npm run test:e2e    # the monolith
SMT_TARGET_URL=http://localhost:5199 npm run test:e2e    # the composed shell
```

When the page carries the `data-smt-capability` stamps (#408), text checks are scoped to each
capability's slot. On the monolith, which has none, they read the whole page.

## A composition's tests, together

Each MFE's tests run in its own CI. `test:run` runs every MFE of a composition together,
from the control plane's `rules.json`:

```bash
examples/meridian-station/scripts/dev-up.sh            # the shell, the daemon, every remote
node bin/run.js test:run examples/meridian-station     # --suites unit,contract,composed
```

It runs each MFE's `npm test` and connector contracts, then fires every action in the running
shell, checks each placement mounts in its slot, and runs each placed capability's pack
(`e2e/packs/<Capability>.json`, written by `test:generate`) inside that slot, on the MFE's
recorded data and clock. The report is `<project>/test-results/test-run/report.md`.

On meridian-station (10 MFEs, 16 actions), in four minutes:

| Tier | Result |
|---|---|
| Each MFE's Jest | 459 passed, 9 MFEs |
| Connector contracts | 246 passed, 7 BFFs |
| Placements mounted | 21 of 24 |
| Arrivals' packs, in their slots | 23 of 23 cases |
| New console errors | 3, one per unserved remote |

Console errors are reported once, at the first tier that sees them. The shell's own, raised
composing the root action alone, are nobody's. An action is charged with what mounting it
raises beyond those, and a case with what its steps raise beyond both. What a capability's
recording already had is pinned, not new. Planting a `console.error` in arrivals' clearance
filter failed exactly the 11 cases that use the filter, each naming the error, and left the
other 12 green.

The three that did not mount are not served in a plain `dev-up.sh`: abc-kids' flappy (another
fleet's remote), the docking simulator, and crew's wasm build, which needs the Rust toolchain.
The report says so for each, quoting the remote entry or the slot's own error, so an environment gap
does not read as a regression. Placements whose MFE has no pack yet are listed as mounted but
not behaviour-checked. Record one with `test:generate`.

## Your files

Everything it writes is the MFE's own. `.smt/tests.json` records what was written; a re-run
replaces a file only while it is still what was written. Edit a test, or accept a new baseline
with `npx playwright test -c playwright.characterization.config.ts --update-snapshots`, and
`test:generate` leaves it alone and says so. `--force` replaces it.

A re-capture changes the data files (`*.json`, baselines), not the tests. Re-run `test:generate`
after one.

## On meridian-monolith

Captured with two journeys (every route, and Docking → Cargo through the nav) plus 20 explored
steps, then proposed, approved, scaffolded and ported with no edits, then `test:generate
--proposal`:

| MFE | Alone | Journey checks / baselines | Contract ops | Moved | `npm test` | `test:contract` | `test:e2e` on the monolith |
|---|---|---|---|---|---|---|---|
| shell | 1 capability, 7 states | 17 / 17 | 4 | 1 | 34 ✓ | 4 ✓ | 3 ✓ |
| cargo | 2, 2 | 6 / 6 | 3 | 1 | 27 ✓ | 3 ✓ | 3 ✓ |
| concourse | 1, 1 | 2 / 2 | 4 | 1 | 26 ✓ | 4 ✓ | 2 ✓ |
| crew | 2, 2 | 4 / 4 | 3 | 1 | 27 ✓ | 3 ✓ | 2 ✓ |
| docking | 2, 2 (`BerthTile`: no alone test) | 23 / 23 | 3 | 2 | 32 ✓ | 3 ✓ | 3 ✓ |
| life-support | 3, 3 | 7 / 7 | 2 | 1 | 28 ✓ | 2 ✓ | 3 ✓ |
| simulator | 1, 1 | 2 / 2 | — | — | ✗ (Babylon.js does not load in Jest) | — | 2 ✓ |

- **Coverage.** Line coverage of the monolith's code, as ported into the fleet and run by the
  generated suites, is **52.0%** (298 of 573 lines), against the answer key's 29.2% "before"
  measured over the same files. Outside the docking simulator, which jsdom cannot load, it is
  **97.4%**. Of the behaviours the answer key lists as untested, the captured data shows, and so
  the tests assert: "valuation pending — finance", the concourse's settlement labels (HELD,
  period open, settled), the berth strip with FREE berths and amounts due, and each route's main
  and status pair. Behaviours the seed data never triggers ("All systems nominal", "no ledger
  record", most error states) are not asserted: no journey reached them.
- **Presence, not absence.** The text check asserts what was shown, in order. It does not fail on
  extra text, so a fourth inbound row past the concourse's three-row cap passes here. The parity
  gate reports new text (`decompose:verify`), and the pixel baselines catch most of it.
- **They fail when they should.** Removing "— finance" from cargo's ported `CargoManifest` fails
  its alone test. Recolouring that label in the running monolith fails cargo's journey spec on
  pixels (244 pixels in each baseline that shows it) and nothing else.
- **The connector test found a real difference.** Mesh's DateTime scalar re-serialises
  `2026-07-15T18:40:00Z` as `2026-07-15T18:40:00.000Z`: the same instant, different text. The
  contract compares date-times as instants, and this page names the difference.
- **Running the suites fixed a port defect.** A ported feature file spread untyped props into a
  component with required ones (`BerthTile`), so docking's `npm test` did not compile. The port
  now renders the component through one cast.

## Limits

- **Only what was captured is tested.** A state no journey reached has no test. Add a journey,
  re-capture, re-run.
- **Alone is not composed.** A capability rendered alone gets no props from a host. A capability
  drawn by another once per item (meridian's `BerthTile`) has no alone test; its journey checks
  cover it.
- **jsdom is not a browser.** A capability that needs WebGL or real layout may not render alone.
  Its alone test then fails, honestly, and the journey spec is the one that holds it.
- **Record against a development build.** Regions are attributed to components through React's
  debug source, which a production build drops. A recording that attributes nothing is refused
  before anything is written, rather than replacing the suite with an empty one.
- **Composed checks are text, not pixels.** A slot's layout is the host's. Each MFE's own
  journey spec holds its per-capability baselines.
- **Reads only.** Writes are not contract-tested: replaying a write against a stub proves nothing
  about it.
- **Baselines belong to a machine.** Fonts and rasterisation differ between machines. Capture
  where the gate runs, as with any screenshot test.
- **Characterization pins bugs too.** meridian's concourse shows three inbound vessels, not four.
  The tests hold that until someone changes it on purpose, visibly, in a PR.
