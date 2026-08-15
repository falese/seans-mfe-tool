# Gate Self-Verification Audit

The `breaking-change-regeneration-dx-report.md` incident showed two gates cited
as evidence of platform rigor — `mfe:validate`/`check:mfe-consistency` and
`check:mfe-drift` — were each either structurally incapable of catching a class
of failure, or scoped by design to miss it. ADR-082 closed that specific gap
for *declared* breaking changes. This report audits the remaining gates the
same way: for each, make the smallest reversible change that should, if the
gate's claim is true, turn it red; run the gate; record what actually
happened; revert. Every result below is a real command run against this
repository, not a prediction.

Legend: ✅ confirmed — the gate does what it claims · 🕳️ blind spot — the gate
stayed green over a real problem · 🔧 fixed in this pass

---

## `npm run lint`

**Claim:** lints the codebase.

**Break:** an obvious violation (`if (1 == 1)`, unused var) in
`packages/codegen/src/validate.ts` and `scripts/check-mfe-drift.ts`.

```
> eslint src jest.setup.js
exit=0
```

The same violation placed inside `src/commands/mfe/validate.ts` instead:

```
/home/user/seans-mfe-tool/src/commands/mfe/validate.ts
  1:36  error  Unexpected constant condition  no-constant-condition
✖ 1 problem (1 error, 0 warnings)
exit=1
```

🕳️ **Blind spot, by explicit scope.** `lint` runs `eslint src jest.setup.js` —
nothing else. `packages/*/src`, `scripts/*.ts`, and `examples/**` are not
linted at all. A style/correctness violation in any workspace package or in
the CI-gate scripts themselves (including the scripts this audit touches) is
invisible to this gate. Not a bug — `package.json`'s script says exactly what
it does — but "lint" reads as "the codebase," not "one directory of it."

## `npm run typecheck`

**Claim:** the CLI tree and `packages/runtime` are type-clean (#341 closed the
runtime-source gap that the DX report's punch-list item 6 flagged).

**Break (a) — runtime source:**

```
packages/runtime/src/base-mfe.ts(294,7): error TS2322: Type 'string' is not assignable to type 'number'.
exit=2
```

✅ **Confirmed.** #341 holds — a type error in `packages/runtime/src/base-mfe.ts`
fails `typecheck`.

**Break (b) — runtime test file:**

```
=== npm run typecheck (type error only in a runtime *.test.ts) ===
exit=0

=== npm test (same file) ===
PASS packages/runtime/src/base-control-plane.test.ts
Tests: 25 passed, 25 total
exit=0
```

🕳️ **Blind spot, documented but easy to trust past.** A genuine type error
(`const x: number = 'not-a-number'`) placed only inside a `*.test.ts` under
`packages/runtime/src` is invisible to *both* `typecheck` (tests aren't in
either `tsconfig.typecheck.json` project) and `test`/`test:ci` (`ts-jest` runs
with `isolatedModules`, which transpiles without type-checking). CLAUDE.md
already states this ("Runtime **tests** are still checked by neither"), but
stating it and a developer internalizing it before they lean on the wrong gate
are different things — this confirms the gap is real, not theoretical.

## `npm test` / `npm run test:ci` (coverage)

**Claim:** an 80% global coverage floor keeps the codebase tested.

**Break:** a brand-new exported function with an untested branchy body,
appended to `packages/contracts/src/envelope.ts` — a file `collectCoverageFrom`
in `jest.config.js` does not include (`packages/contracts`, `packages/oclif-base`,
`packages/bff-plugin`, `packages/framework-react`, `packages/framework-angular`,
and most of `packages/codegen`, are all outside the allowlist).

```
Test Suites: 145 passed, 145 total
Tests:       2618 passed, 2618 total
exit=0
```

The coverage table printed by the run never mentions `packages/contracts` at
all — the file isn't a blind spot the threshold happens to tolerate, it is
outside the set the threshold is computed over.

🕳️ **Blind spot, by allowlist.** The 80% floor is real and does gate the files
it's told to look at (`src/commands/*`, `src/utils/**`, two `src/codegen/*`
subtrees, `src/build/**`, `packages/dsl/src`, `packages/runtime/src`) — but
five whole packages can go to 0% coverage on new code without moving the
number the gate reads.

## `npm run build`

**Claim:** compiles cleanly; this is the gate that once caught a "subset
build" silently producing a zero-command CLI.

**Break:** a type error in `packages/dsl/src/parser.ts` (one of the seven
packages `build:packages` compiles).

