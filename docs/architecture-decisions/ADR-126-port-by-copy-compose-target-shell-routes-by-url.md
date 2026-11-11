---
id: 0126
title: >-
  decompose:port copies each domain's source into its MFE and wraps it in the monolith's own
  providers, turns the shell's route blocks into declared slots, composes the proposal directly,
  and the shell enters state keys from the URL
status: Implemented
date: 2026-11-11
deciders: [sean]
area: Decomposition / port
enforcement: tooling
tags: [decomposition, port, composition, routing, slots]
relates-to: [58, 60, 83, 84, 87, 110, 111, 113, 125]
supersedes: []
superseded-by: []
implements-pdr: [11, 13]
implemented-by:
  - src/decompose/port/source.ts
  - src/decompose/port/port.ts
  - src/commands/decompose/port.ts
  - src/decompose/scaffold/shell.ts
  - packages/decompose/src/derive.ts
verified-by:
  - src/decompose/port/__tests__/port.test.ts
  - src/decompose/port/__tests__/source.test.ts
  - src/decompose/scaffold/__tests__/shell.test.ts
tracked-by: ["#410", "#419", "#423"]
summary: >-
  Porting is deterministic and lands only in developer-owned files. Each domain's capability
  files and everything they import are copied, unchanged, under the MFE's `src/monolith/`; each
  capability's feature file renders its component inside the provider tree the monolith's entry
  renders around its root. In the shell domain, a `<Routes>` block whose routes render other
  domains' capabilities becomes the declared slot those capabilities are placed in. The
  proposal's composition replaces the legacy one, and the scaffolded shell enters the state key
  for the URL on load and on every history change. What is left — a store each MFE now loads in
  full, a coupling across domains — is the agent's judgment, and the parity report lists it.
rationale-summary: >-
  Copying unchanged code keeps the port reviewable and makes the first composed run a test of
  the boundaries, not of a rewrite. Wrapping with the monolith's own providers gives each
  component the context it was written against, without guessing which it needs. Turning route
  blocks into slots is the one structural edit composition needs; anything subtler is a judgment
  call, made by the agent with the parity report in hand.
long-form: true
---

## Context

PDR-013 makes "port every domain, then compose the proposal" the default. `decompose:scaffold`
(ADR-111) leaves each domain MFE with a stub per capability. The monolith's components depend on
things the stubs do not have: its router, its store provider, shared helpers, and, in the shell
domain, a layout that renders every other domain's page itself.

The composed app also has to show the right screen for a URL. Placements are chosen by state key
(ADR-083), and nothing turns `/cargo` into `meridian-ops.open.cargo`. Routing proper is #423;
this needs only its smallest form.

## Decision

### 1. Copy, unchanged, into developer-owned files

For each domain, the closure of its capability files over relative imports is copied to
`<mfe>/src/monolith/<original path>`. Relative imports keep working because paths are kept. A
file in several closures (the proposal's `shared`) is copied into each, and the port reports it.
Nothing generator-owned is touched (ADR-084, ADR-087).

### 2. Each capability renders inside the monolith's providers

The monolith's entry file renders its root inside some tree (`<BrowserRouter><AppProvider><App/>`).
Port reads that tree from the entry's render call and writes each capability's feature file to
render the capability's component in place of the root, with the same providers.

### 3. The shell's route blocks become slots

In the shell domain, a `<Routes>` block whose routes render other domains' capabilities is
replaced with the declared slot those capabilities are placed in (`decomposition.yaml`
`routes[].place`), registered through the `provideSlot` render prop (ADR-058). The block's
container and the rest of the shell's code are kept. A repeated placement (one tile per berth)
stays rendered by its parent until the composition can bind its keys; the port reports it.

### 4. The proposal's composition replaces the legacy one

`control-plane.yaml` becomes the proposal's own (`target.yaml`), compiled to `rules.json`. The
legacy wrapper leaves `mfes`.

### 4a. Every state says what every slot shows, nothing included

Placement is desired state per address (ADR-066), and nothing retracts one: a slot keeps the last
capability placed in it. The monolith's route tables say "nothing here" for some paths
(`<Route path="*" element={null} />`). So the shell domain gains an `EmptySlot` capability that
renders nothing, and the derived composition places it into every non-repeated shell slot a state
does not fill. A state's placements are then complete, and leaving a screen clears what it showed.

### 5. The shell enters state keys from the URL

`shell/src/routes.ts` holds the proposal's route table. The shell sends the root state key once
the control plane connects, then the key for the current path, and again on every `pushState`,
`replaceState` and `popstate`; exact path first, then the longest prefix. With an empty table
(scaffold's legacy composition) it sends only the root key, as before.

### 6. Dependencies follow the code

Every bare import in a copied closure is added to the MFE's `package.json` at the version the
monolith declares.

## Boundaries

- The port does not slice shared state. Each MFE's copy of a store loads what the whole monolith
  loaded, so the composed app makes those calls once per MFE, and the parity gate's network check
  says so. Cutting each copy down to what its MFE reads, or injecting it from the host (ADR-060),
  is the agent's work, guided by `couplings` in the proposal and the parity report.
- A layout that a moved component inherited from its parent (grid placement, a parent's context
  outside the entry's providers) shows up as a visual or content difference.

## Consequences

The first composed run is a test of the boundaries the proposal drew. The cost is duplicated
code in each MFE until the agent removes it, and a shell that knows the route table until #423.

## References

- PDR-013 — port then compose, by default.
- ADR-111 — the monolith as one generated legacy MFE, wrapped by Module Federation: the fleet this ports into.
- ADR-125 — strangle by region portals and path state: deferred by PDR-013.
- ADR-058 — slot-provider MFEs, the `provideSlot` render prop.
- ADR-113 — the parity gate that checks the result.
