---
id: 0053
title: "RemoteMFE.doQuery — Remove throw; BaseMFE.doQuery is sufficient for all MFE+BFF combinations"
status: Implemented
date: 2026-06-03
deciders: [sean]
enforcement: code
supersedes: []
superseded-by: []
tags: [runtime, base-mfe, remote-mfe, bff, doquery, codegen]
summary: >
  The RemoteMFE.doQuery override that threw "Query not supported for remote MFE type"
  is removed. BaseMFE.doQuery already handles URL resolution (inputs.bffUrl, manifest,
  env, fallback), header forwarding, and error shaping for all MFE+BFF combinations.
  The throw was blocking RemoteMFE+BFF subclasses and forcing codegen to emit duplicated
  fetch logic as a workaround. The generated doQuery override and its fetchBff helper
  are also removed — the inheritance chain now works without them.
long-form: true
---

# ADR-053: RemoteMFE.doQuery — Remove throw; BaseMFE.doQuery is sufficient

## Context

`BaseMFE.doQuery` became a concrete method (not abstract) when the BFF query capability
was wired up. At that point, `RemoteMFE` added an override that threw unconditionally:

```typescript
protected override async doQuery(context: Context): Promise<QueryResult> {
  throw new Error('Query not supported for remote MFE type');
}
```

Intent: fail fast and clearly for Module Federation MFEs that have no BFF. This was
reasonable when all remote MFEs were UI-only.

**The problem emerged in ADR-052 (mock switch).** The generated `mfe.ts` for a
`RemoteMFE + BFF` (e.g. `abckidsflappyMFE`) needed to make BFF HTTP calls via
`mfe.query()`. `super.doQuery(context)` was blocked by the throw in `RemoteMFE`.
Workarounds accumulated:

1. Module-level `fetchBff()` function in the codegen template — duplicating the fetch
   logic already in `BaseMFE.doQuery`.
2. `super.doQuery()` attempt — still blocked; `RemoteMFE.doQuery` is what `super`
   resolves to in a `RemoteMFE` subclass.
3. `BaseMFE.prototype.doQuery.call(this, context)` was considered but requires awkward
   prototype gymnastics and bypasses the natural inheritance contract.

Two alternative extraction approaches were evaluated and rejected before arriving here:

- **Protected `fetchFromBff()` helper on `BaseMFE`** — the existing `protected` surface
  on `BaseMFE` (`assertState`, `transitionState`, `executeLifecycle`, `invokeHandler`)
  is entirely framework/lifecycle infrastructure. Adding a concrete HTTP transport method
  would bleed implementation concerns into an abstract capability class.
- **Standalone utility module** (`src/runtime/util/bff-fetch.ts`) — solves duplication
  but adds a module boundary for a problem that only exists because of the throw.

Both approaches add complexity to work around a constraint that should not exist.

**Root cause: the throw in `RemoteMFE.doQuery` is wrong.** `BaseMFE.doQuery` already
handles every case a `RemoteMFE + BFF` subclass needs:

| Scenario | BaseMFE.doQuery behaviour |
|---|---|
| Caller provides `context.inputs.bffUrl` | Uses it directly (highest priority) |
| `this.deps.bffUrl` set via constructor | Used as fallback |
| `process.env.BFF_URL` | Used as fallback |
| Manifest has `endpoint + data.serve.endpoint` | Derived URL used |
| Nothing configured | Falls back to `'/graphql'` (relative) |

## Decision

### 1. Remove RemoteMFE.doQuery

The override is deleted. `BaseMFE.doQuery` becomes the single implementation for all
MFE types. A raw `RemoteMFE` without a BFF manifest will fall through to the
`'/graphql'` fallback URL and receive an HTTP error — a clear, debuggable signal that
the MFE is misconfigured, arguably more useful than an immediate JS throw which can be
harder to attribute to a missing BFF in a federated runtime.

### 2. Remove the generated doQuery override from mfe.ts.ejs

The generated override and its module-level `fetchBff()` helper existed only because
`super.doQuery` was blocked. With the throw removed, the inheritance chain works:

```
abckidsflappyMFE.query()     ← public lifecycle wrapper (BaseMFE)
  → BaseMFE.doQuery()        ← resolves URL, builds headers, fetches, shapes result
```

No generated override is needed. The codegen template no longer emits a `doQuery`
override or a `fetchBff` helper for BFF-enabled MFEs.

The typed `bff.ts` connector (`import { query as bffQuery }`) is no longer imported
into `mfe.ts`. It remains available for MFE component code that wants a type-safe
GraphQL client directly (not via the `mfe.query()` lifecycle).

### 3. Contract for RemoteMFE without BFF

A `RemoteMFE` subclass that calls `mfe.query()` without a BFF manifest configured will
receive `{ data: null, errors: [{ message: 'BFF request failed: 404 ...' }] }`. This
is a runtime error visible in the query result rather than a call-site JS exception.
The `GameLauncher` `fetchPets` already handles this gracefully (empty pets array).

## Consequences

**Positive:**
- Inheritance chain is correct and natural — no workarounds in generated code
- Codegen emits less per-MFE boilerplate
- `BaseMFE` stays clean (no concrete transport helpers on the abstract class)
- BFF fetch semantics are defined once, in `BaseMFE.doQuery`

**Negative / constraints:**
- A misconfigured `RemoteMFE` (no BFF, but `query()` called) now fails at HTTP layer
  rather than at the JS throw. Monitoring/observability should catch this; test coverage
  for the misconfigured case should use `BaseMFE.doQuery` tests directly.

## References

- ADR-012 (GraphQL Mesh BFF layer)
- ADR-041 (BaseMFE abstract class contract)
- ADR-052 (BFF demo-mode mock switch — origin of the workarounds removed here)
