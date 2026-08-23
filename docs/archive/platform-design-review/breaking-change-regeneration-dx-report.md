# Breaking-Change Regeneration — SMT Developer-Experience Field Report

This report was written **live** while pushing a platform-contract change out to
the whole example fleet with the real SMT toolchain. Every entry records the
command issued, what was expected, what actually happened, and a
friction/delight call.

The change: ADR-017 forbids `throw new Error()`, #320 typed every site in the
platform's own source, and the **templates were left untouched** — so generated
code was still entirely untyped. Fixing that meant editing 5 template sites and
carrying the result to 48 files across 21 MFEs.

That made it a controlled drill for a question the platform had never been
tested against: **how well does our own plumbing carry a breaking change out to
the fleet?**

Legend: 😍 delight · 👍 fine · 😕 friction · 🐛 bug

Companion report: [`examples/meridian-station/DX-REPORT.md`](../../../examples/meridian-station/DX-REPORT.md),
written while *building* a fleet. This one is about *changing* one.

---

## Phase 0 — Baseline

> `npm run check:mfe-drift:check` · `npm run check:mfe-consistency`

Both clean: 21 MFEs, no generator-owned drift, all internally consistent. The
drift check takes 11.8s for the fleet. 👍

Blast radius measured before touching anything:

| Generated file | `overwrite` | Files | Reachable by regeneration |
| --- | --- | --- | --- |
| `platform/base-mfe/mfe.ts` | `true` | 21 | ✅ |
| `platform/bff/bff.ts` | `true` | 8 | ✅ |
| `src/index.tsx` | `false` | 19 | ❌ |

- 😕 **The split was knowable only by reading generator source.** Nothing in the
  CLI answers "what would a template change touch, and what can't it reach?".
  The `overwrite` flag is an internal detail of `unified-generator.ts`; there is
  no `--explain`, no dry-run-across-the-fleet, no manifest of ownership.

## Phase 1 — Does the gate notice?

> `npm run check:mfe-drift:check` (after editing 4 templates)

- 😍 **Exit 1, 29 files named, exact split.** It listed every stale file by
  path, grouped by MFE, counted them, and closed with the fix command:
  `Run: npm run check:mfe-drift (then commit the result)`. This is the gate
  doing precisely its job — the predicted 21 + 8 with no surprises.
- 😕 **Warning noise on every run.** Each Angular MFE prints
  `WARNING: Missing template for public/demo.html` and `…/favicon.ico`. Two
  lines × 4 Angular MFEs, interleaved with the real findings, on a gate whose
  output you are meant to read carefully. They are not new and not related to
  this change; they are just always there.

## Phase 2 — Does the fix work?

> `npm run check:mfe-drift`

