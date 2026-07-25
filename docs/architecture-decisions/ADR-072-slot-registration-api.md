---
id: 0072
title: "The sanctioned slot registration API: `DeclaredSlot`, typed by the manifest"
status: Implemented
date: 2026-07-25
deciders: [sean]
area: Codegen / slots / app-code API / typing
enforcement: code
tags: [codegen, slots, app-code-api, typing]
relates-to: [36, 58, 66, 67, 69]
supersedes: []
superseded-by: []
implements-pdr: [5]
implemented-by:
  - packages/codegen/src/slot-types.ts
  - packages/framework-react/src/runtime/DeclaredSlot.tsx
  - packages/framework-angular/src/runtime/declared-slot.directive.ts
verified-by: []
long-form: true
---

## Context

ADR-067 established three layers — *data* generated into `src/slots.tsx`, *logic*
published once in `createSlotContract()`, *sugar* as a thin framework component —
and shipped `DeclaredSlot` as the React sugar. It did not say which layer app code
is supposed to call.

A review of the two provider MFEs in the example fleets found the answer, in
practice, is "none of them consistently":

1. **`DeclaredSlot` has zero app-code usages in the repository.** The generated
   component in every `slots.tsx`, plus the published
   `packages/framework-react/src/runtime/DeclaredSlot.tsx` and
   `packages/framework-angular/src/runtime/declared-slot.directive.ts`, appear only
   in their own unit tests and in codegen tests asserting they are emitted. Both
   real providers — `examples/meridian-station/meridian-console`'s `StationConsole`
   and `examples/abc-kids/home`'s `GameMenu` — hand-roll a `useCallback` ref
   callback around `slotContract.register(...)` instead.

   This is not a correctness hole: `register()` calls `assertDeclared()` internally,
   so an undeclared id still fails fast. It is an **adoption hole** — the platform
   generates an API that nothing uses, and every provider re-implements the same
   four lines slightly differently.

2. **Nothing links the manifest to app code at compile time.** `slots.tsx` exports
   `PROVIDED_SLOTS` as *data*, so app code re-types the ids as bare strings
   (`'main'`, `` `berth.${berthId}` ``). Renaming a slot in the manifest regenerates
   `slots.tsx` cleanly, leaves `tsc` green, and breaks only at runtime — exactly the
   silent-drift failure ADR-067 set out to eliminate on the *declaration* side.

3. **The DOM contract diverged three ways.** `StationConsole` hand-copies
   `data-declared-slot` onto its `main`/`status` regions but emits `data-berth` on
   the keyed berth regions; `GameMenu` emits neither. Only the unused `DeclaredSlot`
   is consistent — and an example's Playwright spec now depends on the bespoke
   `[data-berth]` attribute.

The hidden assumption that failed: *"publishing sugar is enough to make it the
API."* Sugar that is optional, untyped, and less capable than the primitive it
wraps will lose to the primitive every time.

## Decision

**`DeclaredSlot` (React) / `[smtDeclaredSlot]` (Angular) is the app-code API for
providing a slot, and the generated data layer types it from the manifest.**

### 1. One API, one escape hatch

- App code inside an MFE registers regions with the generated `DeclaredSlot`
  component or `[smtDeclaredSlot]` directive. This is the documented, supported,
  and example-demonstrated path.
- `slotContract.register()` remains public and remains the guard, but it is the
  **framework-adaptor escape hatch** — for a framework with no sugar yet, or a host
  integrating the contract directly. It is not the app-code idiom.
- Consequence for the DOM: `data-declared-slot="<local id>"` is emitted by the
  component, uniformly, for every provided region. Diagnostics and e2e selectors get
  one attribute to rely on instead of three conventions.

### 2. Slot ids are a generated type, not strings

The generated data layer emits a template-literal union alongside `PROVIDED_SLOTS`:

```ts
/** Declared slot ids. A manifest rename makes stale app code a compile error. */
export type DeclaredSlotId = 'main' | 'status' | `berth.${string}`;
```

