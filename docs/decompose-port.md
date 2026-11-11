# `decompose:port` — every domain into its MFE, composed directly

After `decompose:scaffold`, each domain MFE has a stub per capability. `decompose:port` fills them
with the monolith's own code and composes the approved proposal directly: no legacy wrapper, no
strangler steps (PDR-013, ADR-126).

```bash
seans-mfe-tool decompose:port ./evidence/proposal
```

It finds the fleet from `proposal/scaffold.json` and the monolith's source from what
`decompose:analyze` recorded; `--fleet` and `--app-dir` override either.

## What it does

| | Where it lands |
|---|---|
| Copies each domain's capability files and everything they import, **unchanged** | `<mfe>/src/monolith/<original path>` |
| Renders each capability inside the providers the monolith's entry renders around its root | `<mfe>/src/features/<Cap>/<Cap>.tsx` |
| Turns each `<Routes>` block in the shell whose routes render other domains' pages into the declared slot those pages are placed in | the shell MFE's copy of the layout, and `src/monolith/__port__/slots.tsx` |
| Gives the shell an `EmptySlot` capability, placed wherever a state leaves a slot empty | `<shell mfe>/src/features/EmptySlot/` |
| Adds the packages the copied code imports, at the monolith's versions | `<mfe>/package.json` |
| Writes the shell's route table: path → state key | `shell/src/routes.ts` |
| Replaces the legacy composition with the proposal's own, compiled | `control-plane/control-plane.yaml`, `rules.json` |

Everything it writes is developer-owned (ADR-087). A re-run rewrites only what it wrote itself: a
feature file or a copied file a developer changed is kept and named in a warning (`--force`
replaces it).

It reports what it does not do: files now copied into several MFEs, couplings the proposal named,
and repeated placements (one tile per berth) that stay rendered by their parent.

## Then: the port work that is judgment

The copy is faithful, so the first composed run shows exactly what sharing the monolith did for
free. On meridian-monolith the first run was 0/7 steps, for two reasons:

1. **Production builds hide the components.** Capture maps regions through React's development
   metadata, as it did for the monolith. Build each MFE with
   `NODE_ENV=development npx rspack build --mode development` and run the shell with
   `SHELL_REACT_ENV=development`.
2. **Every store call was made three times.** Each MFE carries its own copy of the monolith's
   `AppProvider`, and each is its own React root, so a context cannot be shared. The agent's edit,
   applied to each MFE's copy of
   `examples/meridian-monolith/src/store/AppContext.tsx`: keep the store on `window` under one key,
   loaded by whichever MFE mounts first and subscribed to by the rest
   (`useSyncExternalStore`). Each MFE still runs alone. It is flagged as remaining coupling:
   the MFEs agree on the key and the shape, and the next step is each domain loading its own
   slice through its BFF.

The same run found a runtime defect, fixed with it: `RemoteMFE` reused a React root cached by
container id after the LayoutManager re-provided the slot with a new element under that id, so it
rendered into the detached element and left the visible slot empty.

## On meridian-monolith

| Candidate | Steps | Regions | Network | Console | Visual |
|---|---|---|---|---|---|
| Ported, before the agent's edits | 0 / 7 | 0 / 153 | 10 extra calls per screen | 0 | — |
| With the store edit and development builds | 7 / 7 | 153 / 153 | at parity | 0 | 0, with `--max-diff-pixels 3` |
| Same, no pixel budget | 2 / 7 | 143 / 153 | at parity | 0 | 10 |

The ten strict failures are 1–3 pixels each, with a channel difference of at most 9, on the
rounded dashed borders of the panels where a slot's wrapper now sits: antialiasing, not a change
anyone can see. The budget is stated rather than hidden.

## Limits

- **Repeated placements stay local.** `BerthTile` is rendered by the shell's `BerthStrip`, as in
  the monolith; the composition cannot bind one placement per berth until the keys are known.
- **The shell knows the route table** (`shell/src/routes.ts`) until routing proper (#423).
- **BFFs are generated but unused.** The ported components still call the backends directly. Moving
  a domain onto its BFF changes the calls the browser makes, so network parity is then checked at
  the BFF's upstream calls (#418).
- **Behavior in a different shell** is proved only by each MFE's own tests (#418, PDR-013).
