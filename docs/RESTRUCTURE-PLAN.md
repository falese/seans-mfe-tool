# Codebase Restructure Plan

_Prepared 2026-07-01 from a review of the working tree, 6 open PRs, and 47 open issues._

This document has three parts:

1. **A reorganization plan** — how to restructure the repo into something a new contributor (or agent) can understand in one sitting.
2. **A prioritized merge / prune / create list** — every open PR and the significant issues, sorted into "land it", "kill it", or "build it", with a suggested order.
3. **A Fable simplification prompt** — a ready-to-paste brief that reduces the codebase ~65% while keeping every shipped feature.

---

## 0. What the review found (the numbers)

| Area | Measured | Observation |
|---|---|---|
| Source (`src/**`, incl. tests) | ~29,300 LOC, 107 test files | Runtime alone is 12,938 LOC / 32 files |
| Packages (`packages/**/src`) | ~2,560 LOC across 5 packages | Fine; contracts (1,537) is the anchor |
| Docs (`docs/**` + 7 root `.md`) | **173 files, ~48,700 lines** | Docs are **1.6× the size of the code** |
| ADRs | **59** ADRs + register | Many superseded/partially-superseded, still in the "current" set |
| Examples | abc-kids 481 files, **archive 168**, api-examples 80, inner-voice 45 | ~770 files; `archive/` is pure dead weight |
| Open PRs | 6 | 2 trivial/bot, 1 off-product, 1 stale draft, 2 real |
| Open issues | 47 | Several overlapping epics + already-done work still open |

**The core problem is not the code — it's the ratio of scaffolding to substance.** The platform contract is genuinely small and clear (10 capabilities, one lifecycle machine). It is buried under: a doc tree larger than the code, a parallel per-framework runtime that duplicates ~1,600 lines, an inlined contract mirror that is a known drift source, a 1,214-line generator "God file", and an off-product LLM sub-app (`inner-voice`/coder) living in the same tree.

---

## 1. Reorganization plan

### 1.1 Guiding principle

Make the repo legible top-down: **contract → generator → runtime → CLI**, with everything else (docs, examples, experiments) clearly subordinate and prunable. A reader should reach "I understand the platform" from the README + `packages/contracts` + one runtime base class, without touching 59 ADRs.

### 1.2 Target top-level layout

```
seans-mfe-tool/
├── README.md                 # the ONLY narrative entry point at root
├── CLAUDE.md                 # agent memory (stays)
├── packages/
│   ├── contracts/            # THE source of truth: envelope, errors, messages, lifecycle types
│   ├── oclif-base/           # BaseCommand
│   ├── runtime/              # ← promote src/runtime here (see 1.3); the single home of BaseMFE
│   ├── codegen/              # ← extract src/codegen here (issue #140); zero-dep generator
│   ├── framework-react/      # thin plugin: React/rspack adapter
│   ├── framework-angular/    # thin plugin: Angular/webpack adapter
│   └── bff-plugin/           # BFF (finish #126–130 migration, delete shims)
├── src/                      # ONLY the CLI now: commands/, hooks/, oclif/, mcp/, dsl/
├── examples/
│   └── abc-kids/             # the ONE canonical, tested example
├── docs/
│   ├── spec.md               # the spec
│   ├── architecture-decisions/  # ADRs (accepted-only in root; superseded moved down)
│   │   └── superseded/
│   ├── guides/               # authoring, troubleshooting, runbooks
│   └── archive/              # frozen; excluded from link-hygiene + search
└── (config: tsconfig, eslint, jest, turbo — unchanged)
```

### 1.3 Concrete moves

1. **Promote the runtime to a real package.** `src/runtime/` is already a workspace member (`pnpm-workspace.yaml` lists `src/runtime`) but lives under `src/`, which reads like CLI code. Move it to `packages/runtime/` so the four first-class packages (contracts, oclif-base, runtime, codegen) are visibly the platform, and `src/` is unambiguously "the CLI".

