# Review handoff — three stacked PRs

`claude/demonstration` was 34 commits and 546 files. That is not a reviewable unit, so
it is split into three **stacked** branches, each a contiguous commit range. Nothing was
cherry-picked or reordered: the three ranges concatenate back to exactly the original
tip (`bc448ab`).

Stacked rather than independent because the dependency is real — Part 3's conformance
packs `import '@falese/smt-contracts'`, and that name only exists after Part 2's rename.

| PR | Branch | Base | Commits | Files | Hand-written |
|---|---|---|---|---|---|
| 1 | `claude/split-1-gates-and-demos` | `main` | 10 | 45 | 45 |
| 2 | `claude/split-2-packaging-namespace` | PR 1 | 10 | 475 | 240 |
| 3 | `claude/split-3-conformance` | PR 2 | 14 | 93 | 78 |

Merge in order. Each base must land before the next.

---

## PR 1 — self-verification gates, base-class demos, control-plane sugar

`31ef7ce`..`f95e0de`. The smallest and most independent. Audits the repo's own gates and
closes a `check:mfe-drift` orphan-file gap, adds an `mfe:validate` rule for lifecycle
hook handler/key mismatch, generalises the `package.json` dependency drift warning, and
adds `pushControlPlaneState` / `useControlPlaneState`.

**Where to look:** `scripts/check-mfe-drift.ts` (orphan detection), `packages/codegen/src/validate.ts`
(the new rule), `packages/framework-react/src/runtime/useControlPlaneState.ts`.

**Worth knowing:** this PR also fixes a jest `testMatch` that excluded `.tsx`, so a set of
tests had never run. Expect new test output rather than changed test output.

---

## PR 2 — `@falese/smt-*` namespace and registry-based package delivery

`1547a1f`..`543733f`. **The high-risk one, and the right target for a mechanical
reviewer.** 475 files, of which 235 are regenerated `examples/**` output that has to
travel with the rename.

Governed by ADR-083 (namespace), ADR-084 (two delivery lanes), ADR-085 (compile contract).

**Contains a breaking rename.** Every platform package moved to `@falese/smt-*`. The
review question is not "is the rename correct in spirit" — CI answers that — but **"is
there a specifier the sweep missed"**. That is exactly the kind of thing 475 files hides.

**Where the real logic changed** (the rest is rename + regeneration):

| File | What |
|---|---|
| `packages/codegen/src/lockfile.ts` | new — lockfile lane-independence |
| `scripts/build-registry-mirror.ts` | new — static registry mirror baked into the CLI image |
| `scripts/serve-registry-mirror.js` | new — serves it |
| `packages/codegen/src/validate.ts` | `runtime-declared` now rejects `file:` specifiers; `compile-contract-inherited` |
| `packages/codegen/src/platform-migrations.ts` | ADR-082 migration entries |
| `packages/codegen/src/unified-generator.ts` | generated slots bind the published `DeclaredSlot` |

**Two findings already fixed inside this range**, both worth understanding before
reviewing the rest:

- `npm ci` ignores `.npmrc` scoped registries — it follows lockfile `resolved` URLs. An
  earlier "pass" was npm cache masking it. Fixed by stripping `resolved`, keeping
  `integrity`.
- Moving runtime output to `dist/` broke every generated MFE under
  `moduleResolution: "node"`, which ignores the `exports` map. Found only by re-running
  the demo — jest uses `moduleNameMapper` and typecheck uses tsconfig paths, so **both
  bypass the published layout**. Fixed with root-level forwarders plus a test asserting
  on the shipped `files` list.

---

## PR 3 — ADR-000 and twelve conformance packs

`c7d24ad`..`bc448ab`. Additive and self-contained. 78 of 93 files are hand-written, and
most of that is test code.

**This is the one that wants a human**, because its value is judgment: is a given check
meaningful, and in each case was the *code* fixed or the *ADR* quietly excused? A reviewer
confirming the tests pass adds little — they passed before they were meaningful, twice.

### The six real behaviour changes

