---
id: 0109
title: >-
  A decomposition starts from an evidence bundle — what the running app did, keyed by region
  and interaction and joined to source — and every later stage reads only that bundle
status: Proposed
date: 2026-10-03
deciders: [sean]
area: Decomposition / capture
enforcement: tooling
tags: [decomposition, capture, evidence, playwright, network, react]
relates-to: [52, 84, 110, 112, 113]
supersedes: []
superseded-by: []
implements-pdr: [11]
implemented-by: []
verified-by: []
tracked-by: ["#410", "#413", "#414"]
summary: >-
  `decompose:capture` runs the monolith in headless Chromium, drives journeys, and writes an
  evidence bundle: DOM regions, network requests attributed to the region and interaction that
  caused them, navigation, console and page errors, recorded responses, and screenshots — with
  every region mapped to its React component and source file. `decompose:analyze` adds the
  source graph. Proposal, test generation and parity all read the bundle, never the live app,
  so a decomposition is reproducible from a directory on disk.
rationale-summary: >-
  Boundaries are only as good as the evidence behind them, and the strongest evidence —
  which backends a region calls — exists only at runtime. Capturing once into a stable,
  reviewable format lets every later stage, the scorer, and a human reviewer work from the
  same facts, and makes the capture the baseline the parity gate compares against.
long-form: true
---

## Context

PDR-011 makes decomposition evidence-driven. The `design:export` POC (#406) proved a
Playwright capture of DOM and computed styles works, but records only what is on screen,
not *why* — which backend fed it, which interaction produced it, which component drew it.
Data ownership is the clearest domain boundary, and it is visible only in traffic.

## Decision

### 1. One bundle, written once, read by everything downstream

A capture run writes a directory: a manifest of the run (app URL, build, journeys, seed),
then per-journey records. Proposal (ADR-110), OpenAPI inference (ADR-112), test generation
and the parity gate (ADR-113) read the bundle; none of them re-run the app to learn
behavior.

### 2. Every observation is keyed by region and interaction

Network requests, console errors and navigations carry the id of the interaction step that
caused them and the DOM region it targeted. A region is a captured element subtree;
regions are what domains are assembled from.

### 3. Regions are joined to source

In a development build, each region resolves to its React component and source file through
the fiber attached to its DOM node. `decompose:analyze` keys the source graph (routes,
imports, API call sites, co-change, ownership) by the same component/file ids, so runtime
and source evidence vote on the same units.

### 4. Responses are recorded for replay

Captured responses are stored in the shape the BFF mock switch serves (ADR-052), so the
same journeys can be replayed deterministically against the monolith and the composed app.

### 5. Journeys come from three sources, in this order

The monolith's own e2e specs re-run under instrumentation; agent-authored journeys from
the route table and forms; bounded automatic exploration of interactive elements.

## Boundaries

- Source mapping depends on React development-mode metadata; production builds yield
  regions without source ids, and the bundle records that rather than guessing.
- The bundle records observed behavior only. Behavior no journey exercised is absent, and
  the proposal must treat absence as unknown, not as unused.
- Sensitive data in recorded responses is the operator's responsibility; redaction rules
  are a follow-up, not part of this decision.

## Consequences

Captures become reviewable, diffable artifacts and the parity baseline. The cost is a new
on-disk format to version, and a dependency on running the app with seeded data.

## References

- PDR-011 — the product decision this serves.
- ADR-052 — BFF demo-mode mock switch; recorded responses use its format.
- ADR-084 — the manifest is the model's output; the bundle is the model's input.
- #406 — the `design:export` capture this extends; #409 its fidelity fixes.
- #413, #414 — `decompose:capture` and `decompose:analyze`.
