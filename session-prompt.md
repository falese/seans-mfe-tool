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

## Session: YYYY-MM-DD

### Active issue(s)

**[#N](https://github.com/falese/seans-mfe-tool/issues/N) — verb: short description**

### Scope

One paragraph: what is changing, what is NOT changing, acceptance criteria.

### ADR check

<!-- List every ADR whose domain overlaps this session's work.
     If a new architectural decision is needed and no ADR covers it:
     STOP — ask the human to write/waive a new ADR before proceeding. -->

| ADR | Title | Governs |
|-----|-------|---------|
| ADR-NNN | title | area |

### Spec context

<!-- Paste the relevant sections from @docs/spec.md here.
     Do not paste the whole spec — only sections directly relevant to the active issue. -->

### Current file tree

```
src/...         ← MODIFY
packages/...    ← MODIFY
tests/...       ← MODIFY
```

### TDD order

Write failing tests first, then implementation. List in priority order:

1. Test: _describe what it asserts_
2. Implement: _describe what it does_

### Existing tests (summary)

N tests passing across M files. Do not duplicate existing coverage.

Key constraint: _note any mocking patterns or test isolation requirements._
