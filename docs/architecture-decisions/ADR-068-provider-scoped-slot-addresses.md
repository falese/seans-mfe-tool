# ADR-068 — Provider-scoped slot addresses

- **Status:** Accepted
- **Date:** 2026-07-11
- **Relates to:** ADR-057 (host-assigned paths), ADR-058 (slot-provider MFEs), ADR-066 (stable addressing), ADR-067 (manifest-declared slots)
- **Supersedes:** ADR-058's flat provided-slot namespace and cross-provider last-writer-wins collision rule
- **Tracked in:** #265

## Context

ADR-058 used one flat slot map keyed only by a provider's local declaration
(`main`, `info`). Two different MFEs could therefore register the same local
id. The later registration replaced the earlier one, and a stale provider
teardown could delete the replacement because lifecycle ownership was not part
of the stored state.

Local declarations must stay reusable: `main` is a sensible contract inside
many MFEs. The host address, however, must identify which MFE owns that local
name.

## Decision

**An MFE-provided slot address is the stable provider MFE id plus its declared
local slot id: `<provider-mfe-id>/<declared-slot-id>`.**

- The MFE still declares and registers only its local id, for example `main`.
- The LayoutManager takes the provider id from `RenderedExperience.mfe` and
  composes `abc-kids-home/main`. The MFE cannot choose or spoof the prefix.
- Registry placement targets use the full address in `props.slot`. Host-owned
  slots such as `root` remain unqualified.
- The desired-composition map, active-slot map, `DaemonChannel`, DOM
  diagnostics, and topology signals all use the same full address.
- Each provided slot also stores its provider's `RenderedExperience.id` as an
  internal owner token. A stale provider instance may release only entries it
  still owns, so it cannot remove a newer registration at the same address.
- Ref-based registration forwards `null` on region unmount. The host releases
  the address only when the callback's owner token still matches, retains
  desired placement, and re-binds if the region returns.
- Provide/release callbacks are serialized per qualified address — as is
  every other lifecycle mutation of that address: registry-driven binds and
  clears ride the same per-address queue (ADR-066). Async teardown therefore
  cannot let an older overlapping registration finish after and replace the
  most recently requested provider, and an overlapping bind cannot leak a
  superseded mount.

The stable MFE id is deliberately separate from the owner token. Registry rules
can validate and target an MFE id before runtime; an experience id is ephemeral
and cannot be a durable address.

## Consequences

- Different MFEs may both declare `main` without collision:
  `catalog-layout/main` and `checkout-layout/main` coexist.
- Registry routes that target MFE-provided slots must migrate from local names
  such as `main` to full addresses such as `abc-kids-home/main`.
- Re-provision by a newer instance of the same MFE keeps one stable address,
  while stale teardown is harmless.
- Two simultaneous instances of the same MFE still share one address. If that
  use case is required, the registry must supply a stable declared instance key;
  an ephemeral experience id must not be added to the public contract.