2. **Delete the inlined contract mirror.** `src/runtime/contracts.ts` is a hand-maintained copy of `@seans-mfe/contracts` (its own header admits it "must stay STRUCTURALLY compatible… until published"). This is the single largest source of correctness risk — PR #235 exists *only* to fix drift in it. Publish or `file:`-link `@seans-mfe/contracts` and import it for real. (See §3 for how Fable does this without breaking Docker staging.)

3. **Collapse the two runtime front-ends.** `remote-mfe.ts` (790) and `angular-remote-mfe.ts` (796) share almost their entire method surface (`init`, `get`, `sendAction`, `extractCapabilities`, `getSharedDependencies`, `unmount`, mount/error-boundary). Factor a `BaseRemoteMFE` holding the framework-neutral logic; each framework file becomes a thin `mountComponent()`/`getSharedDependencies()` adapter (this is exactly the framework-plugin model the project already committed to in ADR-036).

4. **Break up the generator God file.** `codegen/UnifiedGenerator/unified-generator.ts` (1,214 LOC) mixes manifest→data mapping, template selection, and file emission. Split into `plan()` (manifest → render model), `render()` (model → EJS), `emit()` (files), driven by template metadata — and extract the whole thing to `packages/codegen` (issue #140, already scoped).

5. **Consolidate root markdown.** Move `PLATFORM-CONTRACT.md`, `PLUGIN-CONTRACT.md`, `MERGE-PLAN.md`, `DEVIN.md`, `session-prompt.md` into `docs/` (e.g. `docs/contracts/`, `docs/planning/`). Leave only `README.md` + `CLAUDE.md` at root. Seven top-level narrative files is five too many.

6. **Freeze and quarantine archives.** `examples/archive/` (168 files) and `docs/archive/` (35) should be excluded from lint, typecheck, link-hygiene (#231), and default search — or deleted outright if git history is deemed sufficient. They currently inflate every "how big is this" signal.

7. **Move `inner-voice`/coder out of the tree.** `examples/inner-voice/` + the coder LLM-persona wiring (PR #205) is a *different product* (a local-LLM "thinking" UI), not a domain-capability MFE. It should live in its own repo or `Falese/coder`. Keeping it here is the clearest example of scope bleed.

8. **Curate the ADR set.** 59 ADRs with several superseded (ADR-056 partially by ADR-060, etc.). Move superseded ADRs to `docs/architecture-decisions/superseded/`, keep the register (`README.md`) as the index, and make "accepted + active" the default view. Don't delete history; stop presenting retired decisions as current.

### 1.4 Why this order is safe

Each move is independently landable and reversible. Moves 1, 5, 6, 7, 8 are pure relocations (no behavior change, cheap to review). Moves 2, 3, 4 are the real engineering and should each carry an ADR reference and their existing tests.

---

## 2. Prioritized merge / prune / create list

### 2.1 Open PRs — disposition

| PR | What it is | Verdict | Why |
|---|---|---|---|
| **#235** ADR-060 Contextualized VM Composition | Large runtime + ADR reconciliation; realigns the inlined mirror | **MERGE (P0, first)** | It fixes the mirror drift and lands the composition model everything else builds on. Gates couldn't run in-session — **require green CI before merge.** |
| **#191** Error boundaries (REQ-RUNTIME-011, Closes #58) | Real runtime feature, tests included | **MERGE (P1)** — after rebasing onto #235 | Touches the same runtime front-ends #235/§1.3 refactor; land it, then it becomes part of the `BaseRemoteMFE` collapse. |
| **#232** Stale `query()` comment (CA-4, Closes #229) | Comment-only bot fix | **MERGE (P2)** or fold into #235 | Trivial and correct; zero risk. Don't let it linger. |
| **#192** Playwright E2E for abc-kids | 14 tests, needs docker-compose | **MERGE (P2) with a CI caveat** | Valuable, but wire it as an optional/manual job — CI can't run docker-compose today. Merge the tests; gate them behind a compose service or mark non-blocking. |
| **#153** shell:init orchestration (Copilot draft) | Stale draft, ADR-068–071 | **PRUNE / rework** | Draft since April, only two checkboxes done, depends on ADRs not in the current set. Close and re-open from a fresh issue if shell:init is still wanted (#144 covers it). |
| **#205** inner-voice sessionId + persona dial | Off-product LLM UI wiring | **PRUNE (move to coder repo)** | Not a platform change (see §1.3.7). Close here; relocate with the example. |

### 2.2 Issues — prune (already done or obsolete)

Verify and close:

- **#58** Error boundaries — has PR #191; close on merge.
- **#229** stale comment — has PR #232.
- Cross-check the CLAUDE.md "✅ Done" streams against still-open issues: oclif migration, codegen+DSL, GraphQL BFF, framework plugin system are marked done but several backlog issues (#15–38 registry/discovery/health/secrets/RTK/interactive) predate them and may be stale. **Audit #15–38 first — expect ~half to be closable.**

### 2.3 Issues — the real backlog, grouped and prioritized

**P0 — pay down the structural debt (do these before more features):**
- **#140** Extract `@seans-mfe/codegen` as a zero-dep package → enables §1.3.4 and unblocks the generator split.
- **#126–130** Finish the `@falese/bff-plugin` migration and **remove the shims** → deletes a whole class of duplicated BFF code.
- (New) **Delete `src/runtime/contracts.ts`; depend on published/linked `@seans-mfe/contracts`** → kills the drift source (§1.3.2). *File this as a tracked issue.*
- (New) **`BaseRemoteMFE` collapse** (§1.3.3). *File this.*

**P1 — the "two-headed / DX" epic (#139), coherent and worth finishing:**
- **#141** JSON Schema + structured validation, **#142** capability shapes, **#143** universal `--json/--dry-run/--no-interactive` + `status`, **#148** structured build feedback, **#147** `explain`, **#146** `system:map`, **#145** audit log + ownership markers, **#144** `shell:init`. These are the product's differentiator; keep them together.

**P2 — runtime/lifecycle correctness:**
- **#204** (bug) generated bootstrap fails `tsc` — missing Context fields. **Bug, fix soon.**
- **#199** (bug) bff:init standalone omits demo-mode files.
- **#209** drop `.tsx` import extensions (ts5097), **#208** ESLint warning cleanup (276) — cheap hygiene.
- **#62/#63/#64** lifecycle handlers (parallel / conditional / inter-hook), **#57** caching handler.

**P3 — larger initiatives, schedule explicitly or defer:**
- **#66/#70/#71/#72** GraphQL Mesh TS migration epic — real but large; confirm it's still wanted before investing.
- **#15–38** legacy backlog — audit, close the stale, re-scope the survivors.

### 2.4 Create (new issues to file)

1. Delete inlined `runtime/contracts.ts`; real dependency on contracts (P0).
2. `BaseRemoteMFE` collapse of React/Angular front-ends (P0).
3. Split `unified-generator.ts` into plan/render/emit (P0, pairs with #140).
4. Quarantine/delete `examples/archive` + `docs/archive`; exclude from tooling (P1).
5. Promote `src/runtime` → `packages/runtime`; move root contract docs into `docs/` (P1).
6. ADR curation: move superseded ADRs to `superseded/` (P2).
7. Extract `inner-voice`/coder to its own repo (P2).

---

## 3. Fable simplification prompt (target: −65% LOC, zero feature loss)

Paste the block below to Fable. It is scoped, ordered, and has explicit invariants so "simplify" never becomes "delete a feature."

---

> **Task: reduce this codebase by ~65% while preserving every shipped feature and every passing test's intent.**
>
> **Hard invariants (never violate):**
> - Every capability in the platform contract stays: `load, render, refresh, authorizeAccess, health, describe, schema, query, emit, updateControlPlaneState` (the 10 in README §"platform contract"), plus the lifecycle state machine (ADR-042) and lifecycle phases (ADR-002).
> - Both React (rspack) and Angular (webpack) MFE generation + runtime keep working end-to-end against `examples/abc-kids`.
> - The `--json` single-line `CommandResult<T>` envelope, typed errors (`ValidationError`/`BusinessError`/`NetworkError`/`SystemError`/`TimeoutError`/`SecurityError`), and the MCP child-process-per-tool-call model are unchanged.
> - No new `any`. TDD: keep the existing tests green; when you merge code, merge or port its tests — don't drop coverage.
> - Run and pass, in order, on each step: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run build:schemas && git diff --exit-code schemas/`.
>
> **Where the 65% comes from (do these in order, one PR each, tests green between):**
>
> 1. **Kill the contract mirror (correctness + LOC).** Delete `src/runtime/contracts.ts`. Make `@seans-mfe/contracts` a real dependency (publish, or `file:`/workspace link, and stage it into the MFE `node_modules` the same way `dist/runtime` is staged — see `scripts/copy-runtime-files.js` and `scripts/remove-dist-shims.js`). All barrel-reachable runtime modules import the real package. This removes a whole duplicated type set and the drift class that PR #235 had to hand-fix.
>
> 2. **Collapse the two runtime front-ends.** `remote-mfe.ts` and `angular-remote-mfe.ts` (~1,600 LOC) share nearly their whole method surface. Extract `BaseRemoteMFE` with all framework-neutral logic (`init`, `get`, `sendAction`, `extractCapabilities`/`extractAvailableComponents`, `getSharedDependencies`, `unmount`, error-boundary/telemetry). Each framework file shrinks to a thin adapter overriding only `mountComponent()` and the shared-deps map — exactly the ADR-036 framework-plugin model. Target: ~60% off those two files.
>
> 3. **Split the generator God file.** `codegen/UnifiedGenerator/unified-generator.ts` (1,214 LOC) → three small units: `plan(manifest) → RenderModel`, `render(model) → files` (pure EJS), `emit(files)`. Push per-framework/per-capability differences into template metadata/data, not `if` branches. Keep every generated artifact byte-identical (snapshot-test the abc-kids output before and after).
>
> 4. **Finish the BFF-plugin migration and delete the shims.** Land the `@falese/bff-plugin` extraction (issues #126–130) so `bff:init/dev/build/validate` live in the plugin; delete the in-tree shim commands and `_shared.ts` duplication.
>
> 5. **Slim the big command files.** `commands/deploy.ts` (822) and `commands/api.ts` (755) — extract shared helpers, remove dead branches, and lean on `BaseCommand` for flag/envelope/error plumbing instead of re-implementing it per command.
>
> 6. **Quarantine dead weight (LOC + cognitive load).** Remove `examples/archive/` (168 files) and `docs/archive/` (35) from the tree (git history preserves them) or exclude them from lint/typecheck/test/search. Move `examples/inner-voice/` out — it's a different product. Consolidate the 7 root `.md` files down to `README.md` + `CLAUDE.md`, relocating the rest under `docs/`.
>
> 7. **Curate ADRs.** Move superseded/retired ADRs into `docs/architecture-decisions/superseded/`; keep the register as the index. Don't lose decisions — stop presenting retired ones as current.
>
> **Method:** work module-by-module. Before each change, capture a characterization test (snapshot the abc-kids generated output, or the command's `--json` envelope) so "preserves behavior" is machine-checked, not asserted. After each step, report LOC delta and confirm all gates pass. Stop and ask before any change that would alter a generated artifact, a public capability signature, or the envelope/error contract.
>
> **Definition of done:** total non-archive `src/**` + `packages/**` LOC down ~65%, abc-kids builds and runs both frameworks, all gates green, no feature or capability removed.

---

### Notes on the 65% target

The reduction is credible because the biggest line-count sinks are *duplication and dead weight*, not features:

- Contract mirror + BaseRemoteMFE collapse: ~1,800–2,000 LOC of true duplication removed.
- Generator split + BFF shim removal: net reduction once template-driven.
- Archives (`examples/archive` 168 files, `docs/archive` 35) and off-product `inner-voice` (45 files): large file-count reduction with zero feature impact.
- Root/ADR doc consolidation: ~48,700 lines of docs is the single largest surface; curation (not deletion of decisions) is where the "understandability" win is largest even if it isn't counted as `src` LOC.

If the 65% is measured over **code only** (excluding docs/examples), items 1–5 carry it; if measured over the **whole repo**, items 6–7 dominate. State which denominator you're using when you report progress.
