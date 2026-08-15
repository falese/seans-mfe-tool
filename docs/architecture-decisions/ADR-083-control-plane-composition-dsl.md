---
id: 0083
title: Composition is authored in a project-scoped DSL, not hand-written registry JSON
status: Accepted
impl:
  stage: phased
  refs: ["#139"]
date: 2026-08-15
deciders: [sean]
area: Control plane / DSL / codegen / composition
enforcement: code
tags: [control-plane, dsl, composition, placement, registration, drift, schema]
relates-to: [66, 67, 69, 72, 73, 74, 78]
supersedes: []
superseded-by: []
implements-pdr: [5, 8]
implemented-by:
  - packages/dsl/src/control-plane-schema.ts
  - packages/dsl/src/control-plane-compiler.ts
  - src/commands/compose/build.ts
  - src/commands/compose/validate.ts
verified-by:
  - packages/dsl/src/__tests__/control-plane-compiler.test.ts
  - packages/dsl/src/__tests__/control-plane-fleet-equivalence.test.ts
tracked-by: ["#139"]
summary: >-
  Each deploying project authors its composition in a project-scoped
  `control-plane.yaml` — a declared namespace plus routes that say which capability
  appears in which slot — and the CLI compiles that, together with the fleet's
  manifests, into the registry payload that was previously hand-written as
  `rules.json`. The `registration` half stops being authored at all: it is derived
  from `mfe-manifest.yaml` per ADR-074. Placement resolves capability to owning MFE
  through the manifests, so an author names the capability and the slot, never the
  remote entry, the federation scope or the module.
rationale-summary: >-
  `rules.json` was the last platform artifact with no schema: 1,224 lines across two
  fleets, of which the nine-field `registration` blocks are pure restatements of the
  manifest and the routes are a repeated shape with no vocabulary. The platform's own
  precedent decides the split — ADR-074 says generate a restatement rather than check
  it, and ADR-078 says composition belongs to the deploying project — so the derivable
  half is generated and the decidable half gets the same zod-schema-plus-generated-
  JSON-schema treatment every other DSL document already has.
long-form: true
---

## Context

`rules.json` is the last significant artifact in this repository with no schema
behind it. Measured on the branch that promoted the control plane
(`packages/control-plane`, ADR-078 §1):

| | abc-kids | meridian-station |
|---|---|---|
| `rules.json` lines | 812 | 412 |
| `$schema` reference | none | none |
| zod schema | none | none |
| generated JSON schema | none | none |

The only type covering it is `PlacementRuleDocument` in
`packages/dsl/src/slot-validation.ts`, and it is deliberately minimal —
`registration?: { name?: string }` and routes with every field optional. It models
just enough for `slots:validate` to read `resolve.props.slot`, and nothing else.
Everything else in the file is unvalidated: capability names, `stateKey`s, and all
nine registration fields.

ADR-074 already measured the cost of the registration half and found **nine of nine
fields derivable from the manifest, none requiring human judgement**. It also named
the failure mode: a wrong `moduleFederation.scope` surfaces at runtime as
`Module "./App" does not exist in container`, an error that names neither the MFE
nor the rule that misdescribed it. That ADR was left `Proposed`; this one implements
its decision rather than restating it.

Two further facts pushed this past "nice to have":

**The routes are a repeated shape with no vocabulary.** Meridian's berth strip is six
routes differing only in `b1`…`b6`. abc-kids is fourteen MFEs × three capabilities =
forty-two routes of three shapes. Both were produced by copy-paste — abc-kids by a
bespoke emitter in `scripts/generate-games.mjs`, meridian by hand — and neither can
express "the same placement, once per berth".

**Namespacing is convention with nothing behind it.** Every `stateKey` in the
repository begins `abc.` or `meridian.`, and nothing enforces or records that. Two
projects registering against one registry would collide silently; the registry keys
rules by name and would simply overwrite.

## Decision

**Composition is authored, per project, in a `control-plane.yaml` that the CLI
compiles into the registry payload.** The payload stops being a source file.

### 1. One document per project, with a declared namespace

The deploying project owns the file, matching ADR-078's boundary: the project owns
its composition, the platform owns the engine that evaluates it.

```yaml
project: meridian-station
namespace: meridian
mfes: [meridian-console, meridian-docking-control, …]
routes: …
```

`namespace` is declared, not inferred, and every `stateKey` the document produces
must sit under it. A key that escapes its namespace is a validation error, not a
warning: it is the collision the registry cannot detect for itself.

