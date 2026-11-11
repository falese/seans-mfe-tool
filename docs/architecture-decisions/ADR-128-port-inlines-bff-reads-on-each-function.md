---
id: 0128
title: >-
  A ported MFE runs either way: each of the monolith's data functions is rewritten in place to read
  through the MFE's BFF with the base class's query capability when a host has composed it, and to
  run the monolith's own code when it runs alone
status: Implemented
date: 2026-11-11
deciders: [sean]
area: Decomposition / port / data
enforcement: tooling
tags: [decomposition, port, bff, base-mfe, query, standalone]
relates-to: [53, 57, 60, 87, 126, 127]
supersedes: []
superseded-by: []
implements-pdr: [11, 13]
implemented-by:
  - packages/runtime/src/base-mfe.ts
  - src/decompose/source/graph.ts
  - packages/decompose/src/bff-plan.ts
  - src/decompose/port/source.ts
  - src/decompose/port/shim.ts
  - src/decompose/port/port.ts
verified-by:
  - src/decompose/port/__tests__/shim.test.ts
  - src/decompose/port/__tests__/source.test.ts
  - src/decompose/port/__tests__/port.test.ts
  - packages/runtime/src/__tests__/base-mfe.unit.test.ts
tracked-by: ["#410", "#419"]
summary: >-
  Replaces ADR-127 §2's transport swap. The port no longer hides a REST-to-GraphQL shim behind the
  monolith's HTTP instance. It rewrites each exported data function that reads one endpoint, in its
  own file: `viaBff(() => <the monolith's call>, { document, field })`. Composed by a host, the
  function runs that document through `mfe.query()` — the base class's query capability, with its
  lifecycle gate, telemetry and BFF resolution (ADR-053) — and returns the BFF's field. Run alone,
  it runs the monolith's code against the monolith's backends, unchanged. Whether it is composed is
  what the host already does to every MFE it mounts: attach its control plane (ADR-057), now
  readable as `BaseMFE.inControlPlane()`.
rationale-summary: >-
  The routing is visible where the data is asked for, so a developer reads and edits it per
  function, and the original code stays beside it as the standalone path. Going through the base
  class keeps the platform's lifecycle, telemetry and endpoint rules in front of every read instead
  of a parallel client. The BFF already does what the monolith's client did by hand — camel-casing
  and unwrapping envelopes — so a function's BFF branch returns the BFF's field as it is, and the
  parity gate checks the two shapes agree. Keying the mode on the host's existing attachment needs
  no configuration that could disagree with how the MFE is actually running.
long-form: true
---

## Context

ADR-127 routed every read of a ported MFE through its BFF by replacing the monolith's HTTP
instance with a generated shim. It worked — meridian-monolith at parity with no direct backend
call — but:

- the shim was a parallel client: it called the generated connector directly, beside the base
  class's `query` capability (ADR-053) rather than through it;
- an MFE could only run composed: with the transport swapped, its code no longer reached the
  monolith's backends when run on its own;
- the routing was invisible at the functions that ask for data.

The direction from the product owner: use the base class's methods, put the routing inline on the
functions, and let an MFE run standalone against its monolith's code or composed in the control
plane.

## Decision

### 1. Composed means a host attached its control plane

The LayoutManager attaches a control-plane channel to every MFE it mounts (ADR-057); nothing else
does. `BaseMFE.inControlPlane()` reports it. An MFE's own development entry never attaches one, so
it runs standalone.

### 2. Each data function is rewritten in place

For each exported function that reads exactly one `GET` endpoint (resolved through wrapper
functions by the source graph), in a file that makes the HTTP calls, the port rewrites its body
where it stands. A function that reads only by calling those — a store's loader — is left alone:
it reads through them, already rewritten.

```ts
export const getBerths = () =>
  viaBff(() => hm<Berth>('/berths'), { document: 'query { listBerths { berthId … } }', field: 'listBerths' });
```

`viaBff` runs the monolith's call when not composed. Composed, it runs the document with
`mfe.query()` and returns `data[field]`. The query capability is legal only in `ready` (the
platform contract's lifecycle gate, ADR-042), and a monolith's component fetches from its first
effect, while the MFE is still `rendering`, so `viaBff` waits for `ready` first, and fails with a
typed error if the MFE goes to `error` instead. Making `query` legal mid-render, as
`updateControlPlaneState` already is, would remove the wait; that is a change to the
cross-language platform contract and is not made here. The document is derived from the spec the BFF is generated
from; `field` is the operation, or the list a hoist unwraps. A function parameter that maps to no
operation parameter becomes a condition: the BFF branch is taken only when it is undefined.

### 3. Data the MFE does not front is empty when composed

A function whose endpoint the MFE's BFF does not front (ADR-127 §1 decides what it fronts) gets
`viaBff(() => <call>, { empty })`: composed, the BFF-shaped empty value and no request; standalone,
the monolith's call.

### 4. What stays on the monolith's path, reported

Writes, functions reading more than one endpoint, and functions the source graph cannot resolve
keep the monolith's code in both modes. The port lists each, with the reason.

### 5. The BFF's shape is the function's shape

The BFF camel-cases field names and hoists envelope lists — what a monolith's client typically does
by hand. The BFF branch returns the field as the BFF gives it. Where the monolith's function
returned something else, the parity gate shows the difference at that function, and the branch is
developer-owned code to edit.

## Boundaries

- ADR-127 §1 (what a BFF fronts), §3 as restated in §3 here, and §4 (verify reads BFF traffic)
  stand. ADR-127 §2 — the transport swap — is replaced by this.
- The BFF must be served in the composed environment; standalone, the monolith's backends must be.

## Consequences

Every ported MFE runs in both places from one build. Reads go through the platform's query
capability when composed. The cost is one rewritten line per data function in each copy of the
monolith's client, and a parity run is needed to confirm the BFF's shape matches the monolith's.

## References

- ADR-053 — the query capability. ADR-057 — the host attaches its control plane to each MFE.
- ADR-127 — what a ported MFE's BFF fronts, and how verify reads BFF traffic.
- ADR-126 — the port.
