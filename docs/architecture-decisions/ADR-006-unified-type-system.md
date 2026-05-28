---
id: 0006
title: Unified Type System
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, types, graphql, typescript]
summary: A single type system flows from the DSL through GraphQL schema to TypeScript/Python types; types are nullable by default following GraphQL convention, with ! indicating required/non-null.
rationale-summary: A unified type system with the DSL as the single source of truth eliminates type drift between the manifest, API schema, and generated code, and fails builds rather than allowing runtime type errors.
long-form: true
---

# ADR-006: Unified Type System

## Context

MFE capabilities have inputs and outputs defined in the DSL. These types must also appear in the GraphQL schema (ADR-001) and in generated TypeScript/Python code. Without a single source of truth, types drift between layers, causing runtime errors that could have been caught at build time.

## Decision

Adopt a single type system where the DSL is the source of truth. Types flow DSL → GraphQL → TypeScript/Python. Nullable by default (following GraphQL convention); `!` suffix denotes required/non-null.

**Type Categories:**

| Category | Examples |
|---|---|
| Primitives | `string`, `number`, `boolean`, `object`, `array` |
| Collections | `array<T>`, `array<T!>` (non-null items) |
| Specialized | `jwt`, `datetime`, `email`, `url`, `id`, `file`, `element` |
| Custom | Team-defined types extending primitives, declared in DSL `types:` section |

**Validation:** Compile-time validation is preferred over runtime checks. Failing builds are better than runtime errors.

**Extensibility:** MFE teams define custom specialized types in the DSL `types:` section. These are validated against the type registry during codegen.

## Consequences

**Positive:**
- DSL is the single source of truth for all types
- Build-time validation catches type errors before deployment
- GraphQL introspection reflects accurate types
- Generated TypeScript/Python types match the DSL contract

**Negative:**
- Type system evolution (adding types) must be coordinated across DSL, GraphQL, and codegen

## References

- DEC-020
- REQ-047
- ADR-001: GraphQL Data Standardization
- ADR-013: Language-Agnostic DSL Contract
- `docs/acceptance-criteria/type-system.feature`
