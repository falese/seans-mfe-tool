---
id: 0003
title: No Custom Lifecycle Phases
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, lifecycle, simplicity]
summary: The DSL lifecycle is restricted to exactly four standard phases — before, main, after, error — with no custom phase extension point.
rationale-summary: Restricting to four phases eliminates phase ordering ambiguity, simplifies the mental model, and ensures all hooks follow the same execution semantics defined in ADR-002.
long-form: true
---

# ADR-003: No Custom Lifecycle Phases

## Context

ADR-031 included a `custom:` key for domain-specific lifecycle phases. In practice, custom phases create ordering ambiguity (when do custom phases run relative to standard phases?), different execution semantics (what does a failure in a custom phase mean?), and a more complex mental model for platform implementers and hook authors.

## Decision

Only four lifecycle phases are supported: `before`, `main`, `after`, `error`. The `custom:` extension point from ADR-031 is removed. Domain-specific execution sequences must be expressed as multiple handlers within the standard phases.

```yaml
lifecycle:
  before: [validateInput, checkAuth]    # All run, failures logged
  main: [executeCore]                   # First failure stops and propagates
  after: [logSuccess, updateCache]      # All run, failures logged
  error: [rollback, notify]             # All run, failures logged
```

If a domain capability needs a "validation phase" and a "transformation phase", express them as ordered handlers within `before` and `main` respectively.

## Consequences

**Positive:**
- Single mental model for all lifecycle phases
- No phase ordering ambiguity
- All hooks follow the same execution semantics from ADR-002
- Simpler platform implementation

**Negative:**
- Some domain capabilities may feel constrained by four phases
- Ordering within a phase must substitute for named custom phases

## References

- DEC-017
- REQ-044
- ADR-031: Standardized Extensible Lifecycle Hooks (supersedes custom phase design)
- ADR-002: Lifecycle Hook Execution Model
- Migration note in `architecture-decisions.md`: Custom lifecycle phases removed; only standard phases supported
