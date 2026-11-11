---
id: 0127
title: >-
  A ported MFE reads only through its own BFF: the port reroutes the monolith's HTTP transport to
  GraphQL documents derived from the BFF's specs, each BFF fronts everything its MFE reads, and
  parity counts a domain re-loading data the monolith had already loaded as a repeat, not a failure
status: Implemented
date: 2026-11-11
deciders: [sean]
area: Decomposition / port / data
enforcement: tooling
tags: [decomposition, port, bff, graphql, mesh, parity, coupling]
relates-to: [12, 52, 84, 87, 112, 113, 126]
supersedes: []
superseded-by: []
implements-pdr: [11, 13]
implemented-by:
  - packages/decompose/src/bff-plan.ts
  - packages/decompose/src/derive.ts
  - src/decompose/port/shim.ts
  - src/decompose/port/source.ts
  - src/decompose/port/port.ts
  - src/decompose/verify/parity.ts
  - src/decompose/verify/io.ts
  - src/decompose/capture.ts
verified-by:
  - packages/decompose/src/__tests__/bff-plan.test.ts
  - src/decompose/port/__tests__/shim.test.ts
  - src/decompose/port/__tests__/port.test.ts
  - src/decompose/verify/__tests__/parity.test.ts
tracked-by: ["#410", "#418", "#419"]
summary: >-
  ADR-126 ports code unchanged, so each MFE kept calling the backends directly and shared one
  store at runtime. Now every MFE's BFF fronts everything its ported code reads — its own calls,
  reads across a coupling, and the calls of a repeated capability it renders — and the port
  replaces the monolith's HTTP transport (`axios.create(...)`, `fetch`) with a generated shim.
  The shim turns each REST call into a GraphQL document on the MFE's BFF, aliased back to the
  REST names, with hoisted lists put back. A call to data the MFE does not front returns that
  endpoint's empty body without touching the network. Verify lets a candidate's BFF traffic
  through, reads it as the backend calls it stands for, and reports a domain re-loading data the
  monolith had already loaded as a repeat.
rationale-summary: >-
  Rerouting the transport, not the call sites, keeps the client code reviewable and unchanged and
  works for any client built on one HTTP instance or on fetch. Deriving the documents from the
  same specs the BFF is generated from means they cannot disagree with the schema. Fronting what
  an MFE reads, rather than what its domain owns, is the proposal's own advice for couplings ("its
  BFF should source it itself") and leaves no MFE depending on another at runtime. The cost is
  that two domains may load the same data; that is the price of independence, so parity reports it
  instead of failing on it.
long-form: true
---

## Context

After ADR-126, meridian-monolith's ported fleet was at parity only after an agent edit made the
monolith's store one object on `window` shared by every MFE: runtime coupling between MFEs, and
every MFE calling the backends directly with its BFF generated and unused. The decision here is
that porting includes the data path.

Three facts shape it:

- The monolith's components read through one client module whose functions each call one
  endpoint on one HTTP instance (`axios.create`). The proposal records which file reads which
  endpoint, directly or through the store (`fileEndpoints`).
- Each MFE's BFF is GraphQL Mesh over OpenAPI documents (ADR-012, ADR-112): root fields are
  `operationId`s, field names are camel-cased, envelope lists are hoisted to their own field, and
  its demo mode answers from the captured responses (ADR-052).
- The shell domain owns no endpoints, yet its code reads telemetry (a coupling) and renders the
  berth tiles (a repeated capability kept local).

## Decision

### 1. A BFF fronts everything its MFE reads

`readsOf(domain)` = the domain's own endpoints, plus the endpoint of each coupling its files read,
plus the endpoints of any repeated capability its files render. Derivation (`deriveFleet`) uses
it for the MFE's `data.sources` and its specs and fixtures.

### 2. The transport is rerouted, the code above it is not

In each copied file, `axios.create(...)` becomes the shim's `bffHttp`, and `fetch(...)` becomes
`bffFetch(...)`. The shim matches the request to an operation of the MFE's BFF, runs that
operation's document through the generated connector (`src/platform/bff/bff.ts`), and returns the
REST body. The documents are derived from the specs (`bffOperations`): aliases restore REST names,
and a hoisted list is put back where the envelope had it.

### 3. Data an MFE does not front is empty, and costs no call

A copied store may load more than its MFE reads (the monolith's store loaded everything). For an
endpoint of the proposal that the MFE's BFF does not front, the shim returns that endpoint's body
with every list empty, and makes no request. Anything the MFE's components actually read is
fronted (§1), so an empty answer that shows on screen is a gap in the analysis, and parity
reports it as a content difference.

### 4. Verify reads BFF traffic as backend calls

- Replay lets through a request it has no recording for when it is a GraphQL `POST` to another
  origin: a BFF, which answers from its demo fixtures, the captured responses.
- Each such request counts as the backend calls its root fields stand for (`backendCallsOf`).
- For those calls, a call the baseline never made by that step is extra, and a call the baseline
  made at a step and the candidate does not is missing, as ADR-113 has it. A call to an endpoint
  the baseline had already called by that step is reported as **repeated**, not failed: a domain
  loading data it reads is the point of the decomposition. Calls a candidate makes directly keep
  ADR-113's exact rule.

## Boundaries

- Reads only. A write through the shim is refused with a typed error until mutations are inferred.
- A client built on something other than one HTTP instance or `fetch` (XHR, a generated SDK) is
  reported, not rerouted.
- Repeated placements stay rendered by their parent (ADR-126 §3); §1 is what keeps that from being
  a runtime coupling.

## Consequences

No MFE reads another's data or state at runtime; each is deployable and composable alone, with
its BFF in front of every call. Two domains may load the same data — parity names each repeat.
The shared store edit is no longer needed.

## References

- ADR-126 — the port this extends. ADR-113 — the parity gate §4 refines for BFF traffic.
- ADR-012 — the per-MFE GraphQL Mesh BFF. ADR-052 — its demo mode. ADR-112 — the specs it is
  generated from.