- 😍 **3.9 seconds, 29 files, nothing else moved.** `git status` afterwards
  showed exactly 21 `mfe.ts` + 8 `bff.ts` and not one unrelated byte. For a
  fleet-wide regeneration that is a strong result — the whitespace hazard
  CLAUDE.md warns about (PR #335 drifted all 21 examples on a stray newline)
  did not bite, because the edits stayed inside existing blocks.

> `remote:generate --force` in `examples/abc-kids/flappy`

- 😍 **Byte-identical to the drift path.** Running the *other* regeneration
  entry point over an already-regenerated MFE left `check:mfe-drift:check`
  clean. Two independent paths agreeing byte-for-byte is the idempotence
  ADR-043 claims, demonstrated rather than asserted.
- 👍 **`--force` behaved exactly as documented.** It did not touch
  `src/index.tsx`. Meridian punch-list item 21 already caught this flag "wearing
  a threatening name" and corrected its help text to *"Deprecated no-op:
  generated platform files re-stamp on every run; developer-owned files are
  never overwritten"*. That fix holds: the flag is honest now, and
  `options.force` is — correctly — read nowhere in `unified-generator.ts`.
- 🐛 **But `--dry-run` still lies about the same files.** The planner is a
  separate code path from the writer:

  ```ts
  op: file.overwrite ? 'overwrite' : 'create'     // generate.ts:44
  ```

  So the dry run reports `create src/index.tsx` and prints it as `(new)` — for
  a file that exists and that the writer will skip. Item 21 fixed the
  *post-run* hint; the *pre-run* plan still tells you a developer-owned file is
  about to be created. A dry run that misdescribes the wet run is worse than no
  dry run.
- 😕 **It also emitted an untracked `.gitignore`** that `check:mfe-drift` does
  not manage. The fleet is already inconsistent about this: 1 of the abc-kids
  MFEs has one committed, 7 of the meridian ones do. Whether a generated MFE
  has a `.gitignore` currently depends on whether someone happened to run
  `remote:generate` in it. (Adjacent to #300.)

## Phase 3 — Does anything notice what regeneration *couldn't* reach?

With 19 `src/index.tsx` files still carrying `throw new Error('Root element not
found')` against a template that no longer does:

> `seans-mfe-tool mfe:validate examples/abc-kids/flappy --json`

```json
{ "ok": true, "checked": ["react-pinned","manifest-package-sync","shared-declared",
                          "shared-version-sync","runtime-declared"], "issues": [] }
```

> `npm run check:mfe-consistency`

```
21 MFE(s) checked — all internally consistent.     (exit 0)
```

- 😕 **Both report healthy.** Neither is wrong — `mfe:validate`'s five rules are
  about manifest ⇄ package.json ⇄ federation agreement, and drift is scoped to
  generator-owned files by design. But between them, the platform has **no
  concept of a developer-owned file being stale against its own template**. The
  fleet can diverge from its templates indefinitely and every gate stays green.

## Phase 4 — The part a human had to do

19 files, edited by hand. They were perfectly uniform — all 19 carried the
identical `import { createRoot } from 'react-dom/client';` line — which is the
point: **this was mechanical work that no tool in the platform could perform.**
Plus one genuinely hand-written file (`GameLauncher.tsx`) that no generator has
ever owned.

- 😕 The uniformity is the indictment. A codemod would have been trivial. The
  platform's position is that these files belong to the developer, which is
  right — but "yours to edit" and "you are on your own when the platform
  contract moves" are not the same statement, and the toolchain currently makes
  only the first one.

## Phase 5 — Verification

> `npm test` · `npm run build` · `check:mfe-drift:check` · `check:mfe-consistency`

140 suites, 2540 tests, all gates clean. 👍

The end-to-end result the exercise was for:

```
raw Error   (before): {"type":"unknown","retryable":false}
NetworkError (after): {"type":"network","retryable":true}
```

- 😍 Every generated MFE's BFF failure — including a 503 — used to classify as
  `unknown` and **non-retryable**, so ADR-030's retry machinery could not help
  the one case it exists for. It can now.
- 🐛 **`npm run typecheck` does not cover `packages/runtime`.** It is compiled
  separately by `npm run build`, which is what caught a `BusinessError` left
  with a missing `code` argument. Anyone touching runtime code and trusting
  `typecheck` is trusting the wrong gate. (First hit during #320, reconfirmed
  here.)

---

## Punch list

1. 🐛 **`--dry-run` reports `create` / `(new)` for developer-owned files the
   writer will skip.** `generate.ts:44` derives the op from `file.overwrite`
   without consulting whether the file exists — the same conflation item 21
   fixed for the post-run hint. Fix: the planner should call the file `skip`
   when it exists and is developer-owned.
2. 😕 **No mechanism reaches developer-owned files when a platform contract
   moves, and nothing reports the staleness.** This is the headline finding.
   Options worth weighing: a `mfe:migrate`/codemod path; an `mfe:validate` rule
   that compares developer-owned files against the template that seeded them;
   or a deliberate decision that the platform guarantees nothing outside
   generator-owned files — stated, so it is a position rather than a gap.
3. 😕 **No way to ask what a template change will touch.** The `overwrite`
   ownership map is generator-internal. A `--explain` or fleet-wide dry run
   would have replaced the source-reading that opened this exercise.
4. 😕 **Angular template warnings on every drift run** (`public/demo.html`,
   `public/favicon.ico` missing from `base-mfe-angular`). Either add the
   templates or stop warning for a variant that legitimately lacks them.
5. 😕 **`remote:generate` emits a `.gitignore` outside the drift gate's
   coverage**, so its presence across the fleet is arbitrary (1 of 13 abc-kids,
   7 of 8 meridian). Adjacent to #300.
6. 🐛 **`npm run typecheck` skips `packages/runtime`.** Only `npm run build`
   compiles it. The gate list in CLAUDE.md implies otherwise.

## What went right

Worth recording, because a report that only lists friction misrepresents the
platform:

- The drift gate caught a fleet-wide contract change on the first run, named
  every affected file, and printed the command that fixes it.
- Two independent regeneration entry points produced byte-identical output.
- 29 of 48 files were fixed by one command in under 4 seconds.
- Nothing unrelated moved — no whitespace cascade, no incidental diff.

The gap is not in the regeneration machinery, which performed well. It is that
**the machinery's reach stops at a boundary nothing measures or reports**, and
the 19 files on the far side of it were invisible to every tool in the box.
