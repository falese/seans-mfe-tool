---
id: 0010
title: Data Lifecycle Alignment
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, lifecycle, data]
summary: Data queries and mutations use the same four-phase lifecycle as capability execution; there is no separate loading phase, as data fetching is modeled as a capability invocation.
rationale-summary: Aligning data lifecycle with capability lifecycle provides a single mental model and avoids special-casing data operations in the platform runtime.
long-form: true
---

# ADR-010: Data Lifecycle Alignment

## Context

An earlier design included a `loading` phase for data queries (to show loading indicators while data was being fetched). This creates a separate lifecycle model for data vs capabilities, which complicates the platform runtime and the DSL.

## Decision

Data queries and mutations do not have a special `loading` phase. They use the same four standard lifecycle phases as capabilities (`before`, `main`, `after`, `error`). Loading indicators are implementation details of the handler, not platform phases.

```yaml
# Correct pattern
queries:
  - getAnalysis:
      lifecycle:
        before: [validateToken]
        main: [executeQuery]       # NOT loading: [showIndicator]
        after: [cacheResponse]
        error: [logError]
```

If a loading indicator is needed, it is implemented within the `main` handler or as a UI concern in the component, not as a DSL lifecycle phase.

## Consequences

**Positive:**
- Single lifecycle model for everything — capabilities and data
- Platform runtime has no special cases for data operations
- DSL is simpler and more consistent

**Negative:**
- Loading indicator implementation requires convention guidance for teams

## References

- DEC-023
- ADR-002: Lifecycle Hook Execution Model
- ADR-003: No Custom Lifecycle Phases
