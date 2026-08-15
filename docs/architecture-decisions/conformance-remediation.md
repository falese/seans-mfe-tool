# Conformance remediation — what changed to make these ADRs true

Companion to [ADR-000](./ADR-000-decisions-name-their-checker.md). ADR-000 requires a
decision claiming `enforcement: code` to name the checker that proves it. Applying it to
grandfathered decisions turned out not to be paperwork: **every ADR examined so far had
drifted, and five had shipped defects.**

Backlog: **50 → 23**, by two different routes that should not be conflated:

- **50 → 37 is work** — twelve packs written, and the defects below fixed.
- **37 → 23 is scope correction, not progress.** ADR-000 §1 originally demanded a
  checker from any ADR claiming `enforcement: code`, regardless of status. Fourteen
  of the remaining entries were never `Implemented` — one superseded, one deferred,
  eight proposed, four accepted-but-unbuilt — so a pack for them would have tested
  code that does not exist. The rule now attaches at `status: Implemented`. The
  backlog got smaller because it had been counting the wrong things, and saying so
  is the point: a debt number that flatters itself is worse than no number.

Packs live in `__conformance__/` beside the code they check and run via
`npm run check:adr-conformance`.

## What each pack found

| ADR | The claim | What was actually true | Fix |
|---|---|---|---|
| **001** Lifecycle re-entrancy guard | Guard tracks `{capability, phase}` and releases it | `executeLifecycle` pushed the pair, then popped **after** the hook loop. `executeHookEntry` throws by design, so a throwing main-phase hook stranded the pair for the life of the instance — every later call to that lifecycle logged "Re-entrant lifecycle detected" and returned early. The MFE kept serving with its hooks silently dead. | `try`/`finally` around the loop |
| **016** BaseCommand pattern | `--dry-run` "declared as a shared flag for mutating commands" | Not declared on `BaseCommand` at all. Six commands hand-rolled it and had already drifted: `-D` on `api`/`deploy`, `-d` on the four `remote:*`. But `-d` on `api` is `--database`, which takes a value — so a user who learned `-d` meant "preview" and typed it on `api` got no dry run; the flag ate the next token and **the command ran for real**. | `BaseCommand.mutatingFlags`, no short char |
| **018** One envelope line on stdout | Under `--json`, stdout carries exactly one `CommandResult` | Broken by most mutating commands. `redirectStdoutToStderr()` patches `process.stdout.write` **in-process**; `stdio: 'inherit'` hands the grandchild the real fd 1, which no JS patch can reach. 12 call sites across 4 packages leaked `npm install` / `docker build` / `mesh build` output onto the envelope channel. Its `verified-by` named `docs/cli-contract.md` — **a document**, which is why the gate was green the whole time. | `childStdio()` in contracts; `enforced-claims-a-gate` now rejects prose-as-gate |
| **019** MCP child-process isolation | Parse stdout, map `CommandResult.success` to the MCP response | `JSON.parse` over the whole buffer, so the ADR-018 leak above became `system` error 69 — reported for a `deploy` **whose container was already running**. Worst failure direction: side effects happened, the agent is told they didn't, retrying repeats them. `implemented-by` also never named `src/mcp/server.ts`, where the entire decision lives. | Walk back to the last line that parses as an envelope |
| **020** Bun dev / Node published split | Both entries "behave identically" | `bun bin/dev.ts <any command>` **failed outright** — `Cannot find module '@falese/smt-contracts'`. 23 subpaths across 7 packages declared only `require` + `types` in `exports`, with no `import`/`default`, so ESM resolution had nothing to select. Same defect faces published consumers: any ESM `import` gets `ERR_PACKAGE_PATH_NOT_EXPORTED`. Survived because `--version`/`--help` load no command module. | `default` condition on every conditional subpath |
| **045** Package manager / runtime pinning | npm authoritative; a checked-in Node pin; no stray pnpm metadata | Two of three "must"s false. No `.nvmrc`/`.node-version`/`.tool-versions` and no `engines` — CI said 20, Docker said 20, a new contributor was told nothing. `pnpm-workspace.yaml` still present, listing `packages/*` **and** `.` against npm's `packages/*`. | `.nvmrc` = 20; `pnpm-workspace.yaml` removed |
| **053** `RemoteMFE.doQuery` | Override removed; `BaseMFE.doQuery` is inherited | Held, but unverified — including that the template does not reintroduce it | Pack only |
| **056** Presentation boundary | Bright line, machine-checked | Held, and `boundary.test.ts` already proved it — the ADR simply never named it | `verified-by` only |
| **061** dsl/codegen as packages | "supported only through injection, which the CLI always does" | The CLI did not always do it. `mfe:validate` and `check-mfe-drift` called `generateAllFiles` with no variant, falling through to `deriveBuiltinVariant` — which can only answer `react-rspack` or `angular-webpack`. Latent until someone adds a third-party framework, and `check-mfe-drift`'s non-`--check` mode **writes** what it generates, so it would have overwritten such an MFE with React output. | Resolve the variant at both callers |
| **069** Slot grammar single-sourced | Tooling "can import the grammar from contracts instead of copying a regex" | Held inside the packages. The control-plane registry copies it — twice — sanctioned by a comment ending *"the behavioural pin lives in `slot-target.test.js`"*. **That file never existed**, and `/examples/` is jest-ignored so it would not have run. The copies had not yet drifted; the guarantee was simply absent. | Behavioural pin + a check that no copy goes unpinned |
| **072** `DeclaredSlot` API | "A slot rename is caught by `tsc` in every consuming MFE" | Caught in the compiler, by nobody in review — root `tsconfig.json` excludes `examples`. Renaming a slot and leaving stale app code passed `typecheck`, `test`, `check:mfe-drift:check` and `check:mfe-consistency`. Separately, `slots-implemented` went **vacuous on first build**: `bootstrap.ts` embeds the manifest as JSON, so every declared id always looked referenced. | Static id check; ownership filter on the slot scan |
| **011** GeneratedFrom traceability | Optional lineage array in `data:` | Nothing wrong. Schema, published JSON schema, template and round-trip all correct. Recorded instead: the field is written and never read, and `version` is documented but never generated. | Pack only |

