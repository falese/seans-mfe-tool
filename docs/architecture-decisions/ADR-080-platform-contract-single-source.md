---
id: 0080
title: The ten platform capabilities and the MFE lifecycle machine are defined once, in `@seans-mfe/contracts`
status: Implemented
date: 2026-07-26
deciders: [sean]
area: Contracts / DSL / runtime / codegen
enforcement: code
tags: [contracts, dsl, runtime, codegen, drift]
relates-to: [36, 41, 42, 54, 56, 61, 64, 69, 73]
supersedes: []
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/contracts/src/platform-contract.ts
  - packages/runtime/src/base-mfe.ts
  - packages/runtime/src/base-remote-mfe.ts
  - packages/dsl/src/schema.ts
  - packages/codegen/src/unified-generator.ts
verified-by:
  - packages/contracts/src/__tests__/platform-contract.test.ts
  - packages/runtime/src/__tests__/platform-contract-pin.test.ts
  - packages/codegen/src/__tests__/platform-contract-pin.test.ts
summary: >-
  The ten platform capabilities and the six-state MFE lifecycle machine become one
  zero-dependency definition in `@seans-mfe/contracts` — capability names, both manifest
  spellings, `do*()` wrapper methods, result types, HTTP surface, and each capability's
  pre-states and enter/exit/error transitions. The DSL, the runtime, codegen, and the EJS
  templates read that definition instead of re-declaring it, so the platform contract can no
  longer disagree with itself about what an MFE is.
rationale-summary: >-
  The set had already split: `updateControlPlaneState` shipped in the runtime but was absent
  from the DSL's `PLATFORM_CAPABILITIES`, from codegen's capability map, and from two of the
  four inline template arrays — so a manifest declaring it generated as a domain capability,
  importing a type that does not exist. ADR-069 settled the dependency direction for exactly
  this problem; this applies it to the contract's other two halves rather than inventing a
  new mechanism.
long-form: true
---

# ADR-080: The platform contract is defined once, in `@seans-mfe/contracts`

## Context

Two things define what it means to be an MFE on this platform: the ten platform
capabilities every MFE exposes (ADR-041) and the six-state lifecycle machine
they move through (ADR-042). `docs/PLATFORM-CONTRACT.md` states both in prose.

Neither had a definition in code. Both were re-declared at every site that
needed them:

| Site | What it declared | Count |
| --- | --- | --- |
| `packages/dsl/src/schema.ts` `PLATFORM_CAPABILITIES` | capability names | **9** |
| `packages/dsl/src/schema.ts` `PLATFORM_WRAPPER_METHODS` | `do*()` methods | **9** |
| `packages/runtime/src/base-mfe.ts` `CAPABILITY_DESCRIPTORS` | names + state rules | 10 |
| `packages/runtime/src/base-remote-mfe.ts` `PLATFORM_CAPABILITY_NAMES` | names, both spellings | 10 |
| `packages/runtime/src/context.ts` `capability` | names, as a union | 10 |
| `packages/codegen/src/unified-generator.ts` `platformCapabilities` | names + result types | **9** |
| `templates/base-mfe/mfe.ts.ejs` `baseCapabilityNames` | names | 10 |
| `templates/base-mfe/mfe.test.ts.ejs` (inline) | names | **9** |
| `templates/base-mfe-angular/mfe.ts.ejs` `baseCapabilityNames` | names | 10 |
| `templates/base-mfe-angular/mfe.test.ts.ejs` (inline) | names | **9** |

Five of ten sites were a capability short. `updateControlPlaneState` was added
to the runtime and to the two `mfe.ts.ejs` templates and never to the rest.

That is not a cosmetic split. Codegen classifies a manifest capability as
*platform* by looking it up in its own map; a miss means *domain*. So a
manifest declaring `UpdateControlPlaneState` — a capability the platform
contract requires and the runtime implements — generated a feature stub for
it, a smoke test calling it as user code, and an `import type
{ UpdateControlPlaneStateOutputs }` that no emitted file defines. The MFE did
not compile, and the reason was a nine-entry object literal three packages
away from the error.

The lifecycle machine had the milder version of the same problem: `MFEState`,
`VALID_TRANSITIONS`, and the per-capability state rules in
`CAPABILITY_DESCRIPTORS` lived only in `base-mfe.ts`, so nothing outside the
runtime could reason about states without hardcoding them — and the runtime's
own state rules and the capability list they key off were two unrelated
literals in one file.

ADR-069 already faced this exact shape for the slot-id grammar and settled the
dependency direction: the shared definition goes in `@seans-mfe/contracts`,
the one package the DSL, the runtime, and codegen can all reach without
pulling each other in. ADR-073 applied it again for slot-contract logic. This
ADR applies it to the platform contract itself.

## Decision

### 1. One module owns both definitions

`packages/contracts/src/platform-contract.ts` is the single source for:

