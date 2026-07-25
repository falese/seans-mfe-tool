# ADR-073 — Slot contract logic moves to `@seans-mfe/contracts`; placement targets become validatable

- **Status:** Accepted
- **Date:** 2026-07-25
- **Relates to:** ADR-061 (contracts zero-dependency invariant), ADR-064 (runtime as a published package), ADR-065 (generate-and-diff idiom), ADR-066 (desired-state placement), ADR-067 (manifest-declared slot contract), ADR-068 (provider-scoped addresses), ADR-069 (grammar single source)

## Context

ADR-067 §4 named the manifest "the registry-side validation target": the thing
rule-authoring tooling validates placement targets against at config time, so a
typo'd or renamed slot id fails at rule-save or in CI rather than in production.
`docs/slot-contract.md` repeats the promise — "typos and renames rejected at
rule-save", "checkable in CI against live registry rules".

None of it is implemented. A review found:

1. **No registry-side validation exists.** Both vendored demo registries
   (`examples/*/control-plane/registry/simple-registry.js`) contain zero occurrences
   of the string `slot`; `resolve.props` is passed through opaquely into the
   generated resolution. A rule targeting `meridian-console/nonexistent` registers
   happily and fails silently at runtime as a placement that parks forever.
2. **Placement rules are not a machine-readable artifact.** They live as inline JSON
   inside `curl -d '…'` heredocs in `scripts/register-station.sh` and
   `scripts/register-games.sh`. Nothing can read them, so nothing can check them.
3. **The registry cannot report its own rules.** `registerMfe()` compiles each route
   into a `{condition, generate}` closure pair and stores only `registration`, so
   `GET /mfes` cannot surface placement targets even if something wanted to check
   them live.
4. **The published manifest schema is stale.** `schemas/dsl/manifest.schema.json`
   has zero occurrences of `providesSlots` — it was last generated on 2026-07-02 and
   `providesSlots` landed 2026-07-11. The cause is structural: `build:schema:dsl:check`
   exists in `package.json` but was never wired into CI, so the artifact ADR-067 §4
   points external tooling at silently rotted.
5. **Nothing checks that a declared slot is ever implemented.** A slot declared in
   the manifest and registered by no component produces a `PROVIDED_SLOTS` entry
   nothing uses, and a placement that waits forever under ADR-066 convergence.

So the *declaration* side of ADR-067 is enforced (schema, codegen, drift gate,
runtime guard) while the *consumption* side — the half that motivated the ADR — has
no enforcement at all.

Building it needs the matcher, and that is where a dependency problem surfaces.
`createSlotContract()` lives in `packages/runtime`, but `tsconfig.json` carries path
aliases for `@seans-mfe/{contracts,dsl,codegen,oclif-base,framework-*}` and **none
for the runtime package** — runtime is private and heavyweight, staged into
generated MFEs rather than consumed by the CLI (ADR-064, and the same reasoning
ADR-069 used to reject `dsl → runtime`). A CLI command therefore cannot import the
matcher. Re-implementing it design-time would recreate precisely the two-sources
drift ADR-069 just eliminated.

## Decision

**The slot contract logic moves to `@seans-mfe/contracts`, and placement targets
become validatable at design time through the CLI.**

### 1. Contract logic relocates to `contracts`

`createSlotContract`, `toProvidedSlotAddress`, `SlotContract`,
`ProvidedSlotDeclaration`, and `ProvideSlotFn` move to
`packages/contracts/src/slot-contract.ts`.

This is the ADR-069 argument applied one level up. Contracts is the shared package
both design time and run time already reach; it already owns the grammar
(`slot-grammar.ts`); `ValidationError` already lives there — the runtime module
imports it today, so the dependency edge only gets shorter. The module is pure
regex, a factory, and a typed throw, so the ADR-061 zero-dependency invariant holds.

`packages/runtime/src/slot-contract.ts` becomes a **re-export shim**. Generated MFEs
import `createSlotContract` from `@seans-mfe-tool/runtime`, and that import is
baked into every emitted `slots.tsx`; keeping the specifier stable means no
regeneration churn and no drift-gate noise from a pure relocation.

The ADR-069 cross-package pin test stays. The two consumers still *compose* the
grammar differently — the DSL schema validates a whole id segment-by-segment, the
matcher compiles it into a regex — and the pin catches drift in those compositions.

### 2. A cross-MFE address registry, beside the per-MFE contract

Validating a placement target is a different question from validating a
registration: it spans MFEs and it operates on the **qualified** address.

```ts
export function createSlotAddressRegistry(
  providers: readonly { mfeId: string; declarations: readonly ProvidedSlotDeclaration[] }[]
): { validateTarget(address: string): SlotTargetResult };
```

Rules it encodes, following ADR-068's address grammar:

- An **unqualified** address (`root`, the default `main`) is host-owned. No MFE
  manifest declares it and none can; accept it.
- A **qualified** `<mfeId>/<localId>` address resolves the provider and matches
  `localId` against that provider's contract — one matcher, shared with runtime.
- A **known provider that does not declare the id** is a hard `undeclared-slot`
  failure. This is the rename/typo case, and it is exactly what ADR-067 §4 promised.
- An **unknown provider** is advisory (`unknown-provider`), not fatal. Registration
  order is not guaranteed and a fleet may be validated one MFE at a time; treating
  this as fatal would make the check unusable during incremental rollout.

### 3. Two questions, two surfaces — but only one new command

The intra-MFE question ("does this MFE implement what it declares?") and the
cross-MFE question ("does this rule target something that exists?") are different,
but only the second one needs a command of its own.

