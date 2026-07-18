---
id: 0007
title: Reference apps model messy reality — overlapping APIs, clashing conventions, honest gaps
status: Accepted
date: 2026-07-18
deciders: [sean]
supersedes: []
superseded-by: []
tags: [examples, bff, reference-app]
summary: SMT reference apps must consume deliberately inconsistent, overlapping backend APIs, because the BFF value proposition is only demonstrable against realistic mess; one-clean-API-per-MFE is an anti-pattern for reference material.
---

# PDR-007: Reference apps model messy reality

## Problem space

A reference app built on one tidy API per MFE demonstrates nothing. Every layer of
SMT — manifest-driven BFFs, the namingConvention transform, envelope unwrapping,
typed graphs in front of teams you don't control — exists because real organizations
ship exactly the opposite of tidy: a fifteen-year-old port-authority system speaking
snake_case bare arrays, a fintech vendor wrapping everything in `{result, meta}`
cursor envelopes, an ERP that answers in `{Data, Pagination}` PascalCase, and the
same entity carrying three id formats across them (`docking_id: 4021` ↔
`dockingRef: "DCK-004021"` ↔ `DockingNo: 4021`). abc-kids' BFFs only ever talked to
a mock petstore spec, so the platform's central pitch had never been demonstrated —
or exercised. Phase 0 of the Meridian Station build proved the cost of that: no
generated API had ever booted off the happy path (#275), and the mongodb variant had
never once connected to a real MongoDB.

## Decision

Reference apps consume a small set of deliberately messy, **overlapping** backend
APIs — clashing naming conventions, clashing envelopes, clashing pagination, data
ownership split across systems by organizational accident (cargo manifest lines in
the harbormaster, their valuations in the finance ledger), and honest gaps (a line
finance hasn't valued yet renders "valuation pending", not a hidden row). MFEs
combine multiple APIs; APIs serve multiple MFEs; the per-MFE BFF is the layer that
tames the mess, visibly. The mess is authored once in the OpenAPI specs and
projected into every API's native dialect from a single seed source, so the
inconsistency is deliberate, reproducible, and readable in one file
(`examples/meridian-station/scripts/derive-seeds.mjs`).

## Why this over alternatives

- **One clean API per MFE** (the abc-kids petstore pattern): demos compose but the
  BFF layer is decorative — nothing is normalized because nothing disagrees. Every
  generator defect off the petstore path stays hidden.
- **Real third-party APIs**: realistic, but non-reproducible, rate-limited, and
  drifting — a reference app must boot identically on every machine forever.

## Consequences

- Reference material doubles as a test bed: Meridian's messy specs surfaced and
  fixed six API-generator defects (#275), the mongodb boot hang, the BFF endpoint
  derivation gap (#278), and the multi-instance composition trio (#277).
- Demo narratives get their "before and after" for free: the same berth queried
  three raw ways versus one normalized GraphQL query is the whole pitch in one
  screen (see `examples/meridian-station/README.md`).
- Seed data carries cross-system id consistency as a hard requirement — the
  projection script is the single place the dialects are defined.

## Linked decisions

ADR-012/046 (GraphQL Mesh BFF), ADR-052 (mock switch), PDR-001 (generate, don't
hand-write), PDR-005 (runtime composition). Issues #275/#276/#277/#278.
