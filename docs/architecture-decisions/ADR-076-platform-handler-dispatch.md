---
id: 0076
title: Platform handlers dispatch by exported function name from a static library, not a registry class
status: Implemented
date: 2026-07-26
deciders: [sean]
area: Runtime handlers
enforcement: code
tags: [runtime, platform-handlers, lifecycle, dispatch, registry]
relates-to: [2, 4, 24, 30, 41]
supersedes: [25]
superseded-by: []
implements-pdr: [2]
implemented-by:
  - packages/runtime/src/base-mfe.ts
  - packages/runtime/src/capability-pipeline.ts
  - packages/runtime/src/handlers/index.ts
  - packages/runtime/src/handlers/auth.ts
  - packages/runtime/src/handlers/validation.ts
  - packages/runtime/src/handlers/telemetry.ts
  - packages/runtime/src/handlers/caching.ts
  - packages/runtime/src/handlers/rate-limiting.ts
  - packages/runtime/src/handlers/error-handling.ts
verified-by:
  - packages/runtime/src/__tests__/platform-handler-dispatch.test.ts
  - packages/runtime/src/handlers/__tests__/auth.test.ts
  - packages/runtime/src/handlers/__tests__/validation.test.ts
  - packages/runtime/src/handlers/__tests__/telemetry.test.ts
  - packages/runtime/src/handlers/__tests__/caching.test.ts
  - packages/runtime/src/handlers/__tests__/rate-limiting.test.ts
  - packages/runtime/src/handlers/__tests__/error-handling.test.ts
tracked-by: []
summary: >-
  Platform handlers are plain async functions of shape (context: Context) => Promise<unknown>,
  exported from packages/runtime/src/handlers/ and resolved by their literal export name from a
  static Map built once at module load. A manifest hook names one with `handler:
  'platform.<exportName>'`; ADR-002's before/main/after/error execution model — not a registry
  class — decides when it runs and what happens if it fails. There is no PlatformHandlerRegistry,
  no PlatformHandler interface, and no runtime register()/unregister() API.
rationale-summary: >-
  ADR-025 proposed a registry class and a name/phases/errorConfig/execute interface. What
  shipped is simpler: BaseMFE already owns sequencing and error semantics (ADR-002) and the DSL
  already owns per-hook config (mandatory, contained, handler arrays — ADR-004), so a handler
  only had to be a function the engine could find by name. Naming this after the fact, instead of
  building the registry ADR-025 specified, is the smaller and more honest change.
long-form: true
---

## Context

Issue #317 was filed to close ADR-025's two unchecked Validation Criteria boxes
(integration tests, 100% handler coverage). Its own text warned the other seven
checked boxes might not hold — "the checklist predates several runtime
changes" — and asked whoever picked it up to confirm before treating only the
two unchecked boxes as the remaining work.

They don't hold. Auditing `packages/runtime/src/base-mfe.ts` and
`packages/runtime/src/handlers/` against ADR-025's Decision section found the
described system was never built:

1. **No `PlatformHandlerRegistry`.** `grep -rn "PlatformHandlerRegistry\|class.*Registry" packages/runtime/src`
   returns nothing. No `register()`, `unregister()`, `resolve()`, or
   `listHandlers()` exists anywhere in the runtime package.
2. **No `PlatformHandler` interface.** Handlers have no `name`, `phases`, or
   `errorConfig` property and no `.execute(context, phase)` method. They are
   plain functions: `export async function validateJWT(context: Context):
   Promise<void>`.
3. **The DSL shape in ADR-025's own example doesn't parse against the real
   schema.** ADR-025 shows `auth: true`, `validation: { inputSchema: {...} }`
   as top-level manifest fields. `DSLManifestSchema`
   (`packages/dsl/src/schema.ts`) has no such fields. The shape that does
   exist and is `Implemented` (ADR-002, ADR-004) is
   `lifecycle.before/main/after/error: [{ hookName: { handler: 'platform.X',
   mandatory, contained } }]`.
4. **The handler names in that same example don't resolve.** `auth: true`
   implies a handler literally named `auth`. The exported function is
   `validateJWT`. `platform.auth` was never resolvable; `platform.validateJWT`
   is what actually works, because resolution is by *export name*
   (`packages/runtime/src/base-mfe.ts:265`, `PLATFORM_HANDLER_LIBRARY`), not
   by a registry-assigned symbolic name.
5. **"Custom handlers can be registered at runtime" is not what happens.**
   Custom handlers are supplied once, at construction, via
   `BaseMFEDependencies.customHandlers` (constructor DI) or resolved as an
   instance method on the MFE subclass (`invokeCustomHandler`). There is no
   live registry to register into after the fact.
6. **"Error handling strategy tested (blocking, non-blocking, retry)" credits
   this ADR with retry it doesn't implement.** `error-handling.ts`'s
   `handleError` had a comment reading "Example: retry logic could be added
   here" — nothing was there. Exponential-backoff retry is real and tested,
   but it lives in `retry-wrapper.ts` under ADR-030, wrapping capability
   execution — a different mechanism this ADR doesn't touch.
7. **Two handlers could not survive being dispatched by the mechanism they
   claim to participate in.** `PLATFORM_HANDLER_LIBRARY` is built from every
   function the `./handlers` barrel exports, called as `handlerFn(context)` —
   one argument. `checkPermissions(context, requiredRoles: string[])` and the
   pre-fix `handleError(context, error: Error)` both require a second
   argument dispatch never supplies. Nothing caught this because nothing had
   ever invoked either through `platform.*` name resolution — both were only
   ever unit-tested by calling the exported function directly. `handleError`
   is fixed by this ADR (§3); `checkPermissions` is not (see Boundaries).

