---
id: 0105
title: >-
  Retire BaseControlPlane — the control plane has one implementation, so a host connects with a
  LayoutManager instead of subclassing an abstract base
status: Implemented
date: 2026-09-25
deciders: [sean]
area: Runtime / control-plane / abstract-base
enforcement: code
tags: [runtime, control-plane, abstract-base, dead-code]
relates-to: [57, 59, 78]
supersedes: [59]
superseded-by: []
implements-pdr: [8]
implemented-by:
  - packages/runtime/src/layout-manager.ts
  - packages/control-plane/README.md
  - packages/codegen/src/platform-migrations.ts
verified-by:
  - packages/codegen/src/__tests__/platform-migrations.test.ts
tracked-by: ["#385"]
summary: >-
  BaseControlPlane, isBaseControlPlane and the ControlPlaneConfig / ControlPlaneStatus /
  ControlPlaneHealth types are removed from the runtime and its public barrel. A host connects to
  the control plane by constructing a LayoutManager over a GraphQLTransportWsDaemonTransport, which
  is what BaseControlPlane.start() did internally. The registry and daemon are the
  packages/control-plane services (ADR-078), the only implementation. Any developer-owned use is
  reported by the base-control-plane-removed platform migration (ADR-082).
rationale-summary: >-
  ADR-059 introduced the class so that independent Node and Rust control planes in other
  repositories could be swapped behind one contract. PDR-008 and ADR-078 then brought the control
  plane into this repository as a single implementation, and nothing ever subclassed the class.
  The only subclass was a test double. packages/control-plane is plain JavaScript services, not a
  subclass. An abstract base with one implementation and no subclass is a claim the code does not
  make true, so it is removed rather than kept waiting for a second implementation.
long-form: true
---

## Context

ADR-059 (2026-06-14) made the control plane the fourth "abstract base owns the
shape, concrete owns the how" hierarchy, beside `BaseMFE`, `BaseCommand` and
`BaseFrameworkPlugin`. Its premise was plurality: a Node daemon then living in
`Falese/daemon` and a Rust daemon, "independent implementations of the same
concept" that a host should be able to swap.

That premise stopped holding. PDR-008 and ADR-078 made the control plane part of
the platform. `@falese/daemon` was retired, and `packages/control-plane` became
the one registry and daemon that both reference fleets build from. ADR-078 then
described that package as the concrete implementation of ADR-059's shape, but
it never became one. The package is plain JavaScript services behind a
WebSocket. It does not extend, import or depend on `BaseControlPlane`.

A dead-code scan (#385) found the result. `BaseControlPlane` sat on the public
runtime barrel, and its comment said concrete implementations "live in their
respective repos". Its only subclass anywhere was a test double in its own
conformance test. No host in this repository or its examples constructs a
control plane. Every host constructs a `LayoutManager`.

## Decision

**The control plane has no abstract base. There is one implementation, and a
host connects to it with a `LayoutManager`.**

### 1. Removed

`BaseControlPlane`, `isBaseControlPlane`, `ControlPlaneConfig`,
`ControlPlaneStatus` and `ControlPlaneHealth` are deleted from
`@seans-mfe-tool/runtime`, along with the class's conformance test.

### 2. What a host does instead

```typescript
const layout = new LayoutManager({
  container,
  session,
  transport: new GraphQLTransportWsDaemonTransport(daemonUrl, createSocket),
});
layout.start();
await layout.stop();
```

This is what `BaseControlPlane.start()` did after its abstract `doStart()`. The
`doStart`/`doStop` half, spawning or connecting to a daemon, belongs to the
deployment (the `packages/control-plane` images), not to browser code.

### 3. Migration

Removing a barrel export can break developer-owned code, so the removal carries
a `base-control-plane-removed` entry in `PLATFORM_MIGRATIONS` (ADR-082). The
entry names the use and gives this replacement.

## Boundaries

- The control plane's **wire contract** is unchanged: ADR-054's messages,
  ADR-057's per-slot `DaemonChannel` and the `DaemonTransport` interface. A second
  control plane is still possible. It must speak that protocol. It does not
  need to subclass anything.
- The "abstract base owns the shape" pattern is not retracted. It applies where
  there is more than one concrete implementation. The control plane is not such
  a place today.

## Consequences

- The runtime's public surface loses a class whose documentation described
  implementations that do not exist.
- If a second control-plane implementation appears, a shared host-side contract
  may be worth reintroducing. It should be drawn from the two real
  implementations, not written ahead of them. The cost of that is accepted.

## References

- ADR-059 — `BaseControlPlane`, the abstract base this retires.
- ADR-078 — the control plane in the platform, the single implementation.
- ADR-057 — the virtualized daemon socket, which a host still gets through `LayoutManager`.
- ADR-082 — platform migrations, which report developer-owned uses.
- #385 — the dead-code finding.