Declared rather than auto-prefixed. Auto-prefixing would shorten the source, but it
would rewrite every existing `stateKey` and break the register scripts, `send-action.sh`
and the e2e specs — a migration cost paid for terseness, against a platform whose
addressing rules (ADR-066) already prefer explicit names over implicit ones.

### 2. `registration` is not authored — it is derived (ADR-074)

No `control-plane.yaml` contains a `baseUrl`, a `remoteEntryUrl`, a federation scope
or a module. The compiler derives all nine fields from each MFE's
`mfe-manifest.yaml` and merges them into the payload at build time.

This is ADR-074's decision, implemented. Its status moves from `Proposed` to
`Accepted` with this ADR.

### 3. Placement names a capability and a slot; the compiler finds the MFE

An author writes what should appear where:

```yaml
routes:
  - when: meridian.open.docking
    place:
      - capability: DockingBoard
        into: meridian-console/main
```

Which MFE serves `DockingBoard` is a fact in the manifests, so the compiler resolves
it rather than asking. Where a capability name is declared by more than one MFE —
abc-kids' fourteen games all declare `PlayGame` — the route must name its provider
with `from:`, and an unqualified ambiguous capability is an error that lists the
candidates.

### 4. Repetition is expressed, not unrolled

```yaml
  - when: meridian.berth.{id}
    forEach: { id: [b1, b2, b3, b4, b5, b6] }
    place:
      - capability: BerthTile
        into: meridian-console/berth.{id}
        props: { berthId: "{id}" }
```

Placeholders expand into the same six routes the registry already receives. The
expansion is textual and total: a placeholder with no binding is an error, so a typo
cannot silently produce a literal `{id}` in a slot address — which ADR-066 would
park and wait on, forever and silently.

### 5. The compiled payload is a generated artifact

`rules.json` becomes generated output, subject to the same rule as every other
generated file: never hand-edited, and regenerated by `compose:build`. The
authored document gets the treatment every DSL document in this repo already has —
a zod schema in `packages/dsl`, a generated JSON schema under `schemas/dsl/`, and a
`--json` command wrapping a pure core.

## Boundaries

This does not change the control-plane message protocol (ADR-054), the slot contract
(ADR-066–073), or what the registry does with a payload once it has one. The payload
shape is unchanged — the compiler's output is what the registry already accepts, which
is what makes the migration verifiable.

It does not decide persistence (ADR-078 §2) or `platform:init` (ADR-078 §3). It
supplies the document those will generate rather than inventing a second format later.

It does not make placement derivable. Routes remain a human decision; only their
*shape* is now checked.

## Consequences

**Better.** The nine-field registration blocks stop existing as source. abc-kids
drops from 812 lines of JSON to a document of roughly one tenth that, and the
bespoke rules emitter in `generate-games.mjs` loses its reason to exist.

**Better.** Three classes of error move from runtime to build time: a capability no
MFE declares, a slot address no MFE provides, and a `stateKey` outside its project's
namespace. The first two were previously discovered as a silent non-render.

**Better.** Editor completion and inline documentation, from the generated JSON
schema, on a file that previously had neither.

**Worse.** A build step now sits between authoring composition and running it. Editing
the registry payload by hand to try something stops being legitimate; the loop is
`compose:build` first. This is the same cost every other generated artifact in
the platform already imposes, and the same mitigation applies — the command is fast
and takes `--dry-run`.

**Worse.** Capability-to-MFE resolution is implicit. It is derived from the manifests,
so a capability renamed in a manifest silently re-points or breaks a route. The
compiler reports the break, but the coupling is real and is the price of not making
authors write the owning MFE on every line.

**Cost accepted.** Two fleets must be migrated, and the migration has to be proved
rather than asserted. The equivalence test pins the compiler's output against the
`rules.json` each fleet ships today.

## References

- ADR-074 — registration is a build artifact; the nine derivable fields. Ratified by
  this ADR and implemented in the compiler.
- ADR-078 — the control plane ships in the platform; §4 fixed the split this ADR
  implements (generated registration, authored routes).
- ADR-073 — `slots:validate` and the registry-side placement check whose findings the
  compiler reuses.
- ADR-066 / ADR-069 — slot addressing and the single-sourced id grammar the compiled
  addresses are validated against.
- ADR-065 — generated reference artifacts under drift control; the precedent for the
  generated JSON schema.
- PDR-008 / #139 — the control plane as platform, and the epic this lands under.
