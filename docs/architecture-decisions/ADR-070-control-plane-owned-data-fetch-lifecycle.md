# ADR-070 — Experience-scoped federated supergraph (control-plane-composed data over participant MFE BFFs)

- **Status:** Accepted (implementation phased)
- **Date:** 2026-07-19
- **Relates to:** ADR-012 (GraphQL Mesh BFF layer), ADR-010 (data lifecycle alignment), ADR-003 (no custom lifecycle phases), ADR-042 (MFE lifecycle state machine), ADR-053 (RemoteMFE `doQuery`), ADR-027 (context injection), ADR-054 (control-plane message protocol), ADR-055 (LayoutManager — daemon-driven slot composition), ADR-057 (virtualized per-slot `DaemonChannel`), ADR-059 (`BaseControlPlane`), ADR-066/067/068 (desired-state placement, manifest-declared slots, provider-scoped addresses)
- **Tracked in:** #282
- **PDR:** PDR-005 (runtime composition), PDR-006 (ecosystem scaling thesis)

## Context

The `query` capability is on every MFE, and per **ADR-010** data fetching is already
an ordinary capability invocation on the four standard lifecycle phases (**ADR-003**:
no custom phases). What was missing is the **control plane owning the data-fetch
lifecycle at the high level** — deciding _when / whether / in what order_ data is
fetched across the MFEs composing an experience, and being able to call any
participant for its data.

The first proposal made the control plane depend on **manifest-declared
data-dependencies** — each MFE declaring the data shape it needs. That was rejected:
it is *static-shape coupling*, it grows with every MFE's schema, and it pushes data
knowledge upward, undermining the "MFEs as independently deployable units" thesis
(CLAUDE.md, PDR-006).

The synthesis that resolves the coupling: **discover, don't declare.** The registry
already knows which MFEs participate in an experience (it resolved their placement,
ADR-066). Each participant's BFF already publishes a schema (the `schema()`
capability / Mesh SDL). So the control plane **introspects the participants and
stitches their schemas into one supergraph — composed at resolution time, for exactly
that set of participants, at that moment.** There is no static data-dependency
artifact anywhere; the "data-dependency graph" is the emergent composition of the
self-describing schemas of whoever is on stage right now. This is **ADR-012's Mesh
BFF one level up**: a gateway whose *sources are the participant BFFs*.

This also makes the platform's composition thesis literal — independently published
domain graphs composing into an experience is exactly the "marketplace of
domain-capability packages" goal (PDR-006) — and it is the point of the Meridian
Station demo ("the mess is the point": cargo manifest lines in one system, their
valuations in another; the per-MFE BFF tames each mess, the supergraph is where the
cross-MFE composition happens).

## Decision

The **control-plane registry composes an experience-scoped federated supergraph** from
the schemas of the MFEs currently participating in an experience, and owns the
data-fetch lifecycle over it. Data ownership stays in the MFEs; the control plane owns
*composition and orchestration*, not data shape.

1. **Discovery, not declaration.** Participants come from placement resolution
   (ADR-066). The registry fetches each participant's schema via the `schema()`
   capability and composes them. No manifest data-dependency declaration exists.

2. **The supergraph gateway runs in the daemon as a Mesh instance** whose `sources`
   are the participant BFFs' `/graphql` endpoints — dogfooding ADR-012: the platform's
   own BFF technology composes the supergraph. (Where each MFE BFF is a Mesh over its
   own upstreams, the daemon supergraph is a Mesh over the MFE BFFs.)

3. **Type scoping by provider MFE id.** Every type in the supergraph is namespaced to
   the unique id of the MFE that provides it — conceptually `<mfeId>.User`
   (`meridian-docking-control.User`, `meridian-life-support.User`). On the wire this is
   a per-source prefix/rename transform (GraphQL identifiers can't contain `.`), e.g.
   `meridian_docking_control_User`. Collisions become impossible and provenance is
   explicit.

4. **Union-first; joins are phase 2.** The default supergraph is a **union** — one
   endpoint, query any participant's data, **zero config**. Cross-graph **joins**
   (type merging across subgraphs) are a later phase and require **relationship keys**
   (identity only, e.g. `manifestLineId`) that live in the **control-plane / experience
   layer, never in the MFEs**. Even joined, no MFE declares its data shape; the only
   new artifact is a small relationship map owned by the composition layer.

5. **Two caches.** The **registry caches the composed schema**, keyed by a
   participant-set signature (recompose when participants change, not per query). The
   **control plane caches the resultant data**. Invalidation rides
   `updateControlPlaneState` (ADR-054): a participant pushing new domain state signals
   the control plane to invalidate/refresh dependent data.

6. **Degrade, never fail the experience.** If a participant BFF is unreachable, its
   subgraph is dropped and the supergraph recomposed without it. The experience renders
   with reduced data; it is never failed by one participant.

7. **Auth passes through per subgraph.** The daemon gateway forwards the request JWT to
   each participant BFF; tenancy/scoping is enforced at each subgraph's own BFF (the
   boundary that already owns it).

8. **`schema()` becomes mandatory and load-bearing.** Every data-owning MFE must
   publish an accurate SDL via `schema()` — it is the composition contract. This is
   enforced (a data-owning MFE with no/invalid schema is a build/registration error).

