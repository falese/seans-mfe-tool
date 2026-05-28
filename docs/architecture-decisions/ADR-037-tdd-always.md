---
id: 0037
title: TDD-always — write the failing test before the code
status: Accepted
date: 2026-04-17
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [testing, tdd, quality, process]
summary: Every production code change must be preceded by a failing test; no code is written without a corresponding test; npm run test:ci enforces 80% coverage on runtime code.
rationale-summary: Ad-hoc testing after the fact produces coverage gaps and tests that pass because they were written to match existing (potentially buggy) behavior; TDD inverts this by making the failure case explicit first.
long-form: false
---

# ADR-037: TDD-always — write the failing test before the code

## Context

During the oclif migration and runtime platform development, coverage gaps caused regressions that were only caught late. The project adopted a TDD-always discipline to prevent this.

## Decision

The development workflow is strictly:

1. Write a failing test that captures the expected behavior
2. Run the test to confirm it fails for the right reason
3. Write the minimum code to make the test pass
4. Refactor if needed, keeping tests green

Enforcement:
- `npm test` runs after any `src/**/*` change
- `npm run test:ci` enforces 80% branch/function/line/statement coverage when runtime code is touched
- Code review rejects PRs where production code has no corresponding test
- No `--no-verify` to skip pre-commit checks

The 80% threshold is a floor, not a target — critical paths (runtime lifecycle, error handling) should be at or near 100%.

## Consequences

**Positive:**
- Regressions are caught at write time, not at integration or user time
- Tests serve as executable specifications of intent, not just coverage artifacts
- AI agents working in this codebase are expected to follow the same discipline

**Negative:**
- Higher upfront cost — writing tests first feels slower initially
- Some infra-heavy code (Docker, Turborepo task graph) is hard to unit test and requires integration test strategies

## References

- `jest.config.js` (coverage thresholds)
- ADR-038: Conventional Commits and branch discipline
