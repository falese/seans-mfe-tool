# seans-mfe-tool — Session Prompt

> Update this file before each coding session. Hand it to the agent alongside CLAUDE.md.
> Keep CLAUDE.md open in every session. Reference @docs/spec.md only for sections relevant
> to the active issue.

---

## How to use this template

1. Fill in **Active issue** and **Scope** below
2. Run the ADR check — confirm which existing ADRs govern this work; if none exist for a decision, stop and create one (or waive explicitly)
3. Copy the relevant spec sections from `@docs/spec.md` into **Spec context**
4. Update **Current file tree** to reflect actual state
5. Hand `CLAUDE.md` + this file to the coding agent
6. After the session, update **Current state** in `CLAUDE.md` and any resolved decisions in `docs/spec.md`

---

## Session: 2026-07-26

### Active issue(s)

**Epic [#139](https://github.com/falese/seans-mfe-tool/issues/139) — agent contract completion**,
re-derived from measured friction rather than the April spec. PR
[#334](https://github.com/falese/seans-mfe-tool/pull/334).

Split out during the session: [#329](https://github.com/falese/seans-mfe-tool/issues/329)
(`platform:init`), [#330](https://github.com/falese/seans-mfe-tool/issues/330) (one
fleet-description engine), [#331](https://github.com/falese/seans-mfe-tool/issues/331)–[#333](https://github.com/falese/seans-mfe-tool/issues/333) (defects found en route).
Closed as superseded or withdrawn: #142, #145, #149.

### Scope

Re-scoped the epic against three months of shipped work, then implemented what survived:

- `--no-interactive` as a `baseFlag`, separable from `--json` (it did not exist at all)
- typed sysexits codes on every failure path, not only under `--json`
- MCP tool catalog **derived** from the oclif registry — inputs from flags/args, outputs from each
  command's declared result type via the TypeScript compiler
- registry-driven conformance sweep, plus response validation of 14 of 17 commands against their
  published schemas
- build output parsed into classified `BuildError`s for rspack, tsc and `ng`
- `strict: true` across every tsconfig
- deleted the `lifecycleExecutor` DI seam (ADR-079)

NOT changing: the `CommandResult<T>` envelope (ADR-018), the error taxonomy (ADR-017), the exit
code table, or lifecycle semantics.

### ADR check

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-077 | Two-headed giant, re-derived | The whole epic; replaces ADR-033's implementation plan |
| ADR-078 | Control plane in the platform | #329, split out — Proposed |
| ADR-079 | One execution-substitution seam | Deleting `lifecycleExecutor` |
| PDR-008 | Control plane is platform, not plugin | Narrows PDR-004 for the daemon only |
| ADR-018 / ADR-017 / ADR-030 | Envelope, error taxonomy, classification | Enforced, not changed |
| ADR-002 | Lifecycle hook execution model | The guarantees ADR-079 keeps inside `BaseMFE` |

### Spec context

From ADR-074, the principle the session kept applying:

> Generating it removes the disagreement rather than checking for it.

Applied to the MCP catalog: it was a hand-written literal and had drifted every way a literal can
— commands missing (the whole `build:*` surface), flags advertised that do not exist (eight on
`deploy`), flags omitted that do (`remote:init --framework`, so no agent could scaffold Angular
over MCP), and positionals guessed.

### Current branch

`claude/issue-139-strategy-review-nr90y1` — PR #334 open against `main`.

### Method note worth carrying forward

Every parser in this session was written against **captured real output**, not documented formats,
and that decision paid for itself twice. rspack and tsc write diagnostics to **stdout**; `ng`
writes to **stderr** and colours them even when piped, so ANSI escapes sit between the file, line
and code. Hand-written cases based on the documented format were wrong for `ng` and passed anyway
until real output replaced them.

The same held for schemas: deriving them from declared types caught contract drift, and running
the commands caught a defect in the derivation itself (`strict: false` collapsing `string | null`).
Neither check subsumes the other.
