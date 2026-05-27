# ADR-072: Manifest-Declared Handler Sources

## Status

Accepted

## Context

The platform already supports custom lifecycle handlers (ADR-058, ADR-059). A
DSL manifest declares lifecycle hooks per capability/phase, the codegen stamps
a stub method into the generated `mfe.ts`, and `BaseMFE.invokeHandler`
(`src/runtime/base-mfe.ts:415-438`) resolves a hook name in three ways:

1. `platform.*` prefix → standard library in `src/runtime/handlers/`.
2. `deps.customHandlers[name]` → DI map injected at construction time.
3. Otherwise, reflection-call a method on the MFE subclass.

That mechanism covers two developer experiences:

- **In-class handlers**: edit the generated `mfe.ts` stub.
- **DI-injected handlers**: pass a `customHandlers` map in bootstrap code.

Neither is fully satisfactory once a project grows beyond a single MFE:

- Editing `mfe.ts` couples handler logic to the codegen template. The file is
  marked `overwrite: true` and is regenerated on every run.
- DI-injected handlers are imperative — they live in bootstrap code, not in
  the DSL manifest, so the manifest is no longer the single source of truth
  for what runs in each lifecycle phase.
- Neither approach makes it easy to share handlers across MFEs (e.g. a
  shared `@my-org/handlers` package).

The `handler` field in `LifecycleHookSchema` is currently a bare name string
— there is no way for a developer to declare in the manifest **where** the
handler's implementation comes from.

## Decision

Extend `LifecycleHookSchema` with an optional `source` field that points to
the module containing the handler implementation. The codegen emits a
generated `handler-registry.ts` that statically imports each sourced handler
and wires it into the existing `customHandlers` DI map via the constructor.

Manifest example:

```yaml
capabilities:
  - load:
      type: platform
      lifecycle:
        before:
          - validateInput:
              handler: validateInput
              source: ./handlers/validation              # relative path
          - checkEmail:
              handler: checkEmail
              source: '@my-org/handlers#validateEmail'   # module + named export
```

`source` grammar:

| Form | Example | Resolution |
|---|---|---|
| Relative path | `./handlers/validation` | `import { <hookName> } from './handlers/validation'` |
| Bare module | `@my-org/handlers` | `import <hookName> from '@my-org/handlers'` (default export) |
| Module + export | `@my-org/handlers#validateEmail` | `import { validateEmail as <hookName> } from '@my-org/handlers'` |

The runtime resolution path is unchanged. The generated `handler-registry.ts`
satisfies the existing DI branch (lines 426-429 of `base-mfe.ts`), so
`invokeHandler` finds the function without any new code path.

Hooks **without** `source` keep today's behaviour: codegen emits a stub
method on the generated MFE class, and `invokeHandler` resolves through the
existing method-reflection fallback.

## Consequences

- The DSL manifest becomes the single declarative source of truth for both
  *which* handler runs and *where its implementation lives*.
- Handlers can be organised in their own files or shared via published
  packages without hand-editing `mfe.ts` or wiring DI in bootstrap code.
- Backwards compatible — manifests without `source` generate identically to
  today; `handler-registry.ts` is emitted only when at least one hook
  declares a source.
- Same mechanism works in both `RemoteMFE` (React) and `AngularRemoteMFE`
  because the dispatch lives in `BaseMFE`. The codegen change is identical
  for both template variants.
- The existing "Custom handler not found" error from `BaseMFE.invokeCustomHandler`
  is extended to point users at `source:` as an alternative discovery path.

## Alternatives Considered

- **Extend `customHandlers` resolution to do dynamic `import()`** — rejected
  because async imports during lifecycle dispatch add latency to every hook
  invocation and complicate failure modes (module-not-found during a hot
  path). Static codegen imports keep failures at build time.
- **Introduce a separate `handlers:` section in the manifest** — rejected
  because the hook declaration already names the handler. Adding `source:`
  next to `handler:` keeps the locality.
- **Generate handler stubs into separate files automatically** — rejected.
  This forces a directory layout on the developer; `source:` lets them
  choose where their handlers live.

## Traceability

- ADR-058: Platform Handler Library Standardization (prior art for `platform.*`)
- ADR-059: Platform Handler Interface
- REQ-057: Custom handlers
- Files touched:
  - `src/dsl/schema.ts` — `source` field on `LifecycleHookSchema`
  - `src/codegen/UnifiedGenerator/unified-generator.ts` — collect `handlerSources`, suppress stubs for sourced hooks, emit `handler-registry.ts`
  - `src/codegen/templates/base-mfe/{mfe.ts.ejs,handler-registry.ts.ejs}`
  - `src/codegen/templates/base-mfe-angular/{mfe.ts.ejs,handler-registry.ts.ejs}`
  - `src/runtime/base-mfe.ts` — extended error hint in `invokeCustomHandler`
