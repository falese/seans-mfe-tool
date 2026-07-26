# The Two-Headed Giant, Re-Derived

**Part of:** [Platform Design Review](./README.md)
**Governs:** epic #139 · ADR-077
**Grounded in:** ADR-033, PDR-003 · `examples/meridian-station/DX-REPORT.md`,
`examples/meridian-station/meridian-docking-simulation/DX-REPORT.md` ·
[AI-Native Readiness Scorecard](./ai-native-readiness-scorecard.md)

Epic #139 was written on 2026-04-26 from one data point: the ABC Kids build, where the CLI could
not scaffold and both MFEs were hand-written. Its *framing* has since been promoted to canon —
ADR-033 and PDR-003 restate it almost verbatim, and the readiness scorecard measures the platform
against it.

Its *deliverables* have not aged as well. This document reconciles the April spec against what
actually shipped, and re-derives the remaining work from three months of evidence rather than
from the original list.

---

## 1. The epic against reality

| Epic item | State on `main` (2026-07-26) |
|---|---|
| **#140** zero-dep `@seans-mfe/codegen` | **Done.** ADR-061, `Implemented`. "Zero-dep" was deliberately relaxed: only `@seans-mfe/contracts` stays dependency-free; codegen owns `ejs`/`fs-extra`/`js-yaml` and ships its templates. |
| **#149** rspack alias depth + broken `dsl-mfe` | **Moot.** `examples/dsl-mfe` was deleted under #239, not repaired. |
| **#148** structured build errors | **Contract done, implementation absent.** `BuildError { file, line, column, category, suggestion }` exists and `build:prod` plumbs it into `envelope.error.details`. But both framework plugins emit exactly one error — `{ message: <entire raw stderr>, category: 'unknown' }`. No output parser exists anywhere in the repo. |
| **#145** audit log + `// GENERATED` markers | **Withdrawn — solved by a different mechanism.** See §2. |
| **#144** `shell:init` | **Never shipped**; PR #153 closed as a stale draft. Its spec (static `remotes[]` + manifest-derived `remotes.d.ts`) is the *opposite* of ADR-055's daemon-driven generic shell, which is what both reference shells actually are. |
| **#146** `system:map` | Not built. Its stated discovery strategy — parse the shell's `rspack.config.js` `remotes` block — cannot work: Meridian's shell has `remotes: {}` by design. |
| **#147** `explain` · **#143** `status` | Not built. |
| **#141** manifest JSON Schema | **Half done.** `schemas/dsl/manifest.schema.json` is generated from the Zod source of truth and CI drift-gated (ADR-065, #264). The structured-error half is not: `formatZodErrors` drops Zod's `received`, and nothing emits `suggestion`. |
| **#142** capability shapes | Not built, and superseded — see §3. |
| **#143** `--no-interactive` | **Was absent entirely.** Zero occurrences in `src/` or `packages/`. The flag ADR-033 names as *the* agent-profile switch did not exist; non-interactivity was reachable only as a side effect of `--json`. Closed by the first slice of this re-derivation. |

---

## 2. The ownership model changed underneath the epic

ADR-033 §"Human profile" specifies `// GENERATED — do not edit` / `// DEVELOPER-OWNED` header
markers and a `.seans-mfe-tool/audit.jsonl` decision log. Neither was ever built. An exhaustive
grep finds zero `OWNER:`, `GENERATED`, or `DEVELOPER-OWNED` markers in any template, no
`.seans-mfe/` directory, and no audit log.

What the platform built instead is stronger, and it is worth saying so explicitly rather than
leaving #145 open as though it were merely late.

Ownership is a **property of the generation plan**, not a comment in a file
(`packages/codegen/src/unified-generator.ts:800-802`):

```
// overwrite:false = developer-owned; never touch it, even with --force.
// overwrite:true  = generated; skip if exists unless --force re-stamps it.
```

and it is enforced by **regenerate-and-diff gates**, not by asking humans to read headers:

