# ADR-070 — Control-plane-owned data-fetch lifecycle (desired-data-state resolution)

- **Status:** Proposed
- **Date:** 2026-07-19
- **Relates to:** ADR-010 (data lifecycle alignment), ADR-003 (no custom lifecycle phases), ADR-042 (MFE lifecycle state machine), ADR-053 (RemoteMFE `doQuery`), ADR-012 (GraphQL Mesh BFF layer), ADR-027 (context injection), ADR-066/067/068 (desired-state placement, manifest-declared slots, provider-scoped addresses), ADR-054/059 (control-plane protocol / `BaseControlPlane`)
- **Tracked in:** _(to be filed)_
- **PDR:** PDR-005 (runtime composition)

## Context

The `query` capability is available on every MFE (`BaseMFE.query`), and per
**ADR-010** data fetching is already modelled as an ordinary **capability
invocation** running the same four-phase lifecycle (`before/main/after/error`)
as any other capability — there is no separate "data-loading" lifecycle, and per
**ADR-003** we do not add custom phases. So the platform already treats "fetch
data" as a first-class, lifecycle-governed operation.

What is _not_ yet true is that the **control plane owns the data-fetch lifecycle
at the high level**. Today:

- Data is **self-fetched** by the MFE: a component calls `query()` (or the
  generated `bff.ts` connector) from its own render path (e.g. Meridian's Angular
  components fetch in `ngOnInit`). The registry only decides _placement_ — which
  MFE+capability lands in which slot (ADR-066) — not _what data is fetched, when,
  in what order, or whether it is shared_.
- The `query` capability is **not uniform**: React remotes inherit the working
  `BaseMFE.doQuery` (fetches the BFF); `AngularRemoteMFE.doQuery` **throws**
  `Query not supported`. An MFE with no `data:` section has no BFF to answer.
- There is no declaration of **what data a capability/state needs**, so nothing
  server-side can fetch on an MFE's behalf without executing its browser code.

The desired end state: the same desired-state engine that resolves _placement_
also resolves _data_ — the control plane can call any MFE for its data and
orchestrate the fetch lifecycle centrally (prefetch, ordering, dedup, caching,
one auth story), while staying inside the ADR-003/010 model (data = capability,
four phases, no new phase).

### One reframing that shapes the whole design

"The control plane calls each MFE for its data" resolves, mechanically, to **the
control plane calling each MFE's BFF** — a server-side, manifest-declared HTTP
endpoint (`manifest.endpoint` + `data.serve.endpoint`, absolute since #278). The
registry already holds every MFE's manifest and can introspect each graph via the
`schema()` capability. The browser-side `mfe.query()` method (plus the ADR-054
daemon channel) is for coordinating **live, mounted instances**; it is not the
addressing primitive for "any MFE's data." The BFF is.

## Decision (proposed)

Extend registry **desired-state resolution to the `query` capability**, making the
control plane the owner of the data-fetch lifecycle. Concretely:

1. **Desired data state, analogous to desired placement (ADR-066).** The registry
   resolves `state → (MFE, capability=query, { operation, variables })` the same
   way it resolves `state → (MFE, capability=render, props)` today. This adds no
   lifecycle phase (ADR-003) and reuses the capability lifecycle (ADR-010); the
   control plane owns _when / whether / in what order_ a query runs, not a new
   phase.

2. **The BFF is the data surface.** Server-side orchestration fetches from each
   MFE's manifest-declared BFF endpoint. `schema()` provides introspection so the
   registry knows what each MFE can answer.

3. **New primitive — manifest-declared data-dependencies.** Each capability/state
   declares the data it needs (operation ref + variable bindings from context) so
   the orchestrator knows what to fetch _without running browser code_. This is
   the linchpin: it is what turns the desired-state engine into a data-orchestration
   engine. Exact syntax is an open question (see below); it must stay expressible
   within the four-phase capability model.

4. **Uniform `query` contract across frameworks.** `AngularRemoteMFE.doQuery`
   delegates to its BFF connector (kill the throw) so `mfe.query()` behaves
   identically on React and Angular. MFEs with no `data:` section return a defined
   empty result (`{ data: null }`) rather than dialing a non-existent endpoint —
   uniformity of _contract_, not a forced BFF on presentational MFEs (preserves
   the #271 "no data → no BFF" invariant).

5. **Rollout in two stages.**
   - **Hybrid first:** the control plane decides _when_ and **prefetches / primes
     a cache**; MFEs still call `query()` but hit warm data. Low coupling,
     incremental from today, no render-model change.
   - **Full orchestration:** the control plane fetches server-side and **injects
     data as render inputs** (props) so the MFE renders data-ready — server-driven
     data to match server-driven placement.

## Consequences

**Positive**
- One mental model: the desired-state engine governs both what is _shown_ and what
  is _fetched_.
- Eliminates request waterfalls; enables cross-MFE data coordination and shared
  caching/dedup at the control plane.
- One auth/tenancy story (JWT applied once at the orchestrator/BFF boundary).
- Uniform, testable `query` contract on every MFE.

**Negative / cost**
- **Coupling via declared data-dependencies:** the control plane must know each
  MFE's data needs. This is deliberate (it's what enables orchestration) but it
  narrows MFE independence and must be declared, not inferred.
- The control plane becomes a **data-critical path** — needs caching, invalidation
  (likely driven by `updateControlPlaneState`, ADR-054), and partial-failure
  semantics.
- **Security surface:** a control plane that can read any MFE's data is powerful;
  the BFF auth boundary and per-MFE scoping must hold.

## Alternatives considered

- **(A) Self-fetch only, just make the contract uniform.** Smallest change (only
  the Angular `doQuery` fix + no-data answer). Keeps data ownership in the MFE; the
  control plane never orchestrates. Rejected as the _end_ state because it does not
  deliver high-level lifecycle control — but it is the correct **first increment**
  and a subset of this decision.
- **(B) Browser-driven via the daemon channel only.** The control plane drives
  `mfe.query()` on mounted instances over ADR-054. Deferred: works only for live,
  mounted MFEs, so it cannot be the primitive for "any MFE's data"; useful later
  for coordinating live instances.

## Open questions (to resolve before/inside implementation)

1. **Data-dependency declaration syntax** in the manifest — operation reference +
   variable binding from `context`, kept inside the four-phase model (ADR-003/010).
2. **Cache + invalidation policy** — TTL vs event-driven; how `updateControlPlaneState`
   invalidates dependent data.
3. **Auth / tenancy** — how the orchestrator scopes each BFF call per user.
4. **Partial-failure semantics** — one BFF down: degrade the slot, block render, or
   render with `errors[]`?
5. **Injection contract** — how orchestrated data reaches the MFE as render inputs
   without breaking the ADR-056/060 presentation boundary.

## Enabling increments (suggested order)

1. **Uniform `query`:** `AngularRemoteMFE.doQuery` delegates to its BFF; no-data
   MFEs return `{ data: null }`. _(bounded, TDD, valuable regardless of the rest)_
2. **Manifest data-dependency schema** (Zod) + validation.
3. **Registry desired-data-state resolver** (mirror the ADR-066 placement resolver).
4. **Server-side orchestrator** + render-input injection (full-orchestration stage).
5. **Cache / invalidation** wired to `updateControlPlaneState`.
