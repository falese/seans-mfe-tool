---
id: 0042
title: MFE Lifecycle State Machine
status: Accepted
date: 2026-05-28
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [runtime, lifecycle, state-machine, invariants]
summary: BaseMFE models its lifecycle as an explicit six-state machine (`uninitialized → loading → ready → rendering → error → destroyed`) with a static transition table. Every capability asserts its required entry state and transitions through validated edges; illegal transitions throw.
rationale-summary: A capability called in the wrong order (render before load, anything after destroy) is a programming error that should fail deterministically at the boundary, not corrupt MFE state silently. An explicit, inspectable state machine makes the lifecycle contract enforceable and debuggable.
long-form: true
---

# ADR-042: MFE Lifecycle State Machine

## Context

`BaseMFE` (ADR-041) exposes ten capabilities, several of which are only valid
in certain orders: you cannot `render()` before `load()` resolves, you cannot
do anything after `destroy`, and a failed `load()` should leave the MFE in a
recoverable state rather than half-initialized. Without an explicit model,
these ordering rules live implicitly in each `do*()` body and drift between
the React and Angular subclasses.

The shell/daemon drives these capabilities remotely and concurrently, so an
out-of-order call (a render arriving during a load, a refresh after an error)
must fail **deterministically at the boundary** with a clear message — not
produce a partially mounted component or a corrupt container.

## Decision

`BaseMFE` carries an explicit lifecycle state (`base-mfe.ts:162-183`) drawn
from six values:

```
uninitialized   initial state
loading         load in progress
ready           loaded, idle, ready to use
rendering        render in progress
error            a capability failed
destroyed        terminal — cannot recover
```

Transitions are governed by a static table, `VALID_TRANSITIONS`:

```
uninitialized → loading
loading       → ready | error
ready         → loading | rendering | destroyed
rendering     → ready | error
error         → loading | destroyed
destroyed     → (none)
```

Two protected primitives enforce the model:

- **`assertState(...expected)`** — a capability declares the states from
  which it may be entered and throws `Invalid state: expected … got …` if the
  current state is not among them (e.g. `render()` asserts `ready`,
  `base-mfe.ts:601`).
- **`transitionState(next)`** — validates the edge against
  `VALID_TRANSITIONS` (or a `deps.stateValidator` override) and throws
  `Invalid state transition: <from> → <to>` if the edge is not allowed,
  recording every move in `stateHistory` for debugging (`base-mfe.ts:259-286`).

The orchestrated capability bodies follow a fixed shape: assert entry state →
transition into the in-progress state → run lifecycle phases around the
`do*()` body → transition to `ready` on success, or run the `error` lifecycle
phase and transition to `error` on failure. `load()` (`:579-592`) and
`render()` (`:601-614`) are the canonical examples. Read-only capabilities
(`health`, `describe`) assert a broad set of non-`destroyed` states and do not
transition.

`destroyed` is terminal by design: it has no outgoing edges, so any capability
called after teardown fails the `assertState`/`transitionState` guard.

## Consequences

- Ordering bugs surface as deterministic, clearly-messaged throws at the call
  boundary instead of corrupt UI or container state.
- The state machine is identical for React and Angular MFEs because it lives
  in `BaseMFE`; subclasses inherit the invariants for free (ADR-041).
- `stateHistory` gives a replayable trace of every transition for debugging
  and telemetry.
- The model is extensible without breaking callers: `deps.stateValidator`
  lets a host substitute transition rules, and adding a state means adding a
  row to `VALID_TRANSITIONS` — but doing so is an architectural change that
  warrants amending this ADR.
- Re-entrancy (a capability invoked while already mid-phase) is a separate
  concern handled by the `_lifecycleStack` guard (ADR-001); the state machine
  governs *ordering across* capabilities, the re-entrancy guard governs
  *nesting within* one.

## Alternatives Considered

- **No explicit state; rely on `do*()` guards** — rejected. Ordering rules
  would be duplicated per capability and per subclass, with no single place to
  read or test the contract.
- **A full statechart library (XState)** — rejected for v1 as over-weight for
  six states and a fixed transition table. A plain `Record` table plus two
  assert/transition helpers is enough, keeps the runtime dependency-light, and
  stays legible (ADR-033). Revisit if hierarchical/parallel states appear.
- **Allow any transition, log warnings only** — rejected. Silent recovery from
  an illegal transition hides the real ordering bug and produces
  hard-to-reproduce UI corruption.

## Traceability

- ADR-041: BaseMFE Abstract Base Class (the capabilities these states gate)
- ADR-001: Lifecycle Re-Entrancy Guard (complementary nesting guard)
- ADR-002: Lifecycle Hook Execution Model (the phases run between transitions)
- REQ-056: State machine
- Files:
  - `src/runtime/base-mfe.ts` — `MFEState` type (`:167-173`),
    `VALID_TRANSITIONS` (`:176-183`), `assertState` (`:241-253`),
    `transitionState` (`:259-286`), per-capability guards (`:579-795`)
