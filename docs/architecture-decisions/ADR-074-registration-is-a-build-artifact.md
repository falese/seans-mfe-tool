---
id: 0074
title: The MFE Registration Is a Build Artifact — Register on Build, Not by Hand
status: Proposed
date: 2026-07-25
deciders: [sean]
area: Codegen / control-plane / registration / module-federation / drift
enforcement: code
supersedes: []
superseded-by: []
tags: [codegen, module-federation, control-plane, registration, drift, manifest]
summary: The `registration` half of a control-plane rule document is generated from `mfe-manifest.yaml` at build time instead of being hand-authored. Every one of its nine fields is already a restatement of the manifest, so hand-maintaining it can only introduce drift. `routes` stay hand-authored — placement is an operator decision and is not derivable. The Module-Federation `exposes` key stays fixed at `./App` (#272); this ADR records that convention, which until now existed only as a template comment.
rationale-summary: The platform has converged on build-time drift control — #295 (generator-owned files), #296 (package.json + federation `shared`), ADR-073 (declared vs implemented slots, and rules vs declarations). Each of those *detects* disagreement between two hand-maintained things. The registration is the last artifact still fully hand-authored, and it restates the manifest field for field. Generating it removes the disagreement rather than checking for it.
---

## Context

Four gates now keep the fleet in sync, and they share a shape:

| Gate | Keeps in sync | Mechanism |
| --- | --- | --- |
| #295 drift gate | generator-owned files ⇄ manifest | regenerate + diff |
| #296 consistency gate | `package.json` + federation `shared` ⇄ manifest | rules over parsed config |
| ADR-073 `slots-implemented` | app code ⇄ manifest | static scan |
| ADR-073 `slots:validate` | registry rules ⇄ manifest | address registry |

All four **detect** that two independently-maintained things have diverged. That
is the right tool when both sides must exist separately — app code genuinely has
to be written, and placement genuinely has to be decided. It is the wrong tool
when one side is a pure restatement of the other, because then the second copy
has no reason to exist at all.

The control-plane `registration` block is exactly that case. Checking one against
the manifest today:

| registration field | source |
| --- | --- |
| `name` | `manifest.name` |
| `version` | `manifest.version` |
| `type` | `manifest.type` |
| `baseUrl` | `manifest.endpoint` (byte-identical) |
| `remoteEntryUrl` | `manifest.remoteEntry` (byte-identical) |
| `capabilities` | `manifest.capabilities` (the platform ones) |
| `contentType` | derived from `framework` + `bundler` |
| `moduleFederation.scope` | `name` with `-` → `_` |
| `moduleFederation.module` | `./App`, fixed by #272 |
| `providesSlots` | `manifest.providesSlots` (added in ADR-073) |

**Nine of nine fields are derivable. None requires human judgement.** Yet each is
retyped by hand into `rules.json`, and nothing verifies any of them. A wrong
`remoteEntryUrl` is a 404 at mount; a wrong `scope` or `module` surfaces as
`Module "./App" does not exist in container` — a Module-Federation error that
names neither the MFE nor the rule that misdescribed it.

Two things are worth separating honestly, because they motivate different fixes:

- **Declaration drift** — the registration disagrees with the manifest. This ADR
  removes it by construction.
- **Artifact staleness** — the registration and the manifest agree, but the
  *built bundle* does not match either, because an image was never rebuilt or its
  build failed silently behind nginx. Generation does **not** fix this; only
  building the example images in CI does. Tracked separately.

There is also an undocumented decision in play. #272 standardized the
Module-Federation expose key on `./App` across every framework template, and the
only record is a comment in `webpack.config.js.ejs`. Any future proposal to make
`exposes` manifest-configurable would need to overturn a constraint that was
never written down.

## Decision

**The `registration` block is generated from the manifest; `routes` are not.**

### 1. Registration is emitted by codegen

`registration` becomes generator-owned output, derived from `mfe-manifest.yaml`
by the same pipeline that already derives `package.json` client dependencies and
the federation `shared` block (ADR-071). It joins the `overwrite: true` set, so
the #295 drift gate covers it for free — regenerate-and-diff, no new machinery.

### 2. Routes stay hand-authored, and stay separate

Placement is the operator's decision (PDR-005, ADR-055): *what* renders for whom
is a rules-engine concern that no manifest can predict. `routes` remain
hand-written data in `control-plane/rules.json`, validated but never generated.

This splits the rule document along its real seam: the half that describes **an
MFE** is generated, the half that describes **a decision** is authored.

### 3. `exposes` stays `./App` — recording #272

The expose key is **not** made manifest-configurable, and this ADR states why so
the reasoning stops living in a code comment:

- One key across every framework lets a host register any MFE, React or Angular,
  with no per-framework special-casing.
- Multi-expose would duplicate a mechanism the platform already has: one MFE
  exposes `./App` and the daemon selects the component per placement via
  `moduleFederation.component || capability`. That is how `meridian-docking-control`
  serves `DockingBoard`, `TrafficLog`, and `BerthTile` from a single expose.

Making the key configurable would reintroduce exactly the per-MFE variance #272
removed, in exchange for capability the capability system already provides.

### 4. A `federation-module` rule for registrations that are still hand-written

Generation is only as strong as its adoption (the ADR-067 lesson). Third-party
and hand-maintained registrations will exist, so `slots:validate` gains a rule:
a rule's `moduleFederation.module` must be one the target MFE actually exposes,
and its `scope` must match the target's derived scope. This reuses the provider
lookup `createSlotAddressRegistry` already performs (ADR-073) against a different
declaration — no new resolution machinery.

## Boundaries

- **Generation does not detect staleness.** If the served bundle disagrees with
  its own source, every artifact here is still consistent and still wrong. The
  fix for that is building example images in CI.
- **`routes` are never generated.** Placement is a decision, not a derivation.
- **Environment-specific values.** `endpoint` / `remoteEntry` are manifest fields
  today and carry `localhost` ports for the examples. Generation inherits that;
  per-environment overriding is out of scope and unchanged by this ADR.
- **The daemon's synthesis path is untouched.** This changes where the
  registration comes from, not what it means on the wire (ADR-054).

## Consequences

- A whole class of drift stops being *detectable* and starts being
  *unrepresentable* — the stronger of the two, and the direction the last four
  gates have been pointing.
- `rules.json` shrinks to what a human actually decided, which makes a placement
  change reviewable as a placement change instead of a wall of restated metadata.
- The #272 convention is written down and can be argued with.
- Trade-off: registering an MFE the platform did not generate now needs either a
  hand-written registration (still supported, now validated by §4) or a
  `describe()`-style endpoint to derive from. The gate is as strong as codegen
  adoption — the same trade ADR-067 accepted.

## References

- ADR-071 — manifest-driven client dependencies and federation `shared`; this
  extends the same thesis from the *build* config to the *registration*.
- ADR-073 — design-time validation; §4 reuses its provider lookup. <!-- adr-lint-ignore: reference-gloss-matches -->
- ADR-054 / ADR-055 — registration wire shape and the placement-is-a-rule split. <!-- adr-lint-ignore: reference-gloss-matches -->
- ADR-067 — the declare-once-generate-both pattern this follows. <!-- adr-lint-ignore: reference-gloss-matches -->
- #272 — the `./App` expose-key standardization, recorded here for the first time.
