# ADR-069: Separate authentication boundary from authorization handlers

**Status:** Accepted
**Date:** 2026-05-06
**Supersedes (in part):** ADR-058 (Platform Handler Library) — clarifies that the platform handler library is authorization-only.

## Context

The original platform handler library exposed a single `platform.auth` family that conflated two concerns:

1. **Authentication** — `validateJWT(ctx)`: turn a bearer token into `ctx.user`. A boundary concern; happens once per request, before any capability runs.
2. **Authorization** — `checkPermissions(ctx, roles)`: decide whether the already-authenticated user may perform an action. A per-capability concern; may run multiple times in a single request (in `before`, in `authorizeAccess`, etc.).

This caused two problems:

- **Architectural blur.** Discussions of `authorizeAccess` (a capability) inevitably had to disentangle "but what about JWT validation?" Reviewers and new authors kept asking whether `platform.auth` belonged in `before` of every capability or just `authorizeAccess`.
- **Duplicate work.** When the host shell already authenticated the user upstream, capabilities would re-run `platform.auth` defensively, paying the JWT-verify cost on every call.

We want the framework's mental model to live in **one realm — authorization** — so that the platform handler library reads as a coherent set of policy primitives.

## Decision

Split the responsibilities along the authentication / authorization line:

| Concern         | Where it lives                                                  | Status                          |
| --------------- | --------------------------------------------------------------- | ------------------------------- |
| Authentication  | `src/runtime/auth-context.ts` (runtime boundary, exported from `@seans-mfe-tool/runtime`) | NOT a platform handler          |
| Authorization   | `src/runtime/handlers/authz.ts` (platform handler library)      | Reachable as `platform.authz.*` |

Concretely:

1. `validateJWT` moves out of `src/runtime/handlers/auth.ts` into `src/runtime/auth-context.ts` and is re-exported from the runtime barrel. It is **no longer reachable via the DSL `handler:` field**.
2. `checkPermissions` moves into `src/runtime/handlers/authz.ts`. It remains a platform handler, addressed as `platform.authz.checkPermissions` in DSL manifests.
3. `src/runtime/handlers/index.ts` re-exports `authz` as a namespace (`export * as authz from './authz'`) so the dynamic resolver in `BaseMFE.invokePlatformHandler` finds it under the `authz.checkPermissions` path.
4. The `platform.auth` handler family is **removed**. Manifests must migrate to either `platform.authz.checkPermissions` (for permission checks) or to relying on the host shell's authentication step (for JWT validation).
5. Telemetry: `validateJWT` events are tagged with `source: 'runtime.auth-context'`; `checkPermissions` events are renamed `authz.permissions.check` with `source: 'platform.authz.checkPermissions'`. Dashboards keying off the legacy `auth.permissions.check` event name need to be updated.

## Why this works

- **One realm, one library.** The platform handler library is now strictly authorization (and other policy primitives — validation, caching, rate-limiting, telemetry, error-handling). Authentication is a precondition the runtime expects, not a hook authors compose.
- **Cheaper.** JWT verification happens once at the boundary, not once per capability.
- **Simpler `authorizeAccess`.** The capability now consumes `ctx.user` and composes `platform.authz.*` primitives in its `before` and `main` phases. No nesting authentication inside authorization.

## Consequences

### Migration

This is a breaking change for any manifest that referenced `platform.auth`:

| Old                                          | New                                                          |
| -------------------------------------------- | ------------------------------------------------------------ |
| `handler: platform.auth` (intent: validate JWT) | Remove the hook. Ensure the host shell calls `validateJWT(ctx)` once before invoking the MFE. |
| `handler: platform.auth` (intent: gate by role) | `handler: platform.authz.checkPermissions` (and pass roles via the hook config / handler arg pattern). |
| `handler: [platform.auth, ...]` (parallel) | Same split as above; authentication leaves the handler array. |

Manifests are the source of truth; rebuild generated MFEs after migration with `seans-mfe-tool remote generate`.

### Test surface

`src/runtime/handlers/__tests__/auth.test.ts` is split into:

- `src/runtime/__tests__/auth-context.test.ts` — `validateJWT` behaviour
- `src/runtime/handlers/__tests__/authz.test.ts` — `checkPermissions` behaviour

### Documentation

- `docs/architecture-codegen-and-base-mfe.md` updated to reflect the new naming in §7's phase × handler matrix and §9's worked example.
- `docs/lifecycle-engine-analysis.md`, `docs/architecture-runtime-platform.md`, `docs/requirements/lifecycle-enhancements.md` updated.
- ADR-063 / ADR-064 / ADR-066 are not edited (locked decisions). Their `platform.auth` examples remain as-is and are understood to predate this ADR; readers should consult ADR-068 for current usage.

## Alternatives considered

1. **Rename only (`platform.auth` → `platform.authz`).** Rejected: keeps authentication and authorization in the same library and re-introduces the same conflation under a new name.
2. **Keep authentication as a platform handler but namespace it (`platform.authn` + `platform.authz`).** Rejected: implies authentication is composable into capabilities like a hook, which is exactly the design we're moving away from. Authentication is a precondition, not a capability ingredient.
3. **Auto-inject JWT validation in `BaseMFE` constructor.** Rejected: hides the boundary from the host shell, makes testing harder, and re-introduces per-capability cost.

## References

- ADR-058 — Platform Handler Library (parent)
- ADR-059 — Platform Handler Interface
- `src/runtime/auth-context.ts`
- `src/runtime/handlers/authz.ts`
