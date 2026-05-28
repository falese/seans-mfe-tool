---
id: 0017
title: Typed error hierarchy — never throw raw Error
status: Accepted
date: 2026-04-18
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [errors, contracts, cli, runtime, type-safety]
summary: All thrown errors must be instances of a domain-typed class from @seans-mfe/contracts — ValidationError, BusinessError, NetworkError, SystemError, TimeoutError, or SecurityError — never raw Error.
rationale-summary: Raw errors provide no retryability signal, no user-facing vs internal distinction, and no structured serialisation; typed errors enable BaseCommand and the runtime to handle them correctly without pattern-matching on message strings.
long-form: true
---

# ADR-017: Typed error hierarchy — never throw raw Error

## Context

After the oclif migration and introduction of BaseCommand (ADR-016), error serialisation became a central concern. A raw `throw new Error('something went wrong')` cannot be:

- Classified as retryable vs non-retryable (ADR-030)
- Sanitised before user-facing display (security errors must show generic messages)
- Serialised into a `CommandResult<T>` envelope with a meaningful `errorCode` field
- Distinguished from transient infrastructure failures vs programming bugs

## Decision

All errors must be instances of one of six typed classes from `packages/contracts/src/errors/`:

| Class | Retryable | User-facing | Audit log |
|---|---|---|---|
| `ValidationError` | No | Yes | No |
| `BusinessError` | No | Yes (custom message) | No |
| `NetworkError` | Yes | No | No |
| `SystemError` | Yes (ops alert) | No | No |
| `TimeoutError` | Yes | No | No |
| `SecurityError` | No | Generic only | Yes |

Rules:
- `throw new Error(...)` is forbidden in all `src/` and `packages/` code
- Each typed class carries a `code` string (e.g. `ERR_VALIDATION_FAILED`) for programmatic handling
- BaseCommand catches typed errors and serialises them into `CommandResult<T>.error`
- The error classifier (`packages/contracts/src/error-classifier.ts`) provides `classifyError()` for runtime use

## Consequences

**Positive:**
- BaseCommand and the runtime handler framework (ADR-030) can make retry/display decisions without regex matching
- SecurityError ensures sensitive details never reach client output
- AI agents receive structured error codes in `--json` mode and can branch on them

**Negative:**
- Every throw site must import and use the correct typed class
- Third-party library errors (fetch, fs, Zod) must be caught and re-thrown as typed errors at system boundaries

## References

- `packages/contracts/src/errors/` (all six classes)
- `packages/contracts/src/error-classifier.ts`
- ADR-016: BaseCommand pattern
- ADR-030: Error Classification with Hybrid Detection
