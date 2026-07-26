---
id: 0077
title: The two-headed giant's implementation plan is re-derived from measured friction, not from the April spec
status: Accepted
impl:
  stage: phased
  refs: ["#139"]
date: 2026-07-26
deciders: [sean]
area: Developer model / DX / agent contract
enforcement: code
tags: [dx, ai, cli, mcp, meta]
relates-to: [30, 33, 43, 55, 65, 73, 74]
supersedes: []
superseded-by: []
implements-pdr: [3]
implemented-by:
  - packages/oclif-base/src/BaseCommand.ts
  - src/mcp/sources/local.ts
  - src/oclif/schema-derivation.ts
  - scripts/generate-schemas.ts
  - src/oclif/__tests__/command-conformance.test.ts
verified-by:
  - packages/oclif-base/src/__tests__/base-command.agent-profile.test.ts
  - src/oclif/__tests__/command-conformance.test.ts
  - src/oclif/__tests__/schema-derivation.test.ts
  - src/mcp/__tests__/local-source.test.ts
  - src/mcp/__tests__/build-argv.test.ts
tracked-by: ["#139"]
summary: >-
  ADR-033's framing stands; its implementation table does not. The ownership half is withdrawn
  because `overwrite` plus regenerate-and-diff gates already solve it, the shell half moves to
  ADR-078, and the remaining agent-contract work is re-scoped from the Meridian DX reports rather
  than from the April issue list. The agent profile becomes enforced by a registry-driven sweep
  instead of by convention.
rationale-summary: >-
  Epic #139 was specified from a single build before the platform had drift gates, a control
  plane, or a second reference app. Three months later the measured friction — recorded live in
  two DX field reports — overlaps its issue list nowhere. Keeping the framing while re-deriving
  the work preserves what was right (one CLI, two profiles) and discards guesses that the
  evidence has since contradicted.
long-form: true
---

# ADR-077: The two-headed giant's implementation plan is re-derived

## Context

ADR-033 (2026-04-26) established the two-headed giant: one CLI, an AI head driven by
`--json --no-interactive` and typed exit codes, a human head served by `explain`, `system:map`,
an audit log, and file ownership markers. PDR-003 promoted the framing to product strategy a
month later. The framing was right and is not in question here.