```
packages/dsl/src/parser.ts(20,7): error TS2322: Type 'string' is not assignable to type 'number'.
exit=2
```

✅ **Confirmed.** `build` fails immediately at `build:packages`, before
`oclif manifest` or `build:schemas` even run.

## `check:mfe-consistency` / `mfe:validate` — the `platform-migrations` rule (ADR-082)

**Claim (post-incident):** a breaking platform change that reaches
developer-owned code is reported as a warning, provided it's declared in
`PLATFORM_MIGRATIONS`.

**Break (a) — declared migration:** reintroduced a raw
`throw new Error('probe...')` into `examples/meridian-station/meridian-console/src/index.tsx`
(developer-owned), with the real `typed-errors` entry still registered:

```
  ⚠ platform-migrations
      - Throwing a raw `Error` — the platform classifies failures by error type,
        so this is reported as `unknown` and never retried (ADR-017) src/index.tsx:69
        fix: Throw a typed error from '@seans-mfe-tool/runtime': ValidationError...

meridian-console is consistent, with 1 platform-migration warning(s).
exit=0   (warning, not failure — by design; --strict would escalate)
```

✅ **Confirmed — ADR-082 works when declared.** File, line, and fix all
surfaced exactly as designed, at both `mfe:validate` and (transitively)
`check:mfe-consistency`.

**Break (b) — same code, entry removed:** temporarily deleted the
`typed-errors` entry from `PLATFORM_MIGRATIONS`, kept the identical raw
`throw new Error(...)` in place:

```
  ✓ platform-migrations

meridian-console is consistent.
exit=0   ({"ok":true,"data":{...,"issues":[]},"warnings":[]})
```

