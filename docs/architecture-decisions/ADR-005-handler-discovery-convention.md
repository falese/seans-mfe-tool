---
id: 0005
title: Handler Discovery Convention
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, handlers, codegen, polyglot]
summary: DSL handler names are neutral strings; code generators map them to language-specific conventions (camelCase for JS/TS, snake_case for Python, PascalCase for Go) with validation timing differing by handler type.
rationale-summary: Neutral handler naming keeps the DSL language-agnostic while generated code feels native to each language's conventions.
long-form: true
---

# ADR-005: Handler Discovery Convention

## Context

Handler names in the DSL must be resolved to actual functions at runtime. The DSL is language-agnostic but the underlying code is language-specific. A rigid naming convention in the DSL would either favor one language or be unnatural for all.

## Decision

Use a convention-based hybrid: DSL defines neutral handler names; code generators map them to language-specific naming conventions. Validation timing differs by handler type.

**Naming Conventions by Language:**

| Language | Convention | Example |
|---|---|---|
| JavaScript/TypeScript | `camelCase` | `validateInput` |
| Python | `snake_case` | `validate_input` |
| Go | `PascalCase` | `ValidateInput` |

**Validation Timing:**

- **Capability handlers**: Validated at MFE startup (fail-fast on missing handlers)
- **Lifecycle handlers**: Deferred validation on first invocation (reduces startup cost for rarely-used hooks)

```yaml
# DSL uses neutral names
lifecycle:
  before: [validateInput]  # Generator maps to: validateInput (JS), validate_input (Python)
  main: [executeCore]
```

## Consequences

**Positive:**
- DSL remains language-agnostic
- Generated code feels native to each language
- Fail-fast validation for capability handlers; deferred for lifecycle handlers

**Negative:**
- Discrepancy between DSL handler names and generated code requires documentation
- Deferred lifecycle handler validation means missing handlers surface only at first invocation

## References

- DEC-019
- REQ-046
- ADR-013: Language-Agnostic DSL Contract
- ADR-004: Handler Array Support
