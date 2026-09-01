---
id: 0082
title: The platform reports its own breaking changes in code it does not own, and never rewrites that code
status: Implemented
date: 2026-07-27
deciders: [sean]
area: Codegen / ownership / DX
enforcement: code
tags: [codegen, ownership, migrations, deprecation, validation, dx]
relates-to: [17, 34, 43, 73]
supersedes: []
superseded-by: []
implements-pdr: [1]
implemented-by:
  - packages/codegen/src/platform-migrations.ts
  - packages/codegen/src/validate.ts
  - src/commands/mfe/validate.ts
  - scripts/adr-governance-report.ts
  - CLAUDE.md
verified-by:
  - packages/codegen/src/__tests__/platform-migrations.test.ts
  - scripts/__tests__/adr-governance-report.test.ts
  - check:mfe-consistency
tracked-by: []
summary: >-
  A platform change that affects code the generator seeds but does not own is declared as a
  migration entry with a matcher, a fix and a version at which it stops being advisory; the
  entries are checked against developer-owned files by mfe:validate, the fleet gate and
  remote:generate, and reported as warnings that never modify the file.
rationale-summary: >-
  Regeneration cannot reach developer-owned files by design, and until now nothing reported that
  they had fallen behind the contract, so "yours to edit" and "you are on your own when the
  contract moves" were the same sentence; detecting usage rather than staleness reports the
  developers who are actually affected instead of everyone who ever edited their own file.
long-form: true
---

## Context

ADR-043 makes regeneration idempotent, and `unified-generator.ts` splits every
emitted file into two classes: `overwrite: true` files the generator owns and
re-stamps, and `overwrite: false` files it seeds once and then leaves alone —
*"never touch it, even with `--force`"*.

That split is correct. It is also, until now, the end of the story.

Carrying ADR-017 out to the fleet measured what that costs
(`docs/archive/platform-design-review/breaking-change-regeneration-dx-report.md`). A
template change touched 48 files across 21 MFEs. Regeneration reached 29. The
other 19 were `src/index.tsx` — developer-owned — and with every one of them
stale against the template that seeded it:

- `mfe:validate` reported `ok: true`, its five rules being about manifest ⇄
  package.json ⇄ federation agreement;
- `check:mfe-consistency` exited 0;
- `check:mfe-drift` is scoped to generator-owned files by design.

Every gate green, 19 files behind the contract, and the only way anyone found
them was `grep`. All 19 were byte-identical in the region that mattered.

The platform had no way to say the one thing that needed saying: *this file is
yours, and something it uses has changed.*

## Decision

### 1. A platform change that reaches seeded-but-unowned code declares a migration

`packages/codegen/src/platform-migrations.ts` holds one entry per such change:
a stable `id`, the `since` version, a `failsAt` version, a matcher over source
text, the `message`, the `fix`, and the ADR it enforces.

Hand-maintained and reviewed like any other contract. Deriving entries from
template diffs was rejected: a diff cannot distinguish a contract change from a
comment reflow, and the fix hint — the half a developer actually needs — cannot
be derived at all.

### 2. Detection is by usage, not by staleness

The rule asks "does this code use the thing that changed", not "was this file
seeded before the change".

Staleness would need the generator to record a template revision per file, and
would then flag every developer who legitimately rewrote their own file, for
as long as the file existed. Usage reports exactly the developers who are
affected, and goes quiet the moment they fix it — including for the developer
who fixed it by rewriting the file entirely.

### 3. Warn, never rewrite

A migration hit is a `warning`. It does not modify the file, and it does not
fail a build.

This required severity to exist at all: `ValidationIssue` had none, and
`ok = issues.length === 0` made every rule fatal. Severity defaults to `error`
so the six pre-existing rules are unchanged, and `ok` is now keyed to errors
alone.

### 4. Advisory until a declared version, then fatal

Each entry names the platform version at which its warning becomes an error.
The comparison is against the **running CLI's version** — not per-MFE state,
which does not exist — so the escalation arrives when someone upgrades the
platform, which is when a breaking change legitimately lands.

`--strict` escalates on demand, independently of `failsAt`, for a team that
wants the stronger contract before the platform requires it.

### 5. Reported where the developer already is

Three surfaces: `mfe:validate` (and therefore `check:mfe-consistency`, which
calls its core), and `remote:generate` — immediately after re-stamping the
files the platform *does* own, which is the moment the gap is most visible and
least surprising.

Warnings go to the envelope's `warnings[]` (ADR-018), so an MCP tool call or an
agent sees them without parsing stdout.

## Boundaries

- **Only developer-owned files.** Generator-owned files are classified by
  asking `generateAllFiles`, the same authority `check-mfe-drift` uses. A
  violation there is a drift failure, not a migration warning, and reporting it
  twice would teach people to ignore both.
- **Text matching, not an AST.** Entries match source text, which is what the
  existing `slots-implemented` rule and `parseFederationSharedEntries` already
  do. It will miss an alias and can hit a string literal. The cost of a false
  positive is a warning a developer dismisses; the cost of the AST toolchain is
  paid on every run of every gate. Revisit when an entry genuinely needs it.
- **No per-MFE grace windows.** MFEs record `@seans-mfe-tool/runtime: ^0.1.0`
  for a package that is not published (ADR-064/#252), so there is no per-MFE
  platform version to read. When #252 lands there will be, and an entry could
  then be advisory for an MFE on an older runtime while fatal for one that has
  upgraded. Deliberately not built on a signal that does not yet carry
  information.
- **This does not migrate anything.** It reports. A codemod that offers to
  apply a fix is a separate decision, and a bigger one — it would put the
  platform back in the business of editing files it does not own, under
  supervision.

## Consequences

**Better.** A breaking platform change becomes visible to the people it affects
at the moment it affects them, and the fleet can no longer drift silently from
its own contract. The 19 files would have been reported by three different
commands instead of found by grep.

**Worse.** The registry is hand-maintained, so a change that forgets to declare
an entry is invisible exactly as before — the mechanism does not enforce its
own use. Text matching will produce the occasional false positive. And every
`mfe:validate` run now generates the MFE in memory to classify ownership,
costing roughly half a second per MFE.

**The cost accepted.** A hand-maintained registry only works if declaring an
entry is part of making a breaking change. Nothing enforces that. The
alternative — deriving entries mechanically — was rejected in §1 for producing
worse entries, so the honest position is that this is a convention with tooling
behind it, not a guarantee.

The convention is therefore written down where the change gets made: CLAUDE.md
names the three trigger paths and requires the entry in the same commit, and
`scripts/adr-governance-report.ts` repeats the ask on any pull request that
touches them — suppressed when the diff already declares an entry, so a PR that
did the right thing stays quiet. Both are prompts, not gates. A blocking check
here would fire on comment reflows and typo fixes, and an escape hatch used
every third PR stops being read.

## References

- ADR-017 — typed errors; the first migration entry enforces it in code the
  generator does not own.
- ADR-043 — manifest-driven codegen, whose idempotent-regeneration property
  defines the ownership split this decision works within.
- ADR-073 — design-time slot validation; `slots-implemented` is the precedent
  for a source-scanning rule in `mfe:validate`.
- ADR-018 — the envelope whose `warnings[]` carries these findings to agents.
- ADR-064 / #252 — publishing the runtime, which would supply the per-MFE
  version the Boundaries section declines to invent.
- #339 — the issue this closes, filed from the regeneration drill.
