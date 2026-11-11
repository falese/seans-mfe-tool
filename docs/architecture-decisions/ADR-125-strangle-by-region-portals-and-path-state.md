---
id: 0125
title: >-
  A strangler step swaps one region of the monolith, which keeps a single React tree and renders
  each placed region into its slot through a portal; the shell enters state keys from the URL
  by the proposal's route table
status: Deferred
date: 2026-11-11
deciders: [sean]
area: Decomposition / strangler
enforcement: tooling
tags: [decomposition, strangler, legacy, composition, routing, portals]
relates-to: [60, 83, 108, 110, 111, 113]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by: []
verified-by: []
tracked-by: ["#410", "#419", "#423"]
summary: >-
  ADR-111 §3 says strangling moves one placement at a time from the legacy capability to a new
  MFE. Scaffolding showed that cannot happen as written: the legacy capability renders the whole
  monolith into the shell's root, so there is no placement smaller than the app to move. This
  proposes that the monolith's federation module expose `mountRegion(element, { component })`,
  backed by one React root that renders every mounted region into its element through a portal,
  under the monolith's own router and providers. The first strangler step places the proposal's
  shell domain and puts a legacy region in every slot; each later step swaps one region for its
  new capability. The scaffolded shell enters state keys from `location.pathname` using the
  proposal's route table.
rationale-summary: >-
  One tree with portals keeps the monolith's providers, store and router single, so each data
  call is made once and network parity (ADR-113) holds while regions are spread across slots.
  One root per region would duplicate every provider and every fetch. Flipping all placements in
  one step would give the parity gate nothing smaller than the whole migration to judge.
long-form: true
---

> **Deferred (2026-11-11, PDR-013).** Decomposition now ports every domain and composes the
> proposal directly; strangling is for a monolith that must keep running through the migration,
> and none needs it yet. §4's URL-driven state keys were needed regardless and are decided in
> ADR-126 instead.

## Context

`decompose:scaffold` (#417) implements ADR-111 §1–2: the monolith is `legacy-<app>`, whose one
capability loads the monolith's remote entry and calls `mount(element)`. On meridian-monolith the
composed shell running only that capability is at parity with the monolith: 7/7 steps, 153/153
regions, no new console errors, no visual failures.

ADR-111 §3 then says each strangler step "moves one placement to a new MFE's capability". There
is only one placement: `LegacyMeridianOps` into `root`, under every state key. The proposal's own
composition (`control-plane/target.yaml`) places `App` into `root` and `CargoManifest` into
`meridian-ops-shell/main`, and so on. Nothing the legacy capability can do today fills
`meridian-ops-shell/main` with only the cargo page, so the first step that moves anything moves
everything. That is the big-bang cut-over PDR-011 rules out.

Two further facts shape the answer:

- The monolith's components read a shared store (`store/AppContext.tsx`) and its router. Mounting
  each region as its own React root gives each its own `AppProvider`, and each provider fetches.
  The parity gate would see every call made once per region (ADR-113, network).
- Placements are chosen by state key, but nothing sends the state key for `/cargo`. The monolith
  routes inside its own `BrowserRouter`, which is enough while it renders everything. It is not
  enough once the shell must place `CargoManifest` for `/cargo`. Routing is parked as #423, but
  strangling needs its smallest form.

## Decision (proposed)

### 1. The monolith exposes regions, not only its root

The federation module scaffold describes gains `mountRegion(element, { component, props })`.
Its first call creates one React root, rendered off-screen, holding the monolith's router and
providers exactly as `src/index.tsx` builds them. Each call adds a portal of `component` into
`element`; the returned function removes that portal. `component` is a capability name from the
proposal, resolved through a table scaffold generates from `decomposition.yaml`
(`capabilities[].file` and `component`). `mount(element)` stays for the starting composition.

### 2. The legacy capability takes the region as a prop

`LegacyMeridianOps` with `props: { region: 'CargoManifest' }` mounts that region; with no
`region` it mounts the whole app, as now. One capability, so the manifest and the registry do not
grow per region.

### 3. Steps

1. **Start** (scaffold): the legacy capability, whole, in `root` for every state key.
2. **Frame**: the shell domain's capability into `root`, and in each of its slots the legacy
   capability with that slot's region. Parity checks the frame alone.
3. **Swap**: per route and slot, `region: X` becomes the new MFE's capability `X`. One swap per
   step, `compose:build`, then `decompose:verify`. Repeated placements (one tile per berth) swap
   as one step.
4. **Done**: nothing places the legacy capability; `legacy-<app>` leaves `mfes`.

`decompose:strangle --next` would write the next step's `control-plane.yaml` from
`target.yaml` and the current one. That command is #419's, not this ADR's.

### 4. The shell enters state keys from the URL

The scaffolded shell carries the proposal's route table (`path` → `stateKey`) and sends
`STATE_UPDATE` for the matching key on load and on each history change (`pushState`,
`popstate`), exact match first, then the longest prefix. It is the smallest routing that makes
§3 work and is not #423's design. Paths without a route keep the current state.

## Boundaries

- A region that reads layout from its parent (CSS grid placement, a context its parent provides
  outside the router and store) renders differently in a slot. The frame step's parity run is
  where that shows. The fix is in the port (#419), not in this mechanism.
- Portals keep events bubbling through the React tree, not the DOM. A monolith listening on
  `document` for a region's events sees them unchanged; one relying on DOM ancestry between
  regions does not.

## Consequences

Each strangler step is one placement change that the parity gate judges on its own, and the
monolith keeps one store and one router throughout. The cost is generated code in the monolith's
own repository (the region table) and a shell that knows the route table, which #423 will later
replace.

## References

- ADR-111 — the legacy wrapper this extends; §3 is what this makes possible.
- ADR-113 — the parity gate each step runs.
- ADR-060 — contextualized VM composition: the monolith is value-injected as an island, and its regions inherit that.
- #417 — scaffold, where the gap showed. #419 — port and strangle. #423 — routing.
