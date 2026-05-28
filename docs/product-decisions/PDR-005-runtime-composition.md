---
id: 0005
title: Runtime composition via shell + daemon control plane + registry
status: Proposed
date: 2026-05-21
deciders: [sean]
supersedes: []
superseded-by: []
tags: [runtime, orchestration, shell, daemon, registry]
summary: Scaling to many MFEs requires runtime orchestration, not just per-MFE scaffolding; the tool generates the shell plus a daemon control plane and an MFE registry so MFEs are discovered, resolved, and rendered through one control plane rather than wired by hand.
---

# PDR-005: Runtime composition via shell + daemon control plane + registry

## Problem space

PDR-001 through PDR-004 make individual MFEs cheap, consistent, and stack-neutral. But a
collection of well-formed MFEs is not an application. Something has to **compose** them
at runtime: decide which MFE handles a given state, gate access, render it into the
host, and relay user actions back. When that composition is hand-written — as it was for
the first real shell — three problems appear as the count of MFEs grows:

- **The shell becomes the bottleneck.** Every new remote means hand-editing the host's
  federation config, type declarations, and wiring. Type declarations drift from the
  remotes they describe.
- **Orchestration logic is bespoke per app.** "Which MFE should render for this state?"
  gets reimplemented in each shell, inconsistently, with no shared notion of a control
  plane.
- **There is no runtime source of truth** for what MFEs exist, what they expose, and
  whether they are healthy — the registry-shaped hole that the contract's `describe` /
  `health` / `schema` capabilities were designed to fill but nothing consumed.

The pain is felt by whoever owns the host application, and it grows with the size of the
ecosystem — which is exactly the direction PDR-006 wants to go.

## Decision

The tool **generates the composition layer**, not just the MFEs. `shell:init` scaffolds
the host plus an orchestration tier: a **daemon** (control plane that routes state
changes and calls MFEs), an **MFE registry** (rules engine that resolves a state change
to `{ mfe, capability, props }`), and the shell-side orchestrator/renderer that mounts
resolved MFEs through the contract's `render()`. MFEs are **discovered, resolved, and
rendered through this control plane** rather than hand-wired into the host. The control
plane talks to MFEs only through the 10-capability contract (PDR-002), so any
contract-compliant MFE — any framework, any language — is composable without host
changes.

## Why this over alternatives

- **Hand-written shell per app (status quo, rejected).** Works for a handful of MFEs;
  collapses under drift and per-app orchestration logic as the count grows.
- **Build-time-only composition (rejected).** Federating remotes purely at build time
  cannot express "which MFE handles this state at runtime," cannot gate access
  dynamically, and cannot react to MFEs that push new domain state
  (`updateControlPlaneState`). A runtime control plane is required for a living
  ecosystem.

## Success signals

- `shell:init` produces a working shell + daemon + registry that mounts generated MFEs
  with no hand-wiring of federation or orchestration.
- Adding an MFE to a running ecosystem is a registry registration, not a shell edit.
- React and Angular MFEs (PDR-002) compose in the same shell through the same control
  plane, with no framework-specific orchestration code.

## Consequences / trade-offs

- **Positive:** The host stops being the integration bottleneck; orchestration is shared
  and generated, not bespoke per app. The registry becomes the runtime source of truth
  the contract capabilities were designed for.
- **Positive:** This is the runtime that turns "many MFEs" into "an ecosystem" — the
  load-bearing piece of PDR-006.
- **Negative:** A control plane is a new operational surface (the daemon is a
  long-running process with its own deployment and failure modes), which is part of why
  the daemon ships as an independently deployable plugin (PDR-004).
- **Negative:** Generating orchestration services widens the generator's blast radius
  and introduces new architectural decisions (control-plane tiers, transport protocol,
  how a resolution names a component) — to be recorded as ADRs when PR #153 lands.
- **Status:** Proposed — landing through PR #153 (still draft). PR #153's original ADR
  numbers (068–071) were invalidated by the ADR library remediation (PR #194), which
  reflowed the whole set into sequential 001–040; fresh numbers will be assigned from
  the next free slot at merge time. Promote this PDR to Accepted then.

## Implemented by

- Pending PR: PR #153 (`src/commands/shell/init.ts`,
  `src/codegen/templates/shell/orchestration/{daemon,registry}/`,
  `src/codegen/templates/shell/src/shell/{MFEOrchestrator,MFERenderer,DaemonBridge}`),
  draft as of 2026-05-28.
- ADRs: to be added on PR #153 merge — `shell:init` command, daemon control plane
  tiers, daemon transport protocol, component / MFE remote naming. See the ADR register
  for the renumbering note.
- Contract: `PLATFORM-CONTRACT.md` (daemon ↔ registry ↔ MFE flow, message protocol).
- Related: PDR-002 (the contract the control plane speaks), PDR-006 (the ecosystem this
  composes).
