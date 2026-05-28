---
id: 0009
title: Language Field and Template Selection
status: Implemented
date: 2025-12-13
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [dsl, codegen, language, templates]
summary: The DSL language field drives template selection and build tooling; V1 supports JavaScript and TypeScript only, with non-JS backends treated as data-only services consumed by a JS shell.
rationale-summary: Module Federation is JavaScript-native, making JS/TS the only viable first-class MFE language for V1; non-JS backend support is deferred to avoid indefinite scope expansion.
long-form: true
---

# ADR-009: Language Field and Template Selection

## Context

The DSL `language` field (ADR-013) drives code generation template selection. Supporting all languages from V1 would require templates and codegen for every target language, which is not feasible. A clear scoping decision is needed.

## Decision

**V1 supports JavaScript and TypeScript only.** The `language` field drives template selection:

- `language: javascript` → React/rspack templates (plain JavaScript)
- `language: typescript` → React/rspack templates (TypeScript)

**Non-JS backends** (Python, Go, etc.) are treated as data-only services in V1. They are consumed by a JS shell via the GraphQL BFF layer but are not scaffolded by the CLI.

**Future roadmap:**

- `language: python` → FastAPI/Flask templates (backend-only, no Module Federation)
- `language: go` → Standard library HTTP templates (backend-only)

The codegen template directory structure is organized by language, not by MFE type (per REQ-059). This was a migration from the legacy structure (`src/templates/react/`, `src/templates/api/`, `src/templates/bff/`).

## Consequences

**Positive:**
- Module Federation works natively with JS/TS — no shim required
- Clear V1 scope prevents indefinite scope expansion
- Template directory organization is extensible by language

**Negative:**
- Non-JS teams cannot scaffold MFEs in their native language in V1
- Language-by-directory organization requires migration from type-by-directory

## References

- DEC-022
- REQ-052
- REQ-059
- ADR-013: Language-Agnostic DSL Contract
- ADR-014: Incremental TypeScript Migration
- Migration note in `architecture-decisions.md`: Legacy template folders removed