| Gate | Keeps in sync | Mechanism |
|---|---|---|
| #295 drift gate | generator-owned files ⇄ manifest | `scripts/check-mfe-drift.ts` |
| #296 consistency gate | `package.json` + federation `shared` ⇄ manifest | `scripts/check-mfe-consistency.ts` |
| ADR-073 `slots-implemented` | app code ⇄ manifest | static scan |
| ADR-073 `slots:validate` | registry rules ⇄ manifest | `src/commands/slots/validate.ts` |
| #328 | freshly scaffolded MFE ⇄ `tsc` | `scripts/check-template-typecheck.ts` |

A header comment is advisory; a drift gate is not. And the audit log's purpose — *what did the
agent decide, and why* — is served by the PR diff and git history, which are already the artifacts
a human reviews. ADR-074 states the philosophy the platform converged on:

> Generating it removes the disagreement rather than checking for it.

The Meridian DX report reached the same conclusion empirically (punch-list item 21): `--force`
was "a no-op wearing a threatening name" precisely because ownership is already decided by the
plan, and the fix was to make the CLI hint tell the truth — not to add markers.

**Consequence for the epic:** #145 is closed as withdrawn. `GeneratedFile.overwrite` *is* the
ownership map, which also means the `explain` output ADR-033 wanted ("what's yours to change")
is derivable for free rather than requiring a new data model.

---

## 3. What the evidence actually says the friction is

`examples/meridian-station/DX-REPORT.md` is a 22-item punch list written live while an agent built
a 7-MFE reference app through the CLI *and* the MCP server. It is the best evidence the project
has about agent-facing DX, because it was produced by the workflow the epic is about.

**None of its 22 items is an epic #139 item.**