🕳️ **Confirmed residual boundary — not a regression.** The exact same
developer-owned code that (a) surfaced a warning for is completely invisible
once nobody declared it. This is the stated limit of ADR-082 ("the registry
is hand-maintained... a change that forgets to declare an entry is invisible
exactly as before") — reproduced here on demand, not discovered by accident.
The fix for the *specific* incident holds; the *general* shape of the
incident (an undeclared breaking change reaching developer-owned code) is
still exactly as invisible as it was before ADR-082, by design, because
nothing enforces that an entry gets added.

## `check:mfe-drift`

**Claim:** generator-owned files always match a fresh regeneration from
`mfe-manifest.yaml`.

**Break (a) — baseline:** hand-edited a generator-owned file
(`meridian-console/src/platform/base-mfe/mfe.ts`):

```
DRIFT examples/meridian-station/meridian-console
  STALE: examples/meridian-station/meridian-console/src/platform/base-mfe/mfe.ts
exit=1
```

✅ **Confirmed** — this is the gate's known-good baseline, unchanged since the
DX report.

**Break (b) — new finding:** removed `data:` from `examples/abc-kids/flappy`'s
manifest (an MFE that *had* a real BFF: `.meshrc.yaml`, `server.ts`,
`src/platform/bff/*`), leaving those files on disk, then ran the check:

```
DRIFT examples/abc-kids/flappy
  STALE: examples/abc-kids/flappy/src/platform/base-mfe/bootstrap.ts

Generator-owned drift detected in 1 file(s).
exit=1
```

Only `bootstrap.ts` was named — correctly, since its *content* depends on
`hasBff` and now disagrees with what's on disk. `server.ts`, `.meshrc.yaml`,
and all five files under `src/platform/bff/` were not mentioned at all,
despite still being on disk and no longer being anything the current manifest
would generate.

🕳️ → 🔧 **Confirmed, and it was already live in the repo, not just
reproducible.** `examples/abc-kids/*` had exactly this shape in 12 MFEs: no
`data:` in the manifest, yet each still carried a root-level `server.ts`
importing `./.mesh` (which cannot exist without a `.meshrc.yaml`, which none
of the 12 had) and citing ADR numbers from before a renumbering (ADR-046,
ADR-062 — the current equivalents are different ADRs entirely). `lint`
doesn't reach `examples/**`; `check:mfe-consistency` checks manifest⇄package.json
agreement, not extraneous files; `check:mfe-drift` only compares paths the
*current* generation produces. All three gates were green over 12 files of
dead code simultaneously. Fixed in this change — see "Fix" below.

## `build:docs`

**Claim:** the public API reference (`docs/api`) stays current.

**Break:** added a brand-new exported function to
`packages/dsl/src/parser.ts` (no existing call sites, so nothing else broke) —
`packages/dsl` is not one of `typedoc.json`'s four entry points
(`packages/contracts/src/index.ts`, `packages/runtime/src/{index,react,angular}.ts`).

```
> typedoc && git diff --exit-code docs/api
[info] markdown generated at ./docs/api
exit=0
```

🕳️ **Confirmed, and already an acknowledged boundary.** A real, new public
export produced zero diff and a clean exit. ADR-065 explicitly scopes typedoc
to those four entry points and defers Phase 3 (API Extractor `.api.md`
change-detection, which would catch this generically) — so this is a stated
limitation surfaced concretely, not a new discovery. `packages/dsl`,
`packages/codegen`, `packages/oclif-base`, and `packages/bff-plugin` all sit
outside this gate's reach.

## `check:adr`

**Claim:** ADR frontmatter and cross-references stay internally consistent.

**Break (a) — baseline:** added a citation to a nonexistent `ADR-999` in
`ADR-017-typed-error-hierarchy.md`'s body:

```
  ✗ reference-resolves — 1
      - docs/architecture-decisions/ADR-017-typed-error-hierarchy.md:78
        cites ADR-999, which is not in the library
exit=1
```

✅ **Confirmed.**

**Break (b) — gloss heuristic:** changed a citation gloss from the real title
("ADR-030: Error Classification **with Hybrid Detection**") to a fabricated
but token-overlapping one ("ADR-030: Error Classification **and Retry
Scheduling**") — sharing "Error" and "Classification" with the real title
while asserting something the ADR doesn't say:

```
  ✓ reference-gloss-matches
ADR library is consistent.
exit=0
```

🕳️ **Confirmed, matches ADR-075's own stated boundary.** `reference-gloss-matches`
is token-overlap, not comprehension — ADR-075 says so directly ("it will miss
a stale reference that happens to share a word with its new target"). Here it
is, reproduced: a citation that describes the wrong thing passes cleanly
because it shares two words with the right thing.

**Break (c) — examples exclusion:** added a citation to a `Proposed` (non-ratified)
ADR inside `examples/abc-kids/home/src/remote.tsx`:

```
=== default ===
ADR library is consistent.
exit=0

=== --include-examples ===
  ✗ code-cites-ratified-adr — 13
      - examples/abc-kids/home/src/remote.tsx:2
        cites ADR-028, which is Proposed...
      - examples/abc-kids/animal-sounds/server.ts:4
        cites ADR-046, which is Proposed...
      (11 more, one per abc-kids/*/server.ts)
exit=1
```

🕳️ **Confirmed, and it corroborates the `check:mfe-drift` finding above.**
`examples/**` is excluded from `check:adr` by default. Turning the flag on
didn't just catch the injected probe — it also caught the *same 12 orphaned
`server.ts` files* from the `check:mfe-drift` finding, each independently
citing ADR-046, a `Proposed` (never-ratified) decision, in its header comment.
Those 12 files were invisible to `lint` (scope), `check:mfe-drift` (not in the
current generated set), `check:mfe-consistency` (wrong kind of check), and
`check:adr` (examples excluded by default) — four gates, one blind spot,
zero overlap in why each missed it. Deleting the files (see "Fix" below) also
resolved these 12 `check:adr --include-examples` hits as a side effect.

## `check:template-typecheck`

**Claim:** a `tsc --noEmit` pass against a fresh, `npm install`-ed scaffold
catches compile-level template drift the string-level contract test can't.

```
[react] OK
All 1 template lane(s) typecheck cleanly from a fresh, installed scaffold.
exit=0
```

✅ **No deep break needed.** Its own header comment already states the scope
precisely ("deliberately no `data:` section — BFF gating is already the
cross-framework contract test's job") — this is a gate that documents its own
boundary correctly rather than implying more than it does.

## `build:adr-index`

**Claim:** the generated ADR index and PDR map match ADR frontmatter.

**Break:** malformed YAML frontmatter (`status: [unparseable, not a valid
enum`) in `ADR-017`, run directly without `check:adr` first:

```
Error: ADR-017-typed-error-hierarchy.md does not parse (invalid-yaml) —
run `npm run check:adr` first
exit=1
```

✅ **Correctly red, but not independently diagnostic.** It does fail — this is
not a blind spot — but the failure is a raw thrown error and a redirect to run
a different command, not a report of its own. This is an ordering dependency
(`readAdrs()` explicitly defers parse-failure diagnosis to `check:adr`), not a
gap in what gets caught.

---

## Fix applied in this pass: `check:mfe-drift` orphan-file detection

`packages/codegen/src/drift.ts` gained `findOrphanedGeneratedFiles`: given the
MFE's real generation and a *maximal* generation of the same manifest (the
same manifest with `data` forced present, to learn every generator-owned path
the manifest's shape could produce), it flags any such path that exists on
disk but is absent from the real generation. `scripts/check-mfe-drift.ts`
wires this in and reports `ORPHANED: <path>` in `--check` mode (same exit-1
behavior as `MISSING`/`STALE`); in write mode it reports orphans without
deleting them — the same "warn, don't rewrite" posture ADR-082 already
established for developer-owned files, applied here to the disk-vs-manifest
direction instead.

This closes a gap in `check:mfe-drift`'s own scope (ADR-043's
idempotent-regeneration invariant, #295) rather than introducing new
architecture, so no new ADR was needed — the fix is cited to ADR-043 in the
commit.

The 12 stale `examples/abc-kids/*/server.ts` files found live during this
audit were deleted in the same change. Before: `check:mfe-drift:check` over
`examples/abc-kids` reported 12 `ORPHANED` files. After: clean, and the
`check:adr --include-examples` hits on the same files (break (c) above)
resolved as a side effect. `check:mfe-drift:check`, `check:mfe-consistency`,
and `check:adr` all pass repo-wide after the fix; the full test suite (2623
tests, up 5 for the new `findOrphanedGeneratedFiles` coverage) and `npm run
build` are unaffected.

## What held up

Worth recording, since an audit that only lists blind spots misrepresents the
result:

- `lint`, `typecheck` (source), `build`, `check:mfe-drift` (stale/missing),
  and `check:adr` (reference-resolves) all turned red exactly when they
  should have, on the first try, with no coaxing.
- ADR-082 is not just documented as working — it demonstrably surfaces a
  reintroduced raw `throw new Error` with file, line, and fix, at both
  `mfe:validate` and `check:mfe-consistency`, the moment the pattern is
  declared.
- Every blind spot found either matches a limitation the relevant ADR already
  states in writing (ADR-075's gloss heuristic, ADR-065's typedoc scope,
  ADR-082's hand-maintained registry) or was closed in this same pass
  (`check:mfe-drift`'s orphan gap). None of the nine gates audited claims
  something about itself that isn't true when tested — the gaps are all
  *unstated scope*, not *false claims*.

## Punch list (not fixed in this pass)

1. 🕳️ **Runtime test files are typechecked by nothing.** Neither `typecheck`
   nor `test`/`test:ci` catches a type error confined to a
   `packages/runtime/src/*.test.ts` file. Options: add a third `tsc --noEmit`
   project scoped to `packages/runtime/src/**/*.test.ts`, or drop
   `isolatedModules` for that project in `jest.config.js`.
2. 🕳️ **Coverage allowlist excludes five packages entirely**
   (`packages/contracts`, `packages/oclif-base`, `packages/bff-plugin`,
   `packages/framework-react`, `packages/framework-angular`, most of
   `packages/codegen`). New code there can ship at 0% coverage without moving
   the global threshold.
3. 🕳️ **`lint` doesn't reach `packages/*/src`, `scripts/*.ts`, or
   `examples/**`.** Given `check:mfe-drift`'s orphan gap just proved
   `examples/**` can carry dead code invisibly for an unknown period, an
   ESLint pass limited to `src/` gives the same directory the same blind
   spot from a different angle.
4. 🕳️ **The `PLATFORM_MIGRATIONS` registry has no enforcement that an entry
   gets added.** ADR-082 states this in writing; break (b) above reproduces
   it on demand. A change reaching developer-owned code with no declared
   entry is exactly as invisible today as `throw new Error()` was before
   #320.
5. 🕳️ **`build:docs` doesn't cover `packages/dsl`, `packages/codegen`,
   `packages/oclif-base`, or `packages/bff-plugin`.** ADR-065 Phase 3 (API
   Extractor) would close this generically; it remains deferred.
6. Incidental, out of scope for this pass: even `examples/meridian-station/meridian-console`
   — the clean, no-BFF reference example — has `"main": "server.ts"` and a
   `"description"` mentioning "GraphQL BFF" in its `package.json`, despite
   never having had a `server.ts`. This looks like a stale codegen template
   default for `package.json`'s boilerplate fields rather than anything
   specific to the 12 deleted files. `package.json` is developer-owned
   (`overwrite:false`), so this is `mfe:validate`'s domain, not
   `check:mfe-drift`'s — worth a follow-up issue, not fixed here.
