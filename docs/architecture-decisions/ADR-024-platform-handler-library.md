---
id: 0024
title: Platform Handler Library Standardization
status: Planned
date: 2025-12-13
deciders: [sean]
enforcement: convention
supersedes: []
superseded-by: []
tags: [runtime, platform-handlers, lifecycle, standardization]
summary: Standardize all platform handlers under the platform.* prefix, require async support and telemetry emission, and mandate 100% test coverage for every handler in the library.
rationale-summary: Platform handlers were ad-hoc and lacked consistent error propagation, telemetry, and retry semantics, making cross-MFE behavior unpredictable.
long-form: false
---

# ADR-024: Platform Handler Library Standardization

## Status

📋 Planned

## Context

Platform handlers (`platform.*`) are lifecycle functions for authentication, authorization, validation, telemetry, caching, logging, error handling, and rate limiting. The goal is to standardize these across all MFEs for repeatability, developer productivity, and future extensibility.

## Decision

- All platform handlers must be registered with the `platform.*` prefix and reside in `src/runtime/handlers/`.
- Handlers must support all lifecycle phases (`before`, `main`, `after`, `error`).
- Platform handlers are strictly standardized; custom handlers remain flexible.
- User-related concerns (e.g., permissions) are driven by DSL metadata; technical concerns are handled by standard logic.
- All handlers must support async operations and propagate errors according to lifecycle semantics:
  - Mandatory failures throw errors and halt lifecycle.
  - All invocations emit telemetry (success/failure).
  - Retry logic is allowed for error-handling handlers.
- 100% test coverage required for all handlers.
- Adding new platform handlers must follow the documented pattern and update API reference docs.

## Consequences

- MFEs will have uniform, reliable lifecycle operations.
- Adding new platform functions is efficient and repeatable.
- Observability and error handling are improved via strict telemetry.

## Traceability

- REQ-058 (Platform Handler Library)
- ADR-002 (Handler Resolution)
- ADR-007 (Platform Handler API)

## Next Steps

- Update requirements in `/docs/requirements/dsl-contract-requirements.md`
- Implement handler library in `src/runtime/handlers/`
- Document API in `docs/platform-handlers.md`