- **`mfe:validate [dir]` — a rule, not a new command.** PR #309 already ships
  `mfe:validate` for #296, built as a `ValidationRule` union over a pure,
  I/O-free `validateMfeConsistency()` with a thin command shell. The slot check is
  one more rule in that set — `slots-implemented` — not a second command wearing
  the same name.

  An earlier draft of this ADR had it the other way around, claiming the
  dependency assertions would later drop into a slot-first command. That was
  backwards, and the two commands collided add/add on
  `src/commands/mfe/validate.ts`. #309 is the host.

  The rule reports a declared id with no reference anywhere in `src/**`, matching
  on the literal prefix before the first `{param}` segment (`berth.{id}` → search
  for `berth.`), delegating to `findUnreferencedSlots` in `@seans-mfe/dsl` so the
  matching has one implementation. It is skipped when the manifest declares no
  slots, and when the caller supplies no sources — a scan over nothing would flag
  every declaration.

  **This is explicitly a heuristic.** It catches dead declarations, typos, and
  slots deleted from a component but left in the manifest. It cannot see
  conditional registration, and a sufficiently dynamic id will evade it. It is a
  lint, not a proof — the alternative (rendering every capability with synthesized
  props to observe real registrations) needs props the platform cannot invent.

  Living inside `validateMfeConsistency` means `check:mfe-consistency` carries the
  slot rule fleet-wide, which a standalone command would not have.

- **`slots:validate --manifests <glob> --rules <file>`** — *cross*-MFE placement:
  does every rule target a slot that exists? This one is genuinely new: it operates
  over the fleet and its rule documents, not over one MFE directory, so it has no
  home in a per-directory checker. Extends `BaseCommand`, implements
  `runCommand()`, uses typed errors, and emits exactly one `CommandResult` line
  under `--json`. Parses provider manifests through `@seans-mfe/dsl`, builds the
  address registry, and checks every `resolve.props.slot`.

### 4. Placement rules become a committed artifact

`slots:validate` needs rules it can read, so the example fleets stop embedding JSON
in shell heredocs. Each fleet commits `control-plane/rules.json` — the
`{registration, routes}` payloads as data — and its register script POSTs from that
file. For abc-kids the emitter (`scripts/generate-games.mjs`) generates the JSON
rather than the shell body.

The point is not the file format. It is that **placement rules become reviewable and
checkable**: a rule change shows up as a JSON diff in a pull request, and CI can
validate it against the fleet's manifests before anything is deployed.

### 5. The demo registry enforces at rule-save

To make ADR-067 §4 true rather than aspirational in the reference implementation,
the demo registries:

- carry `providesSlots` in the registration payload — the slot vocabulary the
  registry needs, already present in the manifest and already embedded in each MFE's
  generated `bootstrap.ts`;
- retain routes as data alongside the compiled closures, and expose `GET /rules`, so
  the registry can report what it was asked to place and where;
- validate `resolve.props.slot` on `POST /mfes` with the same rules as
  `createSlotAddressRegistry` — reject when the provider is registered and does not
  declare the id, warn when the provider has not registered yet.

The matcher lives in `control-plane/registry/slot-target.js` as a **copy** of the
one in contracts, not a call into it. That is a compromise, not a preference:
these registries are standalone dockerized services with their own
`package.json`, and `@seans-mfe/contracts` is not published yet
(docs/MERGE-PLAN.md Phase 1), so there is nothing for them to import. A silently
drifting copy would be worse than none — the registry would accept placements
the runtime rejects — so `packages/contracts/src/__tests__/registry-slot-pin.test.ts`
pins the two against each other across every branch, the same idiom ADR-069 used
for the grammar. Delete the copy and the pin when contracts is published.

These are vendored copies of `falese/daemon`'s registry; the same change belongs
upstream, and the plugin-first posture (unchanged) means this repo carries it only
for the examples.

### 6. The schema artifact gets a gate

`schemas/dsl/manifest.schema.json` is regenerated, and `build:schema:dsl:check` joins
`check:mfe-drift:check` in the CI quality job. A generated artifact with no
generate-and-diff gate is a stale artifact eventually (ADR-065); this one already
was.

## Boundaries

- **`mfe:validate` is a lint, not a proof.** See §3. Its false-negative surface is
  documented in the command's own help text, not just here.
- **`slots:validate` checks addresses, not props.** Whether `BerthTile` needs a
  `berthId` prop is a capability-contract question, not a slot question.
- **Keyed patterns still validate shape, not membership** (ADR-067). A rule
  targeting `meridian-console/berth.b9` passes even if no berth `b9` exists; which
  keys are real is runtime data.
- **Advisory stays advisory.** ADR-066 pillar 5 keeps live topology out of the
  correctness path; nothing here makes placement depend on registration order.

## Consequences

- The chain ADR-067 described end to end is now enforced end to end: schema and
  grammar at parse time, codegen and drift gate at build time, `mfe:validate` and
  `slots:validate` at design time, registry rejection at rule-save, and
  `assertDeclared` at runtime.
- One matcher serves all of it. A grammar or matching change is still one edit.
- `@seans-mfe/contracts` grows the slot contract surface, which matters for the
  pending publish (docs/MERGE-PLAN.md Phase 1) — third-party rule tooling can depend
  on contracts alone to validate targets, with no runtime dependency.
- Trade-off: relocating a module that generated MFEs import is a compatibility risk.
  The re-export shim absorbs it, and the drift gate proves no generated file changed.
- Trade-off: the demo registry gains validation logic, moving it slightly further
  from "dumb reference implementation". The logic is a call into the shared
  registry function, not a reimplementation.