CI covers everything else. These are the files where runtime behaviour differs:

| File | Change | Consequence if wrong |
|---|---|---|
| `packages/runtime/src/base-mfe.ts` | `try`/`finally` around the lifecycle hook loop | a throwing hook stranded the re-entrancy guard, silently killing that lifecycle for the instance's life |
| `packages/oclif-base/src/BaseCommand.ts` | `mutatingFlags` with `--dry-run`, **no short char** | **breaking**: `-d`/`-D` no longer mean dry-run |
| `src/mcp/server.ts` | envelope located as the last parseable stdout line | a successful `deploy` was reported to agents as system error 69 |
| `packages/contracts/src/child-stdio.ts` + 12 call sites | children no longer inherit fd 1 under `--json` | grandchild output was polluting the envelope channel |
| `packages/codegen/src/validate.ts` | slot scan filtered by file ownership | `slots-implemented` went vacuous on first build |
| `src/commands/mfe/validate.ts`, `scripts/check-mfe-drift.ts` | resolve the framework variant | `check-mfe-drift` **writes** what it generates; a third-party-framework MFE would have been overwritten with React output |

### What to actually check in the packs

Each pack's docstring states what it does **not** cover. Those statements are the load
bearing part — please push on any that reads as broader than the checks support.

Every check was proven able to fail by breaking the thing it guards, one at a time, and
the breaks are recorded in the commit messages. **Four times a break-test caught a check
of mine that was silently vacuous:**

- ADR-019's boundary check matched only `from '…'`, missing bare side-effect imports
- ADR-061's check 5 used a substring test that a rename slipped past
- ADR-061's check 4 compared `deriveBuiltinVariant` against *itself*
- ADR-072's published-component check asserted `id: string` against the whole file and
  matched an unrelated declaration

That ratio is the honest signal about how much a green pack is worth on its own.

### One number to read carefully

The backlog went **50 → 23** by two different routes, and `conformance-remediation.md`
separates them deliberately:

- **50 → 37 is work** — twelve packs and the defects they found.
- **37 → 23 is scope correction** — `enforced-claims-a-gate` was demanding checkers from
  superseded, deferred and unbuilt decisions. It now attaches at `status: Implemented`.
  Verified not to be a loophole: flipping a pruned `Proposed` ADR to `Implemented` fails
  immediately, because the list only shrinks and it is no longer on it.

---

## Known open, carried forward

Not defects introduced here — things found and deliberately not fixed:

- **`bun bin/dev.ts` executes `dist/`**, so ADR-020's "zero-transpile development loop" is
  false. Narrowed to the root using oclif's `strategy: "pattern"` where the bff plugin uses
  the default; adding `ts` to the globs did not fix it, so the rest is inside `@oclif/core`.
  Needs a discovery-strategy decision, so the unverified config edit was reverted rather
  than shipped.
- **`examples/**` is typechecked by nothing** — root `tsconfig.json` excludes it. A slot
  rename leaving stale app code passes every gate; only `mfe:validate --typecheck` catches
  it, and nothing runs it. Wiring it into CI needs ~21 per-example installs.
- **bff-plugin's hand-written mirror of `DataConfigSchema`** — adding a field to the
  canonical schema without mirroring it is undetected. The named guard catches what the
  plugin *emits*, not what the schema *gains*.
- **The registry's copy of the slot grammar** stays a copy until `@falese/smt-contracts` is
  published (MERGE-PLAN Phase 1). It is now behaviourally pinned rather than trusted.

## Verification

All gates green at `bc448ab` (PR 3's tip): `lint`, `typecheck`, 170 suites / 2864 tests,
`build` with `schemas/` unchanged, `check:adr`, `check:adr-conformance` (12 packs / 118
tests), `check:mfe-drift:check`, `check:mfe-consistency`, `docs:check-links`.

Each earlier tip records its own gate run in its commit message. Those runs were made at
the time each commit landed and have **not** been re-run against the split branches — CI
on PRs 1 and 2 is the check that matters there.