- A literal declaration becomes a string-literal member.
- A declaration containing `{param}` segments becomes a template-literal type with
  `${string}` in each param position, so keyed slots type-check naturally:
  `` `berth.${berthId}` `` satisfies `` `berth.${string}` ``.
- The generated `DeclaredSlot`'s `id` prop and the Angular `@Input` are typed
  `DeclaredSlotId`. Renaming a slot in the manifest is therefore a **compile error at
  every use site**, not a runtime throw in production.

No new naming scheme is introduced — no `SLOT_MAIN` constants to collide or
bikeshed. The union *is* the constant set, and it composes with interpolation.

**The type is deliberately looser than the matcher.** `` `berth.${string}` `` also
admits `berth.a.b`, which `createSlotContract`'s matcher rejects because a `{param}`
segment matches exactly one segment (ADR-069's `SLOT_PARAM_VALUE_SOURCE` excludes
`.`). TypeScript cannot express "any string without a dot". `assertDeclared()`
remains the backstop for that residue; the type closes the case that actually bites
— renames and typos of the literal portion.

### 3. The sugar must be as capable as the primitive it replaces

The hand-rolled callbacks won partly because `DeclaredSlot` could not express what
the providers needed: `StationConsole` puts inline `style` on its regions, and
`GameMenu` uses semantic `<section aria-label>` / `<aside aria-label>`. The
component therefore accepts standard element props and an element override:

```ts
export interface DeclaredSlotProps extends React.HTMLAttributes<HTMLElement> {
  id: DeclaredSlotId;
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
  as?: keyof JSX.IntrinsicElements;   // defaults to 'div'
}
```

Angular needs no equivalent: `[smtDeclaredSlot]` is an attribute directive, so the
host element, its attributes, and its styles are already the author's.

### 4. Lock-step across the four copies

The registration component now exists in four places, by prior design and one
accident:

| Copy | Role |
| --- | --- |
| `packages/codegen/templates/base-mfe/slots.tsx.ejs` | generated, contract pre-bound |
| `packages/codegen/templates/base-mfe-angular/slots.ts.ejs` | generated, contract pre-bound |
| `packages/framework-react/src/runtime/DeclaredSlot.tsx` | published sugar, `contract` as a prop |
| `examples/abc-kids/scripts/generate-games.mjs` | **accidental** — the template inlined as a string literal |

The first three are deliberate (ADR-067: generated MFEs depend on the runtime
package, never on `framework-react`); the published copy keeps `id: string` and its
structural `contract` prop because it is not bound to any one manifest. The fourth
is duplication with no rationale and is removed — the example generator reads the
real template instead of carrying a copy.

## Boundaries

- **Host-owned slots are out of scope.** Shell-configured regions and the
  unqualified `root` / default `main` addresses are not declared in any MFE
  manifest and get no generated type.
- **This types the local id, not the address.** `DeclaredSlotId` covers what an MFE
  declares; the qualified `<mfe>/<local id>` placement address is composed
  host-side by `toProvidedSlotAddress` (ADR-068). Validating placement *targets* is
  ADR-073's subject.
- **Hand-written MFEs keep the ADR-067 trade-off.** An MFE that is not generated has
  no `slots.tsx` and therefore no `DeclaredSlotId`; for it the manifest section
  remains convention plus runtime reconciliation. The gate is still only as strong
  as codegen adoption.

## Consequences

- A slot rename is caught by `tsc` in every consuming MFE, so the manifest diff and
  the code that must change surface in the same review.
- The DOM contract is uniform: one `data-declared-slot` attribute, emitted by the
  component rather than copied by hand. The Meridian e2e spec moves from
  `[data-berth]` to `[data-declared-slot^="berth."]`.
- The four-way duplication becomes three, all deliberate and all covered by the
  ADR-065 generate-and-diff drift gate.
- Trade-off: `DeclaredSlot` always renders an element. A provider that wants to
  register an element it already renders for other reasons must either use `as` to
  make that element the slot, or fall back to `slotContract.register()` — which is
  precisely what the escape hatch is for.
