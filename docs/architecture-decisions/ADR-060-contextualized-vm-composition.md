# ADR-060 — Contextualized VM composition: value-injection, slot-scoped self-healing, and control-plane re-resolution

- **Status:** Accepted
- **Date:** 2026-06-15
- **Relates to:** ADR-054 (control-plane protocol), ADR-055 (LayoutManager), ADR-056 (presentation boundary), ADR-057 (virtualized socket), ADR-058 (slot-provider MFEs), ADR-059 (BaseControlPlane), ADR-041 (BaseMFE capability contract), ADR-042 (lifecycle state machine), ADR-030 (error classification)
- **Supersedes (partial):** the *deferred React in-tree declarative provider* of ADR-056. The rest of ADR-056 (the thin waist, the imperative floor, the six layers, the boundary test) stands unchanged.

## Context

ADR-056 split the platform at a thin waist and deferred one item: a **React
in-tree declarative provider** that would compose a matching-framework MFE inside
the host's React tree so host context (intl/theme/router/auth), error boundaries,
and Suspense span the boundary. The motivation was real — host context must reach
the MFE — but the mechanism (a shared reconciler) carries a heavy price:

- **It un-seals the VM.** An in-tree MFE shares the host's React instance,
  dispatcher, and render pass. It is no longer an isolated island; within one
  reconciler there is integration, not isolation.
- **It forces a React singleton.** Host and every in-tree MFE must share one
  `react`/`react-dom` whose version satisfies all participants — killing
  **multi-version** coexistence and weakening **independent deployability**.
- **It makes the composition engine framework-specific**, or requires the neutral
  LayoutManager to own a React tree — breaking the ADR-055/056 neutrality
  invariant that lets one manager host React, Angular, and plain-HTML shells.
- **Fault isolation is *weaker*, not stronger**: an uncaught throw in a shared
  host reconciler tears down the whole host tree.

The design review (2026-06-15) separated the two things the deferred path bundled:

1. **Context reaching the MFE** — the actual win.
2. **Host error boundaries / Suspense spanning the boundary** — a narrower
   ergonomic that was the *reason* a shared reconciler seemed necessary.

Both can be had **without a shared reconciler**, off the lifecycle every MFE
already implements (ADR-041/042). That is this ADR.

## Decision

### 1. Context crosses the waist as DATA (value-injection), never as a shared tree

The host injects **provider values** — theme tokens, locale, auth claims, router
state, feature flags — across the waist as data. Each MFE island **re-provides its
own context** from those values inside its own root. This is ADR-056's own k8s
mapping made literal: *"configmap / values: session + props injection — data in,
never code reaching in."*

- `LayoutManagerConfig.providerValues` (and the `BaseControlPlane` config that
  feeds it) carries the host-injected bag.
- It is threaded to every mounted MFE as `props.hostContext` (alongside the
  ADR-057 channel and the ADR-058 `provideSlot`), via `AdaptorHelpers.providerValues`.
- The MFE re-establishes its framework context (`<IntlProvider>`, `<ThemeProvider>`,
  etc.) from `hostContext`. Same outcome — every MFE themed/localized/authed — with
  **zero shared reconciler, zero version coupling, full VM isolation**.

Consequence: the platform is **contextualized *and* polyglot *and* multi-version
React** at once. Those properties are normally in tension; value-injection is what
resolves it. Separate roots mean a React 17 island and a React 19 island coexist in
one shell, and the host may be React, Angular, or plain HTML.

### 2. Slot-scoped lifecycle resilience — Suspense + error boundaries, generically

Two error classes, both already isolated by the island model:

- **Lifecycle errors (awaited).** Every capability wraps `do*()` in try/catch,
  runs the MFE's own `error` phase (self-heal: retry/backoff/telemetry, ADR-030),
  then **re-throws** (`base-mfe.ts`). The rejection surfaces to whoever awaited the
  capability — the LayoutManager — which catches it.
- **Post-mount render errors (not awaited).** A throw inside the island's own
  render loop is caught by the island's **own** framework error boundary
  (`createErrorBoundary`, ADR-044) and **cannot cascade** to sibling slots — they
  are separate roots.