What ADR-025 got right in substance, if not in the letter of its interface:
handler selection *is* DSL-driven, handlers *do* run sequentially, context
*does* flow between them, and every handler *does* emit telemetry. Those
properties hold — under ADR-002's model, not ADR-025's registry.

## Decision

### 1. A handler is a function, not an object

A platform handler is `(context: Context) => Promise<unknown>`, exported from
a module under `packages/runtime/src/handlers/`. It participates in dispatch
by nothing more than being an exported function — there is no separate
registration step and no interface it must implement beyond that call
signature.

### 2. Resolution is by literal export name, from a name → function `Map` built once at module load

`packages/runtime/src/handlers/index.ts` re-exports every handler module.
`packages/runtime/src/base-mfe.ts` builds `PLATFORM_HANDLER_LIBRARY` from that
barrel once, at import time — filtering to functions, keyed by their export
name. A DSL manifest hook names a platform handler as `platform.<exportName>`
(e.g. `platform.validateJWT`, not `platform.auth`); `invokeHandler` strips the
`platform.` prefix and does one `Map.get()`. DI (`deps.platformHandlers`) can
override any name ahead of the static library, without touching it.

### 3. A dispatched handler receives exactly one argument: `context`

Any data a platform handler needs beyond what's already conventional on
`Context` (`context.jwt`, `context.inputs`, `context.error`, ...) is not
available to it when invoked through `platform.*` dispatch. `handleError`
previously required a second `error: Error` argument that dispatch could never
supply; it now defaults to `context.error` (already set by the engine before
error-phase hooks run — REQ-042) when the second argument is omitted. This is
the pattern any future handler needing "extra" data must follow: read it off
`context`, don't add a parameter.

### 4. Execution order, error propagation, and array/mandatory/contained semantics are ADR-002's and ADR-004's, unchanged

This ADR governs *how a handler is found*, not what happens once it runs or
fails. Sequencing (before → main → after/error), `mandatory`, `contained`,
and handler-array execution are ADR-002 and ADR-004, both already
`Implemented`. Retry is ADR-030's `retry-wrapper.ts`, wrapping capability
execution — not a lifecycle hook a manifest names.

### 5. Custom handlers resolve through the same one-argument contract, in DI-then-instance-method order

`invokeHandler` checks `deps.customHandlers[fullName]`, then
`deps.customHandlers[lastSegment]`, then falls back to an instance method of
the same name on the MFE subclass (`invokeCustomHandler`). No live registry;
resolution order is fixed and documented at each call site, not configured.

## Boundaries

- **`checkPermissions(context, requiredRoles: string[])` is not
  dispatch-safe.** Unlike `error`, there is no `context.requiredRoles`
  convention to fall back to, and inventing one — or building a way for a
  DSL hook to pass per-invocation config into a handler call — is new
  wiring this ADR does not add. Until that exists, `checkPermissions` is a
  function other handler or domain code may call directly
  (`await checkPermissions(context, ['admin'])`), not a manifest-nameable
  `platform.checkPermissions` hook. `platform-handler-dispatch.test.ts`
  asserts this limitation (it throws) so a future fix has a red test to turn
  green, rather than a silent gap.
- **This does not touch ADR-024.** ADR-024 ("Platform Handler Library
  Standardization") is still `Proposed` and separately out of sync with what
  shipped (its principles are largely followed in practice, but nothing
  ratified them). Reconciling ADR-024 is not this ADR's job.
- **Six handlers exist in the library today** (`auth`, `validation`,
  `telemetry`, `caching`, `rate-limiting`, `error-handling`); ADR-025 named
  five (no `rate-limiting`). This ADR's `implemented-by` reflects the six
  that actually exist.

## Consequences

**Positive:**

- The record now matches `grep`. Nothing in `implemented-by` describes a file
  that doesn't exist.
- `handleError` is genuinely usable through the mechanism it was written for;
  it wasn't before this ADR.
- The two ADR-025 boxes issue #317 was filed to close are closed against the
  real system, not the proposed one: `platform-handler-dispatch.test.ts`
  exercises every dispatch-safe handler through `invokeHandler('platform.X',
  context)` on a real `BaseMFE` subclass, and per-handler unit coverage is
  effectively complete (see `verified-by`).

**Negative:**

- `checkPermissions` remains real, exported, present in
  `PLATFORM_HANDLER_LIBRARY`, and unusable by name — a live footgun for
  anyone who writes `handler: 'platform.checkPermissions'` in a manifest
  without reading this ADR. The regression test converts that from a silent
  trap into a documented, loud one, but doesn't remove it.
- A reader who only opens ADR-025 (now `Superseded`, but its body is
  historical prose, unedited per the project's ADR-editing discipline) will
  still see the registry-class design and has to follow the
  `superseded-by` link to learn it wasn't built that way.

## References

- ADR-025 — the superseded registry/interface proposal this ADR replaces.
- ADR-002 — the execution model (sequencing, mandatory/contained, telemetry
  on failure) this ADR's dispatch mechanism runs under, unchanged.
- ADR-004 — handler-array AND/OR semantics per phase, unchanged.
- ADR-030 — retry, implemented separately in `retry-wrapper.ts`, not in the <!-- adr-lint-ignore: reference-gloss-matches -->
  `error-handling` platform handler.
- ADR-024 — the still-`Proposed` handler-library principles ADR; out of
  scope here, noted for a future pass.
- #317 — the issue this ADR closes out.
