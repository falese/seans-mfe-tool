---
id: 0038
title: Conventional Commits and branch discipline
status: Accepted
date: 2026-04-17
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [git, commits, branch-naming, process, traceability]
summary: All commits use Conventional Commits format (feat/fix/refactor/test/docs/chore) with Refs #N or Closes #N in the body; branches follow the claude/issue-<N>-<slug> pattern.
rationale-summary: Consistent commit messages and branch names enable automated changelog generation, clear traceability from code to issue, and predictable PR hygiene for both human and AI contributors.
long-form: false
---

# ADR-038: Conventional Commits and branch discipline

## Context

With both human and AI agents committing to the repository, consistent commit message and branch naming conventions are necessary for traceability and automated tooling.

## Decision

### Commit format

```
<type>(<scope>): <subject>

<body — optional>

Refs #N    (or Closes #N on the final commit of a feature)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>  # when AI assisted
```

Valid types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### Branch naming

```
claude/issue-<N>-<short-slug>
```

Examples: `claude/issue-49-shared-context`, `claude/issue-181-open-schema`

### Rules

- Every commit body includes `Refs #N` (issue reference) or `Closes #N` on the final commit
- No `--no-verify` — pre-commit hooks must pass
- No `--no-gpg-sign` — signing is required
- No `--amend` on pushed commits
- No force-push to `main`

## Consequences

**Positive:**
- `git log --oneline` immediately shows what was built, fixed, or changed
- Issue links in commit bodies create a traceable history from issue → commits → PR
- Changelog generation from conventional commits is possible without manual curation

**Negative:**
- Commit discipline adds friction when iterating quickly — requires discipline to not take shortcuts
- AI agents must follow the same conventions when generating commits

## References

- CLAUDE.md (Development rules, Branch and commit discipline sections)
- ADR-037: TDD-always
