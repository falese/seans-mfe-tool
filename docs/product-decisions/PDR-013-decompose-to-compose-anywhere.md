---
id: 0013
title: Decomposition extracts domain capabilities to compose anywhere; strangling a live monolith is an option, not the path
status: Accepted
date: 2026-11-11
deciders: [sean]
supersedes: []
superseded-by: []
tags: [decomposition, composition, migration, strategy, marketplace]
summary: A decomposed monolith's MFEs are composed directly — in a shell that reproduces the monolith, or in any other — once every domain is ported; parity is proved once, against the monolith's capture. Strangling the monolith one placement at a time (PDR-011 §5) stays available for a monolith that must keep running in production through the migration, and is no longer the default.
---

# PDR-013: Decomposition extracts domain capabilities to compose anywhere

## Problem space

PDR-011 §5 has the agent wrap the monolith as one MFE and strangle it one placement at a time.
That answers one situation: a monolith serving production that cannot have a cut-over day.

It is not the situation the platform exists for. The point of decomposing is to get **domain
capabilities as independently deployable units** that compose into any shell (PDR-005, PDR-006):
the monolith is the source they are cut from, not a system that has to keep running beside them.

Building the scaffold step (#417) made the cost of the strangle path concrete. The legacy wrapper
renders the whole app into one placement, so nothing smaller than the app can move until the
monolith can mount single regions under one shared tree (ADR-125). That is a second composition
mechanism, a frame step and per-step parity runs, all spent on a migration nobody asked for.

## Decision

The default path is **port, then compose**. Every domain is ported into its MFE; the proposal's
own composition is compiled and run; `decompose:verify` proves parity once against the
monolith's capture. The composed MFEs are then free to be placed in any other shell.

The legacy wrapper stays: it is the cheap proof that the fleet composes the monolith unchanged,
and the starting point for anyone who does need to strangle. Strangling (ADR-125) is deferred
until a live monolith needs it.

## Why this over alternatives

- **Strangle by default (PDR-011 §5).** Right for a production cut-over, wrong as the default:
  it adds a region-mounting mechanism and a step per placement to every decomposition, and buys
  only incremental cut-over.
- **Skip parity, since the MFEs will be composed elsewhere.** Loses the only proof the extracted
  capabilities still do what the monolith's did. A shell that reproduces the monolith's screens
  is cheap, and it is where the proof is made.

## Success signals

- meridian-monolith is ported and composed from `target.yaml`, at parity, with no legacy wrapper
  placed anywhere.
- One of its MFEs composes into a different shell (meridian-station's) with no change to it.

## Consequences / trade-offs

- A parity failure arrives all at once rather than one placement at a time. Each difference
  already names its component, so it stays traceable, but the first run of a large app will be
  long.
- Behaviour in a shell that does not reproduce the monolith is proved only by each MFE's own
  tests (#418), which now matter more than any strangler step would have.
- Amends PDR-011 §5; the rest of PDR-011 stands.
