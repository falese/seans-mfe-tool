---
id: 0089
title: >-
  `--force` re-seeds developer-owned scaffolding from the current templates; capability
  implementation stays unreachable
status: Implemented
date: 2026-09-11
deciders: [sean]
area: Codegen / ownership / DX
enforcement: code
tags: [codegen, ownership, migrations, dx, cli]
relates-to: [43, 77, 82]
supersedes: []
superseded-by: []
implements-pdr: [1]
implemented-by:
  - packages/codegen/src/template-io.ts
  - packages/contracts/src/envelope.ts
  - src/commands/remote/generate.ts
  - src/oclif/results.ts
verified-by:
  - packages/codegen/src/__tests__/reseed.test.ts
tracked-by: []
summary: >-
  `remote:generate --force` overwrites developer-owned files with freshly generated content
  instead of doing nothing, giving ADR-082's migration warnings a corresponding repair action;
  capability feature files are excluded because they never enter the generation plan once
  implemented, and the writer reports re-seeded paths separately from routine writes so the one
  outcome that can destroy work is never reported as an ordinary one.
rationale-summary: >-
  The flag already existed, was advertised, and did nothing, because both meanings it could have
  had were removed by later decisions — unconditional re-stamping took one and ADR-082's
  never-rewrite invariant took the other; rather than delete the surface, giving it the action
  ADR-082 explicitly lacks turns a dead flag into the missing half of the migration story, and
  the scaffolding/implementation split it needs is one the generator already makes structurally.
long-form: true
---

## Context

`remote:generate --force` did nothing. Verified at the source: the flag is
declared in `src/commands/remote/generate.ts`, parsed, passed to
`writeGeneratedFiles(allFiles, { force: options.force })`, and that function
never read `options.force`. The generator was additionally called with a
hardcoded `force: true` into a `generateAllFiles` option that was also never
read. Running with and without the flag produced byte-identical results.

It was not broken by an edit. Both meanings it could have carried were removed
deliberately, by different decisions:

1. **Gating re-stamps of generator-owned files.** The stale comment in
   `template-io.ts` described exactly this — *"generated; skip if exists unless
   `--force` re-stamps it"* — but the code re-stamps unconditionally, and has
   to: ADR-043 makes regeneration idempotent and `check:mfe-drift` requires
   every `overwrite: true` file to match a fresh generation at all times. Once
   re-stamping became unconditional, the flag had nothing to gate.

2. **Overwriting developer-owned files.** Forbidden, and ADR-082 §Context
   quotes the invariant approvingly: *"never touch it, even with `--force`"*.

So the flag was vestigial rather than defective. The honest options were to
delete it or to give it a meaning. The reason to give it one is that ADR-082
names a gap it does not close, and this is the shape of the thing that closes
it.

ADR-082 exists because regeneration cannot reach developer-owned files: a
platform change that lands there can only be *reported*. Its own cost section
concedes the limit. The measured case is the ADR-017 rollout
(`docs/archive/platform-design-review/breaking-change-regeneration-dx-report.md`):
a template change touched 48 files, regeneration reached 29, and the remaining
19 were hand-edited. For most of those 19 the developer had never customised
the file — it was scaffolding, seeded once and left alone. The platform could
have regenerated it correctly and was forbidden from trying.

A warning with no corresponding action is half a migration story. `--force` is
the other half, and the name was already there.

## Decision

### 1. `--force` re-seeds developer-owned files

`writeGeneratedFiles` decides from existence, ownership, and now `force`:

| exists | `overwrite` | `force` | outcome |
|---|---|---|---|
| no | either | either | written |
| yes | `true` | either | re-stamped |
| yes | `false` | no | skipped — yours |
| yes | `false` | **yes** | **re-seeded** |

Only the last row is new. The default path is byte-for-byte what it was.

### 2. Generator-owned behaviour is unchanged and does not depend on `force`

`overwrite: true` files are re-stamped on every run, with or without the flag,
because ADR-043 and `check:mfe-drift` require it. The stale comment claiming
otherwise is corrected.

### 3. Capability implementation is not reachable by `--force`

A capability whose feature file already exists is omitted from the generation
plan entirely — `generateAllFiles` calls `capabilityImplemented` and `continue`s
rather than emitting the file with a flag. A writer that walks the plan
therefore cannot touch it, however it is called.

