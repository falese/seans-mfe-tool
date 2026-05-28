---
id: 0004
title: Handler Array Support
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, lifecycle, handlers]
summary: The DSL handler field accepts either a single string or an array of strings; semantics differ by phase — main uses AND (first failure stops), before/after/error use OR-like (all run, failures logged).
rationale-summary: Array support allows related operations to be grouped naturally in DSL while phase-specific AND/OR semantics ensure the execution model remains predictable.
long-form: true
---

# ADR-004: Handler Array Support

## Context

Lifecycle phases often require multiple handlers to run in sequence (e.g., validate then authenticate, or rollback then notify). Requiring a wrapper handler to call multiple sub-handlers is unnecessary boilerplate.

## Decision

The `handler` field (and lifecycle phase arrays) supports both a single string and an array of strings. Execution semantics are phase-specific:

- **`main` phase: AND semantics** — all handlers must succeed; the first failure stops execution and propagates to the caller
- **`before`/`after`/`error` phases: OR-like semantics** — all handlers run regardless of individual failures; failures are logged but do not stop the sequence

```yaml
# Single handler
handler: validateFile

# Multiple handlers — AND semantics in main, OR-like in before/after/error
handler: [validateFile, checkSize, scanForMalware]

# In lifecycle context
lifecycle:
  before: [validateInput, checkAuth]    # Both run; failure logged not propagated
  main: [stepOne, stepTwo, stepThree]   # Stops at first failure
  after: [logSuccess, updateCache]      # Both run; failure logged not propagated
  error: [rollback, notify]             # Both run; failure logged not propagated
```

## Consequences

**Positive:**
- Natural grouping of related operations in DSL
- Phase-specific semantics are predictable and documented
- No wrapper handler boilerplate for common multi-step patterns

**Negative:**
- Developers must understand the AND/OR semantic difference between main and other phases
- Array-as-single-handler patterns require explicit documentation of intent

## References

- DEC-018
- REQ-045
- ADR-002: Lifecycle Hook Execution Model
- ADR-003: No Custom Lifecycle Phases
