# ADR-066 — Stable slot addressing and desired-state placement

- **Status:** Proposed
- **Date:** 2026-07-11
- **Relates to:** ADR-055 (LayoutManager / daemon-driven shells), ADR-057 (virtualized daemon socket), ADR-058 (slot-provider MFEs), ADR-060 (contextualized VM composition)
- **Tracked in:** #265

## Context

The platform's composition thesis (PDR-005, ADR-055) splits responsibility
three ways: the **registry decides what** renders for whom, the **shell decides
where** (slots) and **how** (adaptors). That split only works if the registry
can name a *where* — a slot address — before or during a request, with no
knowledge of the client's rendered tree.

Two findings show the address contract is not yet strong enough for the target
property — *the backend can place an experience in any slot, always*:

1. **Ordinal addresses are measurements, not names.** Experiments with a
   declarative `<Slot />` component derived addresses from parent scope plus
   sibling ordinal (`root.some-layout.MFE_SCOPE.MainContent.2`). Ordinals
   describe render position, not business meaning: conditional rendering,
   per-user layouts (an advertised ADR-055 capability), lazy mounting, and
   ordinary JSX refactors all renumber siblings. An address the server must
   target a priori cannot be a function of what the client happens to have
   rendered this frame. (Same lesson as React keys vs. array indices.)

2. **Slot-provision timing silently destroys placements.** If an `EXPERIENCE`
   targets a slot id before the layout MFE provides it, `mountExperience()`
   auto-creates a host slot (`ensureSlot`) and mounts there. When the provider
   later registers the same id, `registerProvidedSlot()` clears that slot —
   unmounting the experience — and replaces the map entry with the provided
   element. The daemon's placement is destroyed, never remounted, and nothing
   is signalled upstream. Placement correctness currently depends on message
   ordering between the daemon and the layout MFE's mount.

The hidden requirement assumption that failed is: *"the rendered slot structure
is stable enough that position (or timing) can serve as identity."* This ADR
replaces that assumption with an explicit contract.

## Decision

**Placement is desired state addressed by assigned names; the frontend is a
registrar and reconciler of slots.** Five pillars:

### 1. Assigned identity — addresses are declared, never derived

A slot address is a slash-composed path of **declared slot ids**, reusing the
ADR-057 channel-path grammar (`main`, `main/quiz`). Ids are assigned by
whoever owns the region — host config, `provideSlot(slotId, …)` (ADR-058), or
declarative sugar such as `<Slot id="main-content" />`.

- Deriving any addressable segment from sibling position, render order, or
  mount timing is **banned from the contract**. Positional paths may survive
  as debug metadata (error messages, devtools) only.
- A slot rendered N times in a loop takes instance identity from a
  caller-supplied **domain key** (`<Slot id={`card.${item.sku}`} />`) — the
  React-keys rule. Keyless repetition is a developer error, not an
  auto-numbered fallback.
- Two slots resolving to the same address within one scope fail loudly at dev
  time. (ADR-058's last-writer-wins remains for *re*-provision by the same
  provider lifecycle — see pillar 4 — but two live declarations of one id in a
  single render is a bug, and silent disambiguation is the thing being
  removed.)

### 2. Desired-state placement — binding is deferred, so "any slot, always" holds

The registry/daemon's output is a **desired composition map**
`address → experience`. The LayoutManager holds this desired state
independently of what is currently bound:

- An experience targeting an address whose slot is not (yet) registered is
  **parked** and binds the instant the slot registers. Placement never fails
  for topology-timing reasons — it waits.
- **Parking is parking-by-placeholder**: the host creates a placeholder
  element for the unregistered address (appended to its container) and mounts
  the experience there immediately; when the provider registers, the
  placeholder is retired and the experience re-binds into the provided
  element (pillar 4). Content is live before the provider arrives, at the
  cost of one remount and pre-provision rendering in the host's default
  region — hosts that must not show parked content can hide it via the
  placeholder's `data-layout-slot` attribute.
- **An experience id occupies at most one address.** Re-placing an experience
  at a new address unplaces it from its old one: the desired entry is pruned
  and the old binding cleared, so a later re-provision of the old address can
  never resurrect a placement the registry has moved. This also bounds the
  desired map to the set of live placements.
- Replaying the composition map (reconnect, refresh) is **idempotent**: an
  experience already bound at its address is not remounted; convergence, not
  re-execution.
- **All lifecycle mutations of one address are serialized** on a per-address
  operation queue — bind, clear, provide, and release alike (generalizing
  ADR-068's provide/release serialization). Overlapping placements therefore
  cannot interleave at await points: a superseded mount is torn down by the
  queue, never leaked, and a failing teardown is reported and skipped so the
  replacement still binds.

This is the mechanism that makes the target property literally true: the
backend targets any address at any time; the client converges when the region
exists.

### 3. One registration primitive — frontend agnosticism by construction

Every frontend converges on `provideSlot(slotId, element)`:

- Host-configured slots, ADR-058 provider MFEs, a React `<Slot id>` component,
  an Angular directive, a `data-layout-slot` attribute in plain HTML — all are
  sugar over the same registration call into the same LayoutManager.
- Adding a framework adds sugar (a template variant / plugin, ADR-036
  posture), never new routing. The LayoutManager stays framework-free
  (ADR-055) and remains the single owner of the address space.

### 4. Re-bind, don't destroy

When a slot id is provided — or re-provided after its provider remounts — and
desired state exists for that address, the current or parked experience is
**remounted into the new element**. Provision is a change of *where the
address is bound*, never an implicit teardown of *what the registry placed
there*. The three orderings (experience-first, slot-first, re-provision) must
converge to the same DOM.

### 5. Topology upstream is advisory, never load-bearing

The client emits `SLOT_PROVIDED` / `SLOT_RELEASED` actions up the control
plane (the same path as `SLOT_ERROR`, ADR-060; ADR-057 channel stamping gives
attribution). The registry may use live topology for conditional rules,
dashboards, and debugging — but **correctness never depends on it**: rules
target addresses a priori, and pillar 2 absorbs any staleness.

## Boundaries

- **The registry contract cannot express an ordinal address.** The schema for
  placement targets accepts declared-id paths only.
- **Identity stays host-assigned** (ADR-057): an MFE cannot spoof another
  slot's address; nested providers compose paths under the id the host gave
  them.
- **Framework-neutral:** parking, reconciliation, and registration live in the
  framework-free runtime; `<Slot>`-style sugar lives in framework packages.

## Consequences

- Registry rules survive client refactors, personalization, and loading-order
  nondeterminism; layout remains a rules-engine concern (ADR-055) with a
  vocabulary that is now stable by construction.
- The provision race is closed: message ordering between daemon and layout
  MFEs no longer affects outcomes.
- Contract tests fall directly out of the experiment scenarios: address
  invariance under re-render / sibling insertion / reordering / conditional
  siblings / lazy mount; three-ordering convergence; idempotent replay;
  dev-time duplicate-id failure.
- Trade-off: the LayoutManager gains state (desired map + parked experiences)
  and a reconciliation loop, where today it is a straight event handler. This
  is the cost of decoupling placement from topology timing, and it is the same
  shape ADR-060 already introduced for slot-scoped healing.