- `MFE_LIFECYCLE_STATES` and `MfeLifecycleState` — the six states;
- `MFE_LIFECYCLE_TRANSITIONS` — the legal edges (ADR-042's table);
- `MFE_LIFECYCLE_INITIAL_STATE` / `MFE_LIFECYCLE_TERMINAL_STATE`;
- `PLATFORM_CAPABILITIES` and `PlatformCapability` — the ten names, ordered as
  in `docs/PLATFORM-CONTRACT.md`;
- `PLATFORM_CAPABILITY_SPECS` — per capability: the PascalCase manifest key,
  the `do*()` wrapper method, the result type name, the HTTP method and
  endpoint, and its lifecycle interaction (`preStates`, `enterState`,
  `exitState`, `errorState`);
- derived views `PLATFORM_WRAPPER_METHODS` and
  `PLATFORM_CAPABILITY_MANIFEST_KEYS`, and the predicates
  `isMfeLifecycleState`, `isValidLifecycleTransition`, `isPlatformCapability`,
  `isPlatformCapabilityManifestKey`.

Everything is `Object.freeze`d. A consumer that mutated the shared contract
would corrupt every other consumer in-process.

### 2. It stays pure data plus predicates

The module imports nothing. `@seans-mfe/contracts` is zero-dependency by
invariant (ADR-061) — that is precisely what lets the DSL (zod), the runtime
(staged into generated MFEs), and codegen (a build-time package) all depend on
it. Behavior stays with the consumers: `BaseMFE` still orchestrates, the DSL
still validates with zod, codegen still renders.

### 3. Every definition site consumes it

No package re-declares either set. The runtime's `MFEState` and
`VALID_TRANSITIONS` remain exported under those names — generated MFEs import
them — but as aliases of the canonical type and table, not copies.

### 4. Templates receive the list; they never re-list it

EJS cannot import, so `extractManifestVars` puts `platformCapabilityNames` in
the render model and the four templates filter against it. A template
containing a capability-name array is a defect.

### 5. Drift fails a test, not a build downstream

Each consuming package carries a `platform-contract-pin.test.ts` holding its
*observable behavior* to the contract — the runtime's guards and transitions,
codegen's platform-vs-domain classification — rather than asserting that two
literals happen to be equal.

## Boundaries

- **This defines the contract, not the wire protocol.** The HTTP method and
  endpoint in each spec are contract facts recorded for the daemon and for
  polyglot implementors. Nothing in this repo currently routes from them;
  they are documentation with a type, and a server that ignored them would not
  fail any gate here.
- **Domain capabilities are unaffected.** The definition says only what is
  *platform*; everything else in a manifest is domain, as before.
- **Other languages are out of scope.** `docs/PLATFORM-CONTRACT.md` states the
  same contract for Python, Go, and Rust. A TypeScript module cannot
  single-source those, and the `examples/polyglot-stubs/` trees the doc cites
  do not currently exist in the repo.
- **`demo.html.ejs` keeps its state names.** They are CSS badge classes
  (`.badge.loading`), presentational rather than contractual, and templating
  them would trade a real stylesheet for a generated one.
- **Committed example MFEs are untouched.** The capability arrays lived inside
  EJS scriptlets, so replacing them changes no generated byte. Template
  *comments* are not free, though: a standalone EJS comment block emits its
  trailing newline, which drifted all 21 committed `mfe.test.ts` files on the
  first attempt. Explanatory comments go inside the scriptlet, and
  `npm run check:mfe-drift` is the gate that proves it — it is not implied by
  `check:mfe-consistency`, which checks manifests rather than generated bytes.

## Consequences

**Better.** Adding a capability is one edit in one file: the DSL forbids its
wrapper method, codegen classifies it, both templates skip it, and the runtime
guard table gains it. The `updateControlPlaneState` misgeneration is fixed as
a side effect of removing the place it could hide. The state machine becomes
readable by anything that depends on contracts, without depending on the
runtime.

**Not a cost: where it lives.** `@seans-mfe/contracts` is the platform spec
package and has been since ADR-054 made it "the single source of truth for the
control-plane wire protocol" — alongside the presentation boundary (ADR-056),
the framework-plugin base (ADR-036), and the slot contract (ADR-069, ADR-073).
The platform's own capability set and lifecycle machine are the most
contract-shaped thing in the repo; they belong here by design, not by
encroachment. This ADR adds nothing to the package's remit that ADR-054 had not
already established.

**Worse.** Consumers gain a real coupling: changing `PLATFORM_CAPABILITY_SPECS`
changes DSL validation, codegen output, and runtime guards at once. That is the
point, but it makes the blast radius of an edit larger than it was when each
site was independently wrong — a mistake here is now uniform instead of
partial, and the pin tests are what stand between a typo and every generated
MFE.

**The cost accepted.** The specs encode facts — HTTP endpoints — that no gate
in this repo verifies. That is deliberate: leaving them out would keep the
definition provably minimal but would leave `docs/PLATFORM-CONTRACT.md` as the
only place the daemon's call surface is written down, which is the situation
this ADR exists to end. They are typed, tested for internal consistency, and
honestly scoped in **Boundaries** above.

## References

- ADR-041 — defines the ten-capability `BaseMFE` contract this single-sources.
- ADR-042 — defines the six-state machine and its transition table; the table
  moves here unchanged.
- ADR-061 — makes `@seans-mfe/dsl` and `@seans-mfe/codegen` first-class
  packages, and holds `@seans-mfe/contracts` to zero dependencies so all three
  can depend on it.
- ADR-069 — settled the same dependency direction for the slot-id grammar;
  this reuses that decision rather than re-deriving one.
- ADR-073 — the second application of ADR-069's pattern, for slot-contract
  logic.
- ADR-054 — established the control-plane message protocol as a shared contract
  in `@seans-mfe/contracts`; the package's remit as platform spec starts there,
  not with this ADR.
- ADR-056 — puts the MFE presentation boundary in the same package, another
  spec-shaped surface rather than a primitive.
- ADR-036 — the framework-plugin base lives in contracts too, on the same
  reasoning.
- ADR-064 — the runtime's path to being a published package, which is why the
  runtime may depend on contracts but not the reverse.
