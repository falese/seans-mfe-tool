# `decompose:port` — every domain into its MFE, reading through its own BFF

After `decompose:scaffold`, each domain MFE has a stub per capability and a generated BFF.
`decompose:port` fills the stubs with the monolith's own code, routes every read that code makes
through the MFE's own BFF, and composes the approved proposal directly: no legacy wrapper, no
strangler steps, no state shared between MFEs (PDR-013, ADR-126, ADR-127).

```bash
seans-mfe-tool decompose:port ./evidence/proposal
```

It finds the fleet from `proposal/scaffold.json` and the monolith's source from what
`decompose:analyze` recorded; `--fleet` and `--app-dir` override either.

## What it does

| | Where it lands |
|---|---|
| Copies each domain's capability files and everything they import, **unchanged above the transport** | `<mfe>/src/monolith/<original path>` |
| Reroutes the copied code's HTTP transport (`axios.create(...)`, `fetch`) to the MFE's BFF | the copies, plus `src/monolith/__port__/bff-http.ts` and `bff-operations.ts` |
| Renders each capability inside the providers the monolith's entry renders around its root | `<mfe>/src/features/<Cap>/<Cap>.tsx` |
| Turns each `<Routes>` block in the shell whose routes render other domains' pages into the declared slot those pages are placed in | the shell MFE's copy of the layout, and `src/monolith/__port__/slots.tsx` |
| Gives the shell an `EmptySlot` capability, placed wherever a state leaves a slot empty | `<shell mfe>/src/features/EmptySlot/` |
| Adds the packages the copied code imports, at the monolith's versions | `<mfe>/package.json` |
| Writes the shell's route table: path → state key | `shell/src/routes.ts` |
| Replaces the legacy composition with the proposal's own, compiled | `control-plane/control-plane.yaml`, `rules.json` |

Everything it writes is developer-owned (ADR-087). A re-run rewrites only what it wrote itself: a
feature file or a copied file a developer changed is kept and named in a warning (`--force`
replaces it).

## How a read reaches the BFF

Each MFE's BFF is GraphQL Mesh over the OpenAPI documents the proposal inferred (ADR-012,
ADR-112), and it fronts **everything that MFE's code reads**: the domain's own calls, reads across
a coupling the proposal named, and the calls of a repeated capability the MFE renders itself
(ADR-127 §1). So the shell, which owns no data, still has a BFF: its sidebar reads telemetry and
its berth strip renders the berth tiles.

The port writes, per MFE, one GraphQL document per endpoint its BFF fronts. Each document is
derived from the same specs the BFF is generated from, with aliases that restore the REST property
names and a list hoisted out of its envelope put back where it was. The monolith's client code
calls `http.get('/api/ledger/charges')` as before and gets the same body back:

```
http.get('/api/ledger/charges')
  → query { r: listCharges { meta { cursor hasMore } } h: charges { chargeId amountCents … } }
  → { result: [...], meta: { cursor, hasMore } }
```

A read the MFE's BFF does not front (a copied store that loaded everything the monolith loaded)
returns that endpoint's body with every list empty, and makes no request. Writes are refused until
mutations are inferred. The transports the port cannot take over (XMLHttpRequest, calling axios as
a function) are reported, not rewritten.

## Running it for the parity gate

1. **Build each MFE for the gate:** `npm install`, `npx mesh build` (where it has a BFF), and
   `NODE_ENV=development npx rspack build --mode development` — capture maps regions through
   React's development metadata, as it did for the monolith.
2. **Serve each MFE with its BFF, in demo mode:** `DEMO_MODE=true PORT=<port> npx ts-node
   --transpile-only server.ts`. Demo mode answers from `mocks.json`, which scaffold filled with the
   captured responses (ADR-052), so the run is deterministic and needs no backend.
3. **The shell** with `SHELL_REACT_ENV=development`, the control plane, and `rules.json`
   registered, as for the legacy run.
4. `seans-mfe-tool decompose:verify ./evidence --url http://localhost:5199`

Verify lets each BFF request through to the BFF and reads it as the backend calls it stands for.
A call the monolith never made by that step is extra; one it made that nothing makes is missing; a
domain re-loading data the monolith had already loaded is **repeated** — reported, not failed
(ADR-127 §4).

## On meridian-monolith

| Run | Steps | Regions | Network | Console | Visual |
|---|---|---|---|---|---|
| Ported through the BFFs, no edits | 7 / 7 | 153 / 153 | at parity: 0 missing, 0 extra, 16 repeats | 0 | 0, with `--max-diff-pixels 3` |
| Same, no pixel budget | 2 / 7 | 145 / 153 | at parity | 0 | 8 |

The browser made **no direct backend call**: all 32 reads went through the six BFFs. No MFE shares
state with another; each copy of the monolith's store is byte-identical to the original and loads
only what its MFE's BFF fronts. Both runs were the same twice over.

The eight strict failures are 1–2 pixels each, with a channel difference of at most 9, on the
rounded dashed borders where a slot's wrapper sits: antialiasing. The budget is stated, not
hidden.

Getting here fixed, along the way:

- **A runtime defect.** `RemoteMFE` reused a React root cached by container id after the
  LayoutManager re-provided the slot with a new element under that id, rendering into the detached
  element.
- **A generator defect.** A data source's `hoistField` transform did not add
  `@graphql-mesh/transform-hoist-field` to `package.json`, so `mesh build` failed; meridian-station's
  MFEs had it added by hand.
- **Replay.** A BFF's CORS preflight has to reach it, or the browser never sends the request.

## Limits

- **Repeated placements stay local.** `BerthTile` is rendered by the shell's `BerthStrip`, as in
  the monolith; its data comes through the shell's BFF (ADR-127 §1), so it is duplicated code, not
  runtime coupling. Composing it per berth needs the keys bound in the composition.
- **Domains load overlapping data.** The shell and docking both load berths, dockings and charges.
  That is the cost of each deploying alone; the parity report counts every repeat.
- **The shell knows the route table** (`shell/src/routes.ts`) until routing proper (#423).
- **Behavior in a different shell** is proved only by each MFE's own tests (#418, PDR-013).
