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
| Copies each domain's capability files and everything they import, **unchanged but for the data functions** | `<mfe>/src/monolith/<original path>` |
| Rewrites each data function in place: the BFF through `mfe.query()` when composed, the monolith's own code when run alone | the copied API client, plus `src/monolith/__port__/via-bff.ts` |
| Renders each capability inside the providers the monolith's entry renders around its root | `<mfe>/src/features/<Cap>/<Cap>.tsx` |
| Turns each `<Routes>` block in the shell whose routes render other domains' pages into the declared slot those pages are placed in | the shell MFE's copy of the layout, and `src/monolith/__port__/slots.tsx` |
| Gives the shell an `EmptySlot` capability, placed wherever a state leaves a slot empty | `<shell mfe>/src/features/EmptySlot/` |
| Adds the packages the copied code imports, at the monolith's versions | `<mfe>/package.json` |
| Writes the shell's route table: path → state key | `shell/src/routes.ts` |
| Replaces the legacy composition with the proposal's own, compiled | `control-plane/control-plane.yaml`, `rules.json` |

Everything it writes is developer-owned (ADR-087). A re-run rewrites only what it wrote itself: a
feature file or a copied file a developer changed is kept and named in a warning (`--force`
replaces it).

## How a read reaches the BFF — and how it still runs alone

Each MFE's BFF is GraphQL Mesh over the OpenAPI documents the proposal inferred (ADR-012,
ADR-112), and it fronts **everything that MFE's code reads**: the domain's own calls, reads across
a coupling the proposal named, and the calls of a repeated capability the MFE renders itself
(ADR-127 §1). So the shell, which owns no data, still has a BFF: its sidebar reads telemetry and
its berth strip renders the berth tiles.

The port rewrites each exported data function where it stands, in the file that makes the HTTP
calls (ADR-128):

```ts
export const getManifestLines = () =>
  viaBff(() => hm<ManifestLine>('/manifest_lines'), {
    document: 'query { listManifestLines { createdAt declaredMassKg … } }',
    field: 'listManifestLines',
  });
```

- **Composed** — a host has attached its control plane, `mfe.inControlPlane()` — the function runs
  its document through the base class's query capability, `mfe.query()`, with its lifecycle gate,
  telemetry and BFF resolution, and returns the BFF's field. The BFF already does what the
  monolith's client did by hand (camel-casing, unwrapping envelopes), so the shapes agree; the
  parity gate checks it. Query is legal only once the MFE is ready, so a read made during the first
  render waits for it.
- **Alone** — the MFE's own entry, no host — the function runs the monolith's code against the
  monolith's backends, unchanged.
- **Data this MFE does not front** — composed, `{ empty }` and no request; alone, the monolith's call.
- **A parameter the BFF cannot take** (`getDockings(berthId)`) — the BFF branch only when it is not
  given.
- **Writes, functions reading several endpoints, endpoints in no spec** — the monolith's code in both
  modes, listed in the port's output.

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
| Ported, composed, reads by `mfe.query()`, no edits | 7 / 7 | 153 / 153 | at parity: 0 missing, 0 extra, 14 repeats | 0 | 0, with `--max-diff-pixels 3` |
| Same, no pixel budget | 2 / 7 | 145 / 153 | at parity | 0 | 8 |

Composed, the browser made **no direct backend call**: every read went through the six BFFs, by
`mfe.query()`. The same cargo build loaded on its own made only the monolith's REST calls and
rendered the same manifest. No MFE shares
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
