# ADR-022: Lifecycle Re-Entrancy Guard in BaseMFE

## Status
Accepted

## Context

During platform contract and codegen development, we discovered that certain manifest patterns can cause infinite recursion in lifecycle orchestration. Specifically, if a lifecycle hook for a capability (e.g., `query`) is mapped to the wrapper method (e.g., `doQuery`), the orchestration logic will repeatedly call itself, leading to out-of-memory errors and test failures.

## Decision

We introduced a re-entrancy guard in the `BaseMFE` abstract class:
- The guard tracks currently executing `{capability, phase}` pairs in a private stack.
- Before executing a lifecycle, it checks if the same pair is already in progress.
- If so, it logs an error and aborts further execution, preventing infinite recursion.
- The stack is updated as lifecycle execution begins and ends.

This guard ensures that even if a manifest or handler mapping accidentally points to a wrapper method, the platform will not enter a runaway recursion.

## Consequences
- The platform is robust against manifest or codegen errors that would otherwise cause infinite lifecycle loops.
- Codegen and template logic should avoid generating manifests that map lifecycle hooks to wrapper methods, but the guard provides a last-resort safety net.
- Developers and test authors can safely run and extend platform contract logic without risk of memory exhaustion due to lifecycle orchestration.

## Actions
- Update codegen and EJS templates to ensure lifecycle hooks always reference custom handler methods, never the orchestration wrapper.
- Document this guard in platform contract and developer guides.
- Retain the guard in `BaseMFE` as a permanent safety feature.

## References
- REQ-042: Lifecycle hook execution semantics
- REQ-054: BaseMFE abstract class contract
- Test: `src/runtime/__tests__/base-mfe.unit.test.ts` (heap out of memory error resolved)
