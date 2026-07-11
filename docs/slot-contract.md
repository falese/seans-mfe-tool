# The Slot Contract — how the backend places MFEs in any slot, always

*One unified, controlled system: the manifest declares slot names, code is
generated from the declaration, the runtime converges on the registry's
intent, and the registry validates against the same declaration. This
document explains the whole chain in plain language.*

Governing decisions: ADR-066 (addressing + binding), ADR-067 (manifest
contract). Tracked in #265.

## The whole model in one sentence

> **The registry says what goes at each named address; the frontend registers
> named regions and keeps making the registry's intent true.**

Everything below is a consequence of that sentence.

## Why not positions?

The tempting design is to let slots number themselves from their position in
the rendered tree (`parent.1`, `parent.2`, …). It fails, always, for one
reason with many faces: **the backend must target an address before the
client renders, but a position doesn't exist until after.** Conditional
rendering, feature flags, sorted lists, lazy loading, tabs that unmount, a
refactor that adds a wrapper div — each one renumbers positions, and every
registry rule silently points at the wrong region. A position is a
*measurement* of the client. An address in a server contract must be a
*name* someone assigned.

So in SMT, slot ids are names, written by people, with business meaning:
`main`, `info`, `card.{sku}`. Numbers can't even enter the contract — the
manifest schema rejects a purely numeric segment at parse time.

## The chain, end to end

**1. Declare (design time).** The MFE's manifest lists the slots it provides:

```yaml
# mfe-manifest.yaml
providesSlots:
  - id: main
    description: Primary content region
  - id: info
    description: Contextual info panel
  - id: card.{sku}
    description: One card per product — the SKU is the identity
```

`{sku}` is a *keyed pattern*: a slot rendered once per item takes its
identity from the item's own key, never from its position in the list.
Sorting and filtering change order; they don't change identity.

**2. Generate.** Codegen turns the declaration into `src/slots.tsx`:
`PROVIDED_SLOTS` (the manifest mirrored into code) and a `DeclaredSlot`
component. The file is always regenerated — it is contract, not scaffold —
so the code can never claim a slot the manifest doesn't declare:

```tsx
<DeclaredSlot id="main" provideSlot={provideSlot}>
  <WelcomePane />
</DeclaredSlot>
```

`DeclaredSlot` registers its element with the host on mount and **throws on
an undeclared id** — "declare it in the manifest first" is enforced by the
generated code, not by code review.

**3. Register (runtime).** Registration rides `provideSlot`, the callback the
host hands every mounted MFE (ADR-058). The host's LayoutManager owns one
flat namespace of named slots per shell — it is not React context, so
multiple roots, portals, and mixed frameworks all land in the same registry.

**4. Place.** The registry resolves *what* renders for whom and emits
experiences addressed to slot names (`props.slot: 'main'`). The LayoutManager
treats each placement as **desired state**: what should be at this address,
independent of what's currently mounted.

**5. Converge.** Binding is reconciled, not assumed:

- Placement arrives **before** the slot exists → it binds the moment the slot
  registers. Nothing is lost to timing.
- The slot **remounts** (tab switch, provider replaced, StrictMode) → the
  same placement re-binds into the new element.
- The same placement is **replayed** (reconnect, refresh) → no-op; already
  true.
- The slot's content **crashes** → scoped fallback in that region only, and
  the registry is asked to re-resolve (ADR-060).

**6. Observe.** The client announces `SLOT_PROVIDED` / `SLOT_RELEASED` up the
control plane. These signals are *advisory* — useful for topology-aware
rules, dashboards, and drift detection — but correctness never depends on
them: rules target names a priori, and convergence absorbs timing.

## What happens when a dev renames a slot?

Renaming `main-content` → `primary` is a **breaking change to a published
contract**, exactly like renaming a REST endpoint — no naming scheme makes it
safe. What this system changes is that a rename is *loud and traceable*
instead of silent:

- The rename is a **manifest diff** — visible in review, taggable as a
  breaking change, checkable in CI against live registry rules.
- At runtime, an old rule targeting `main-content` renders into a visible
  placeholder region (never into the *wrong* region), while `primary` sits
  empty — a diagnosable state, and the wire shows the mismatch: placements
  addressed to a name no `SLOT_PROVIDED` signal announced.
- Transition options, best first: don't rename (ids are contract); alias both
  ids to one element during a migration window; or update registry rules in
  the same release.

Compare positions: the equivalent event (renumbering) fills the **wrong
region silently** and nothing anywhere can detect it. Wrong-but-observable
versus wrong-but-invisible is the entire argument.

## What rule authors can know, and when

| When | What's available | Source |
| --- | --- | --- |
| Design time | Every slot id an MFE can provide, with descriptions; keyed patterns validate target *shape* | `providesSlots` in the manifest, served by `describe()` / discovery |
| Config time | "Does any installed MFE declare this target?" — typos and renames rejected at rule-save | Union of registered manifests |
| Runtime | Which slots this session actually has right now; drift between declared and provided | `SLOT_PROVIDED` / `SLOT_RELEASED` signals |

Design time answers *may this address exist*; runtime answers *does it exist
right now*; convergence makes the gap between them safe.

## Where everything lives

| Piece | Path |
| --- | --- |
| Manifest schema (`providesSlots`, id grammar) | `packages/dsl/src/schema.ts` |
| Generated slot contract template | `packages/codegen/templates/base-mfe/slots.tsx.ejs` |
| Generator wiring | `packages/codegen/src/unified-generator.ts` |
| Desired-state binding, topology signals | `packages/runtime/src/layout-manager.ts` |
| `provideSlot` render-prop plumbing | `packages/runtime/src/layout-adaptors.ts` |
| Behavior tests (ordering, re-bind, replay, signals) | `packages/runtime/src/__tests__/layout-desired-state.test.ts` |
| Contract tests (schema grammar, codegen output) | `packages/dsl/src/__tests__/schema.slots.test.ts`, `packages/codegen/src/__tests__/provided-slots.test.ts` |
| Decisions | ADR-066, ADR-067 (and ADR-055/057/058/060 they build on) |

## The rules, if you remember nothing else

1. Slot ids are **names people assign**, never positions the tree produces.
2. A repeated slot takes its identity from **the data that repeats it**.
3. The **manifest declares** every id; generated code can't register anything
   else; the registry validates against the same declaration.
4. Placement is **desired state**; the client converges, so ordering and
   remounts can't lose it.
5. A rename is a **contract change** — make it in the manifest, on purpose,
   with a migration plan.