This is not a new category invented for this ADR. The generator already
distinguishes three things structurally, and only two of them had names:

| | mechanism | `--force` |
|---|---|---|
| Generator-owned | emitted, `overwrite: true` | re-stamped anyway |
| Developer-owned **scaffolding** | emitted, `overwrite: false` | **re-seeded** |
| Developer **implementation** | *never emitted once it exists* | unreachable |

The boundary is the one that matters in practice: `App.tsx`, `package.json`,
the bundler config and the tsconfigs are seeds the platform knows how to
rebuild. A capability's feature file holds the domain logic someone wrote,
which the platform cannot reconstruct and must never replace. A `--force` that
destroyed game logic would be unusable for the migration case it exists to
serve.

### 4. A re-seed is reported as its own outcome, never as an ordinary write

`writeGeneratedFiles` returns `reseeded` alongside `files` and `skipped`, and
`PlannedChange.op` gains `reseed` beside `overwrite`. `remote:generate` prints
re-seeded paths in red, itemised, with the `git checkout --` recovery line, and
`--dry-run --force` labels them `(RE-SEED — replaces your edits)`.

A caller that cannot distinguish a re-seed from a first write cannot warn about
it. This is the only op in the system that can destroy work, so it is the one
that must not be silent.

## Boundaries

**No git integration.** This does not check whether the file is committed, or
stash anything. Nothing in `src/` or `packages/` shells out to git today, and
adding that dependency to make one flag safer is a larger decision than this
one. The mitigations are `--dry-run --force` before the fact and the recovery
line after it. If a guard is wanted later it is a separate ADR, not a quiet
addition here.

**All-or-nothing.** `--force` re-seeds every developer-owned file in the plan.
There is no per-file selection. Per-file re-seeding is the natural thing to
build once the file plan of the generator simplification is in place
(`docs/generator-extraction-plan.md`, Phase 4), where each entry is addressable;
building it against 25 inline `overwrite:` booleans would bake in a shape that
work is about to remove.

**Not wired to `PLATFORM_MIGRATIONS`.** A migration entry cannot yet declare
"this file is re-seedable", and `mfe:validate` does not suggest `--force` when
it reports a hit. That pairing is the obvious next step and is deliberately not
in this change: the entries were written as advisory text under ADR-082's
never-rewrite premise, and re-reading them as actionable is its own review.

**Does not narrow ADR-082.** ADR-082's decision — the registry, and that
*validation* reports without modifying — stands untouched. What changes is the
premise quoted in its Context that no command anywhere may rewrite a
developer-owned file. Validation still never writes. An explicit, opt-in flag
on the generate command now does.

## Consequences

**Better.** The migration story has both halves: `mfe:validate` says a
developer-owned file has fallen behind the contract, and there is now a command
that fixes it for the common case where the file was never customised. The
19-of-48 hand-edit tail from the ADR-017 rollout is the measured size of what
this addresses. A flag that shipped in the CLI and in `schemas/remote-generate.json`
now does what its description says, which it did not before.

**Worse.** There is now a supported way to destroy developer work, and its
blast radius is every developer-owned file in the MFE at once. Someone who has
customised `App.tsx` and runs `--force` to fix `package.json` loses the
customisation. The dry-run preview, the red itemised report and the recovery
line are mitigations, not prevention, and there is no undo inside the tool.

**The trade-off accepted.** All-or-nothing re-seeding with loud reporting, now,
over per-file re-seeding with a git guard, later. The narrower tool is the
right long-term shape, but it depends on the file plan that does not exist yet,
and shipping the flag as a documented no-op in the meantime was the worse of
the two failures: a tool that lies about what it does costs more trust than one
that does something blunt and says so.

## References

- ADR-043 — manifest-driven codegen; its idempotent-regeneration requirement is
  why generator-owned files re-stamp unconditionally and why `--force` had no
  role there.
- ADR-077 §1 — `overwrite` is the ownership map; this adds a third outcome to
  it rather than a third flag.
- ADR-082 — the migration registry that reports what regeneration cannot fix;
  this supplies the repair action its Context says does not exist.
- `docs/generator-extraction-plan.md` — finding A4 and Phase 4, where per-file
  re-seeding becomes expressible.