9. **Uniform `query` / `schema` across frameworks (increment 1).**
   `AngularRemoteMFE.doQuery`/`doSchema` currently throw; they must delegate to the
   MFE's BFF like React's do. MFEs with no `data:` section contribute no subgraph and
   their `query()` returns `{ data: null }` — uniform *contract*, not a forced BFF
   (preserves the #271 "no data → no BFF" invariant).

10. **The registry owns the data-fetch lifecycle** — compose / recompose / fetch /
    refresh / invalidate — expressed over the supergraph. This stays inside ADR-003/010
    (data is a capability on the four phases; no new phase is introduced). The
    `LayoutManager` (ADR-055) — which already executes control-plane decisions on
    mounted instances — is the executor; the ADR-057 `DaemonChannel` is the transport.

## How it rides existing rails

- **Participant set** — placement resolution (ADR-066) already produces it.
- **Per-MFE data surface** — the manifest-declared BFF endpoint (absolute since #278),
  introspectable via `schema()`.
- **Executor + transport** — `LayoutManager` (ADR-055) + `DaemonChannel` (ADR-057)
  already drive capabilities on mounted instances from control-plane resolution.
- **Feedback loop** — `updateControlPlaneState` (ADR-054) already carries domain-state
  changes upward; it becomes the invalidation trigger.
- **Composition technology** — Mesh (ADR-012), reused one level up.

New components: a **daemon-hosted supergraph Mesh gateway**, a **registry schema
cache**, and a **control-plane data cache**.

## Consequences

**Positive**
- Zero static-shape coupling — dependencies are discovered from published schemas, not
  declared. MFE independence preserved (PDR-006).
- Server-side unified data surface with cross-MFE composition — the capability pure
  daemon-driven self-fetch could not provide.
- One auth story, one cache tier, one place that owns the data-fetch lifecycle.
- The composition thesis and the Meridian demo become literal, dogfooding Mesh.

**Negative / cost**
- A new stateful control-plane component (daemon gateway + caches) on the data path —
  needs cache-invalidation discipline and a participant-set signature definition.
- `schema()` accuracy is now load-bearing across every data-owning MFE and both
  frameworks.
- Joined supergraphs reintroduce a *small* config surface (relationship keys) — bounded
  to identity, and located in the control-plane layer, not the MFEs.

## Alternatives considered

- **(A) Manifest-declared data-dependencies.** _Rejected_ — static-shape coupling that
  grows per MFE and pushes data knowledge upward, against PDR-006.
- **(B) Daemon-driven self-fetch only (browser instances via the daemon channel).**
  _Subsumed_ — B was the lifecycle-control half without server-side composition. This
  decision keeps B's decoupling and adds the supergraph as the composition half.
- **(C) Client-side schema stitching in the shell.** _Rejected_ — defeats server-side
  composition/caching and cross-origin control; puts the supergraph in every browser.

## Decisions locked this session

| Consideration | Decision |
| --- | --- |
| Type/name collisions | Scope every type to the provider MFE id (`<mfeId>.Type`; wire form = per-source prefix) |
| Composition/data caching | Schema cached in the **registry**; resultant data cached in the **control plane** |
| Participant BFF down | **Degrade** the supergraph (drop subgraph, recompose) — **never fail** the experience |
| Auth | JWT **passthrough** to each participant BFF; tenancy enforced per subgraph |
| `schema()` | **Mandatory** and load-bearing for data-owning MFEs; enforced |
| Gateway location | Runs in the **daemon** as a **Mesh instance** over the participant BFFs (dogfooding) |
| Starting scope | **Union-first**; joined (relationship keys) is an explicit phase 2 |

## Open questions (phase 2 / detail)

1. **Relationship-key syntax** for joined supergraphs and where in the control-plane
   layer it is authored (experience config vs registry rules).
2. **Participant-set signature** definition for the schema cache key (ids + versions +
   schema hash?).
3. **Cache-invalidation policy** specifics — which `updateControlPlaneState` stateKeys
   invalidate which cached data.
4. **Supergraph exposure** — is the endpoint control-plane-internal only, or also
   queryable by participant MFEs (so a sibling can read composed data)?
5. **Prefetch-before-mount** — composing/warming before any instance is mounted.

## Enabling increments (suggested order)

1. **Uniform `query`/`schema`** — `AngularRemoteMFE.doQuery`/`doSchema` delegate to the
   BFF; no-data MFEs return `{ data: null }`. _(bounded, TDD; unblocks everything)_
2. **`schema()` SDL enforcement** for data-owning MFEs (build/registration gate).
3. **Registry schema cache** + participant-schema introspection at resolution.
4. **Daemon supergraph Mesh gateway** — union composition with per-source id prefixing.
5. **Control-plane data cache** + degrade-on-participant-down.
6. **Joined supergraph** — relationship keys + cross-subgraph type merge. _(phase 2)_

## References

- ADR-012 GraphQL Mesh BFF layer · `docs/architecture-bff.md`
- ADR-010 data lifecycle alignment · ADR-003 no custom lifecycle phases
- ADR-054 control-plane message protocol · ADR-055 LayoutManager · ADR-057 DaemonChannel
- ADR-066/067/068 desired-state placement and slot contract
- #278 manifest-derived absolute BFF endpoint · `docs/query-capability.md`
- Meridian Station reference app (`examples/meridian-station/`) — the composition showcase