## Fixes to the mechanism itself

- **Packs outside a `src/` tree never ran.** jest `testMatch` covered `**/src/**` and
  `**/scripts/__tests__/**`. ADR-045's pack matched neither — it would have been written,
  named in `verified-by`, passed both ADR-000 rules, and **never executed once**. Caught
  only because that pack was expected to fail and reported "No tests found" instead.
  `conformance-harness.test.ts` now asserts every pack on disk is reachable from jest's
  own globs.
- **Prose could be a gate.** `verified-by` was satisfied by any resolving path, so a `.md`
  counted. One ADR was affected (018); the rule now requires at least one non-`.md` entry.
- **The backlog is a ratchet.** `check:adr` fails on any addition *and* on any entry that
  has since gained a `verified-by`. Deliberately not regenerated — a self-regenerating
  backlog would absorb new gaps silently, which is the defect ADR-000 closes.
- **The rule demanded gates from decisions with no code.** It read `enforcement` and
  never `status`, so it was asking for checkers from superseded, deferred and unbuilt
  decisions — 14 of 37. Now scoped to `status: Implemented`. Verified not to be a
  loophole: flipping a pruned `Proposed` ADR to `Implemented` fails immediately,
  because the list only shrinks and it is no longer on it.

## Discipline

Every check was **proven able to fail** before being trusted, one break at a time. Two of
those break-tests found bugs in the checks themselves: ADR-019's boundary check matched
only `from '…'` and let a bare side-effect import through, and ADR-016's `--json` check
asserted the flag was absent when spreading `...BaseCommand.baseFlags` is the correct
pattern.

## Known open

ADR-020's *"zero-transpile development loop"* is still false — `bun bin/dev.ts` executes
`dist/commands/*.js`, so a source edit needs a rebuild. Narrowed (the root uses oclif's
`strategy: "pattern"`; the bff plugin uses the default and correctly loads `.ts`) but not
resolved, and adding `ts` to the globs did not fix it. Choosing a discovery strategy is an
architectural decision, so it is recorded rather than guessed at.