The implementation table in ADR-033 §Implementation is a different matter. It was written from
one build — ABC Kids — before the platform had drift gates (#295, #296), a slot contract
(ADR-066–073), a control plane in the reference apps (ADR-054–060), or a second reference app.
Three things have since falsified parts of it.

**1. The ownership mechanism was solved differently.** ADR-033 §"Human profile" specifies
`// GENERATED — do not edit` / `// DEVELOPER-OWNED` headers and a `.seans-mfe-tool/audit.jsonl`
decision log (issue #145). Neither exists: an exhaustive grep finds zero such markers in any
template and no audit log anywhere. What exists instead is `overwrite` on every entry of the
generation plan (`packages/codegen/src/unified-generator.ts:800-802`) enforced by five
regenerate-and-diff gates. ADR-074 names the principle: *generating it removes the disagreement
rather than checking for it.* A header comment is advisory; a gate is not.

**2. One item contradicts a later ADR.** `shell:init` (#144) specifies a host with static
`remotes[]` and a manifest-derived `remotes.d.ts`. ADR-055 subsequently made shells
daemon-driven and remote-agnostic — Meridian's shell ships `remotes: {}` on purpose. The same
assumption breaks `system:map` (#146), whose stated discovery strategy is to parse that block.

**3. The measured friction is elsewhere.** `examples/meridian-station/DX-REPORT.md` is a 22-item
punch list written live while an agent built a 7-MFE reference app through the CLI and the MCP
server. None of its 22 items appears on the #139 list. It found the unpublished runtime
(ADR-064/#252), React↔Angular template drift (#281), MCP `cwd` targeting (#279), and API
generator defects.

Meanwhile the contract ADR-033 actually specified was unenforced. `--no-interactive` — the flag
it names as *the* agent-profile switch — did not exist in `src/` or `packages/` at all. Typed
exit codes applied only under `--json`; every human-mode failure exited 1, contradicting
ADR-033's own rule that a typed code is required "for every failure class". And no test iterated
the command registry, so each of these was invisible.

## Decision

ADR-033's framing is unchanged. Its implementation plan is replaced by the following.

### 1. Ownership markers and the audit log are withdrawn, not deferred

`GeneratedFile.overwrite` is the ownership map, and the drift gates are its enforcement. The
audit log's question — what did the agent decide, and why — is answered by the PR diff and git
history, which are already what a human reviews. Issue #145 closes as withdrawn.

Any future human-legibility surface (`explain`, `system:map`) derives ownership from the
generation plan. It does not introduce a parallel ownership record.

### 2. The agent profile is enforced by a registry sweep, not by convention

ADR-033 carries `enforcement: convention` and states "verified manually per command". That is why
`--no-interactive` could be absent for three months without anything going red.

`src/oclif/__tests__/command-conformance.test.ts` enumerates the command tree and asserts, for
every command: it extends `BaseCommand` and does not override `run()`; `--json` and
`--interactive` (with `allowNo`) are present; and it has an MCP schema whose every declared flag
exists on the command, or a named exemption. This ADR is `enforcement: code` because of it.

### 3. `--no-interactive` is separable from `--json`

They answer different questions — one is about output format, the other about whether the process
may block. Coupling them forced any caller wanting a guarantee against prompts to also give up
human-readable output. `interactive` is a `baseFlag` with `allowNo`, and `--json` continues to
imply it.

### 4. Typed exit codes apply on every failure path

In human mode `BaseCommand` stamps the sysexits code onto `err.oclif.exit` and re-throws, so
oclif still renders the error. Two deliberate non-actions: an error that already carries an exit
code (oclif's own usage errors) is left alone, and an error that classifies as `unknown` is left
alone rather than being relabelled as a typed failure class.

### 5. The MCP tool catalog is derived from the command registry

`schemas/<cmd>.json` is what `mcp:serve` turns into agent-callable tools, so whatever decides its
contents decides what agents can do. It was a hand-written literal in
`scripts/generate-schemas.ts`, and it drifted in every available direction:

- **Commands missing.** `build:check|dev|prod|docker` had no entry, so no `mfe:build:*` tool
  existed. An agent over MCP could scaffold and validate an MFE and then not build it — which is
  why the Meridian MCP lane scaffolded over MCP and dropped back to the CLI.
- **Flags advertised that do not exist.** `deploy` offered `registry`, `mode`, `namespace`,
  `domain`, `tag`, `memory`, `cpu`, `replicas` — a Kubernetes vocabulary the command never
  implemented. Any agent using one got a hard oclif parse failure.
- **Flags omitted that do exist.** `remote:init` did not advertise `framework`, so **an agent
  could not scaffold an Angular MFE over MCP at all** — the flag that selects the framework was
  invisible.
- **Positionals guessed.** `buildArgv` carried `new Set(['name', 'spec'])`. `spec` is a flag on
  every command that has one, so supplying it produced a second positional that a `strict`
  command rejects.

The command's own flag and arg declarations are the only honest source for its input contract.
The generator now loads the live oclif registry (`Config.load()`, which includes first-party
plugins), derives every input schema from it, and carries the declared args through as
`x-positional` so `buildArgv` stops guessing. Each of the four failures above becomes
unrepresentable rather than merely fixed.

Output schemas stay hand-authored — a command's TypeScript result type is not introspectable at
runtime — but a catalogued command with no output schema is a **build failure**, not an empty
`{}`. Adding a command forces an explicit decision: author the output contract, or exclude it in
`CATALOG_EXCLUDED` with a reason. Exclusions are for things that are not capabilities
(`mcp:serve`, `schemas`, a deprecated alias); they are not a place to park a real gap.

Three inputs are transport-owned and never appear in a schema: `--json` (appended to every child
call; the envelope depends on it), `--interactive` (MCP is non-interactive by construction), and
`cwd` (the reserved execution argument the registry injects, #279).

### 6. The epic splits

**#139 (re-scoped) — agent contract completion.** Build-output parsers behind the existing
`BuildError` contract (absorbing #148); MCP schema coverage for the `build:*` surface; `received`
and `suggestion` on manifest validation errors (the remaining half of #141); and wiring
`classifyError`'s pattern branch, which `packages/contracts/src/envelope.ts:126` calls with an
empty config, making ADR-030's regex detection dead code in the CLI path.

**A new epic — `platform:init`.** The shell and control-plane scaffolding, governed by ADR-078.
#144 is rewritten into it rather than closed: both reference shells are still hand-written, so
the need is real, but what should be generated is ADR-055's generic daemon-driven host.

**Closed:** #142 (capability shapes — features are developer-owned and hand-authored by design
per PDR-001 and #302; six stub variants would double the template surface #281 exists to contain),
#145 (§1), #149 (moot — `examples/dsl-mfe` was deleted under #239, not fixed).

## Boundaries

This ADR does not change the `CommandResult<T>` envelope (ADR-018), the error taxonomy
(ADR-017), or the exit-code table. It re-scopes work and adds enforcement; it does not redesign
the contract.

It does not settle whether MCP should become the primary agent interface. The Meridian report's
verdict — "MCP wins for agents once cwd targeting lands" — is a real pull toward the option
ADR-033 rejected as Option B, but MCP remains a thin wrapper over `CommandResult` envelopes and
changing that needs its own decision.

The conformance sweep covers this repo's command tree. Plugin-owned commands (`bff:*`) are
checked only where they publish a schema into `schemas/`.

§5 derives the *input* half of each contract. Output schemas remain hand-authored and unverified
against the command's actual return value — a command whose result type changes can still
publish a stale output schema. Closing that needs type-level extraction, which this ADR does not
attempt.

## Consequences

**Better.** The agent profile is now falsifiable: a command cannot ship without `--json`,
`--no-interactive`, or an MCP schema without a test going red.

**Better.** The tool catalog can no longer disagree with the CLI about what commands exist or
what flags they take. Between them, the sweep and the derivation surfaced five defects that had
each been live for months: a phantom `mfe:manifest.schema` tool; eight non-existent flags on
`mfe:deploy`; the entire `build:*` surface missing; `remote:init` not advertising `framework`, so
no agent could scaffold an Angular MFE over MCP; and `buildArgv` treating `spec` as a positional
when it is a flag.

**Better.** Closing #142/#145/#149 and rewriting #144 removes four issues that could not have
been implemented as written without contradicting a later ADR or duplicating a solved problem.

**Worse.** `Config.load()` at generation time means schema generation now depends on the CLI
booting and its plugins resolving. A broken plugin install fails the build rather than silently
emitting a smaller catalog — the right trade, but it is a new coupling.

**Worse.** `CATALOG_EXCLUDED` is a place where a real gap could be parked and forgotten. It is
deliberately narrow and each entry carries a reason; nothing in it is a capability an agent would
want.

**Cost accepted.** Typed exit codes in human mode change observable behaviour: a command that
previously exited 1 on a `ValidationError` now exits 64. This is what ADR-033 always specified,
but any consumer branching on `=== 1` is affected.

## References

- ADR-033 — the two-headed giant; this ADR replaces its implementation table, not its framing.
- ADR-074 — registration as a build artifact; the source of the generate-don't-check principle
  applied in §1.
- ADR-055 — daemon-driven shells, which #144's original spec contradicts.
- ADR-030 — error classification; §6 records that its pattern branch is unreachable in the CLI.
- ADR-018 / ADR-017 — the envelope and error taxonomy this ADR enforces but does not change.
- ADR-078 — the control plane and `platform:init` half of the split.
- PDR-003 — AI-native, agent-operable tooling.
- `docs/platform-design-review/two-headed-giant-re-derivation.md` — the full evidence review.
- #139 — the epic being re-scoped.