The new seam is **generic reporting**, not isolation (which the islands already
give). The LayoutManager gains:

- `AdaptorHelpers.reportError(error, { phase })` — the neutral sink an island's
  framework error boundary / `error` phase routes to **via the MFE's `emit`
  capability** (ADR-041). Framework-specific catching stays in layer 5
  (`RemoteMFE`/`AngularRemoteMFE`); the manager only sees neutral reports.
- **Slot-scoped fallback** — on an awaited rejection *or* a `reportError`, the
  manager tears down that slot's mount and renders a neutral fallback **into that
  slot only**. Never touches siblings or the host.
- **Generic pending/Suspense state** — slots are marked `data-slot-state`
  (`pending` → `ready` | `error`) from the load/render lifecycle promises, so host
  chrome can render skeletons without React Suspense. Per-slot granularity, which
  is the right granularity for composition.

This delivers React's error-boundary + Suspense semantics **uniformly across
React/Angular/HTML**, built on the lifecycle contract rather than a reconciler — and
with strictly better blast radius (worst case: one slot).

### 3. Control-plane re-resolution — the "bigger door"

When a slot's MFE fails unrecovered, the LayoutManager emits a `SLOT_ERROR` action
up the control plane (reusing the ADR-054 envelope; `RESOLUTION_ERROR` already
exists downward). Slot health becomes a **composition input**: the registry may
re-resolve that slot to an **alternate MFE**, per user/app. This makes the platform
self-healing at the **composition** layer, not just the component layer.

Bounded by an **escalation cap** per slot (default 3), reset on a successful mount,
so a persistently failing slot settles on its fallback instead of storming the
registry.

### 4. The native in-tree handle is not built

The `NativeComponentHandle` / `selectHandle` types remain in `@seans-mfe/contracts`
as a **latent optional** for a possible future narrow exception (a host that
genuinely needs cross-waist error boundaries on a single framework). They are **not
the platform's integration strategy** and carry no provider implementation.
Value-injection (pillar 1) is the strategy.

## Invariants (the bright line, unchanged)

- **The LayoutManager stays framework-neutral** — `reportError` and `providerValues`
  cross as callbacks/data; no UI framework enters the manager. The ADR-056
  `boundary.test.ts` set still passes.
- **Isolation is never removed.** The imperative island is the floor; everything
  here is additive to it.
- **Escalation is bounded.** Re-resolution cannot loop unboundedly.

## Consequences

**Positive.** Contextualized MFEs without un-sealing the VM; polyglot and
multi-version React preserved; self-healing at both the MFE and composition layers;
error/suspense UX generic across frameworks; blast radius is one slot; independent
deployability intact.

**Negative / residue (the deliberate trade).** No sub-MFE *streaming* Suspense and
no single host boundary wrapping multiple MFEs with shared context-object identity —
the two things that *require* a shared reconciler. They are traded away on purpose:
that trade is exactly what buys multi-version + isolation. Slot granularity and
data-injection cover the composition use cases.

## Implementation scope (this change)

Runtime + contract **plumbing only** (per the design session): the neutral
`LayoutManager` gains `providerValues` threading, `reportError`, slot fallback,
`data-slot-state`, and `SLOT_ERROR` escalation, with unit tests. Codegen template
changes (island error boundary → `emit` → `reportError`; reading `hostContext`) and
the ABC Kids migration are a **tracked follow-up**, not in this change.

## References

- ADR-056 (presentation boundary — this resolves its deferred follow-up),
  ADR-041/042 (lifecycle), ADR-030 (error classification), ADR-044 (island error
  boundary), ADR-054 (protocol / `RESOLUTION_ERROR`), ADR-057 (per-slot channel)
- PDR-002 (framework-neutral contract), PDR-005 (runtime composition),
  PDR-006 (ecosystem scaling thesis)
- `src/runtime/layout-manager.ts`, `src/runtime/__tests__/layout-manager.test.ts`