What it found instead: the unpublished runtime (ADR-064/#252) caused "every one of this build's
environment-specific detours"; React and Angular templates drift because they encode the same
lifecycle contract twice (#281); MCP `cwd` targeting was the one thing keeping MCP from being the
best agent interface (#279, since fixed); and a dozen API-generator defects.

Its closing verdict is a mild pull *toward* the option ADR-033 rejected:

> CLI wins for humans (colors, next-steps text); MCP wins for agents (typed results, no prose
> parsing) once cwd targeting lands.

The lesson is not that the two-headed framing is wrong — it is that the April spec guessed at the
friction, and the guesses were mostly wrong. The re-derived epic is scoped from what was measured.

### On #142 (capability shapes)

Closed. When it was filed, richer stubs looked like leverage. Since then PDR-001 and #302 settled
that new MFEs are `remote:init` plus hand-written feature code, and features are developer-owned —
never overwritten by any flag. Six new stub variants would double the surface of exactly the
template drift #281 exists to contain, in exchange for a slightly better first paste of code in
files the developer owns outright.

---

## 4. A correction to this review's own scorecard

The [AI-Native Readiness Scorecard](./ai-native-readiness-scorecard.md) cites, as the evidence for
its D6 (auditability) and D3 (non-interactive) rows:

> ADR-033 `enforcer-config`: `cli-agent-profile-flags: [--json, --no-interactive, --dry-run]`;
> `exit-codes: [...]`; `ownership-markers: [GENERATED, DEVELOPER-OWNED]`.

**ADR-033 has no `enforcer-config` block.** Its frontmatter carries `enforcement: convention` and
nothing else. `contract-alignment-pass.md:89` analyses the same non-existent field.

This matters beyond tidiness, because it inflated two scores:

- **D3 (non-interactive) scored 5/5** citing that block. `--no-interactive` did not exist at all
  until the first slice of this re-derivation; the honest score at the time of the review was
  closer to 3/5 (`--json` implied non-interactivity; `--dry-run` was per-command).
- **D6 (auditability) scored 2/5** against markers and an audit log that were never going to be
  built. Re-scored against the mechanism the platform actually uses — `overwrite` plus five drift
  gates — the ownership half is strong and the *legibility* half (`explain`, `system:map`) is what
  is missing.

Both rows should be re-derived from code rather than from ADR frontmatter that does not exist.

---

## 5. The split

Epic #139 becomes two, because its two halves have different evidence bases and very different
sizes.

### Epic A — Agent contract completion (#139, re-scoped)

Small, near-done, and evidence-backed. Everything here is a gap in a contract the platform already
claims to honour.

| Item | State |
|---|---|
| `--no-interactive` as a real flag | ✅ shipped in the first slice |
| Typed exit codes on *every* failure path, not only under `--json` | ✅ shipped in the first slice |
| Cross-command conformance sweep | ✅ shipped in the first slice |
| Real build-output parsers behind the existing `BuildError` contract (absorbs #148) | open |
| MCP schema coverage for `build:check\|dev\|prod\|docker` | open, pinned by a test |
| `received` + `suggestion` on manifest validation errors (#141, remaining half) | open |
| `classifyError(err, { types: [] })` — ADR-030's pattern branch is dead code in the CLI path | open |

### Epic B — `platform:init`: the composition environment as a generated artifact

Larger, and architecturally new. Covered by ADR-078 and PDR-008.

- `packages/control-plane` — promote the vendored registry and daemon into the platform. They are
  currently **byte-identical copies** in `examples/abc-kids/control-plane/` and
  `examples/meridian-station/control-plane/` (526-line registry, 770-line daemon), each carrying a
  header saying the canonical copy lives in another repo. That is the hand-copied-restatement
  pattern ADR-074 exists to eliminate, sitting in the middle of the reference apps.
- A control-plane manifest with `persistence:` as configuration (memory | mongo), so durable
  storage is a manifest field rather than a fork of the registry.
- `platform:init` generates the shell, the compose topology, the control-plane config, and a
  seeded `rules.json`.
- Retire `@falese/daemon`.

`shell:init` (#144) is rewritten into this epic rather than closed: the need is real — both
reference shells are still hand-written — but the artifact it should generate is a generic
daemon-driven host with no static remotes, per ADR-055.

---

## 6. Verified MCP findings

Recorded here because they were found by running the server, and two of them were wrong in the
first draft of this review.

`mcp:serve` works. Two Meridian MFEs were scaffolded through it. The findings are defects in the
tool *catalog*, not the integration.

**Fixed in the first slice.** `tools/list` returned **14 tools**, one of which was a phantom.
`src/mcp/sources/local.ts` recursed one level into `schemas/` and turned every `.json` into a
tool, sweeping in `schemas/dsl/manifest.schema.json` — the DSL *document* schema (ADR-065), not a
command contract. It advertised itself convincingly, carrying the DSL schema's own description,
and every call failed:

```json
{ "isError": true, "content": [{ "type": "text", "text": "command manifest.schema not found" }] }
```

The source now requires a command-contract shape (`input`) before registering. The catalog is 13.

**Fixed in the first slice, and worse than the phantom.** `schemas/deploy.json` advertised eight
flags the `deploy` command does not have — `registry`, `mode`, `namespace`, `domain`, `tag`,
`memory`, `cpu`, `replicas` — a Kubernetes vocabulary the command never implemented (ADR-062 keeps
production deployment out of it entirely). An agent passing any of them got a hard oclif parse
failure. Found by the conformance sweep on its first run, which is the argument for the sweep.

**Still open, now pinned by a test.** No `mfe:build:*` tool exists. `build:check`, `build:dev`,
`build:prod`, and `build:docker` are real, working commands with no `schemas/*.json`, and
`scripts/generate-schemas.ts` iterates a hand-written `OUTPUT_SCHEMAS` literal rather than the
oclif registry — so a command with no hand-authored schema silently produces no tool and nothing
goes red. **An agent over MCP can scaffold, generate, and validate an MFE but cannot build it.**
This is the substantive MCP gap, and it is the reason the Meridian MCP lane scaffolded over MCP
and then dropped back to the CLI to build.

---

## References

- ADR-033 — the original two-headed-giant decision; ADR-077 amends its implementation plan.
- ADR-077 — this re-derivation, as a decision.
- ADR-078 / PDR-008 — the control plane moving into the platform.
- ADR-074 — "generating it removes the disagreement rather than checking for it".
- PDR-003 — AI-native, agent-operable tooling.
- `examples/meridian-station/DX-REPORT.md` — the 22-item field report this re-derivation is built on.
