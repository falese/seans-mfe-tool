---
id: 0002
title: Lifecycle Hook Execution Model
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [runtime, lifecycle, hooks, resilience]
summary: Hooks use a contained execution model where before/after/error phase failures are silently logged via telemetry and only main phase failures propagate to the caller.
rationale-summary: Resilience over strict propagation — lifecycle hooks enhance capabilities without the risk of a telemetry or logging hook breaking the core business operation.
long-form: true
---

# ADR-002: Lifecycle Hook Execution Model

## Context

The DSL lifecycle system (ADR-031) defines before/main/after/error phases for capability execution. The question is: what happens when a hook fails? Strict propagation makes hooks fragile; silent swallowing hides bugs. A middle ground is needed that keeps business operations reliable while ensuring hook failures are visible.

The earlier ADR-031 design included a `custom:` phase extension. This ADR refines the model with specific `contained` and `mandatory` semantics that apply to the four standard phases only.

## Decision

Use the following execution rules:

- `mandatory: true` — Hook executes even if previous hooks in the same phase failed
- `contained: true` — The platform wraps the hook invocation in a try-catch
- **`main` phase failures** propagate to the caller (uncontained by default)
- **`before`/`after`/`error` phase failures** are caught, logged via telemetry, and silently swallowed
- ALL hook failures emit telemetry automatically regardless of contained/mandatory flags

```yaml
capabilities:
  - myCapability:
      type: domain
      lifecycle:
        before: [validateInput, checkAuth]   # failures logged, not propagated
        main: [executeCore]                  # failure propagates to caller
        after: [notifyComplete, updateCache] # failures logged, not propagated
        error: [rollback, notify]            # ALL run even if one fails; failures logged
```

## Consequences

**Positive:**
- Business operations (main phase) are protected from hook failures
- Observability hooks (telemetry, logging in before/after) cannot break the operation
- ALL failures are visible via telemetry — nothing is truly silent
- `mandatory` flag enables must-run cleanup even after partial failures

**Negative:**
- before/after hook failures that indicate real problems may be masked in the short term
- Developers must check telemetry rather than relying on thrown exceptions for hook failures

## References

- DEC-016
- REQ-042
- REQ-043
- ADR-031: Standardized Extensible Lifecycle Hooks (precursor)
- ADR-003: No Custom Lifecycle Phases
- `docs/acceptance-criteria/lifecycle-hooks.feature`
