[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / handleError

# Function: handleError()

> **handleError**(`context`, `error?`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/handlers/error-handling.ts:25](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/error-handling.ts#L25)

`error` is optional because this handler is dispatched by name
(`platform.handleError`, ADR-076) with only `context` — the engine sets
`context.error` before running error-phase hooks, so that is the fallback.
An explicit second argument still wins for direct (non-dispatched) calls.

Retry is not this handler's job: exponential-backoff retry is a separate,
already-implemented mechanism (`retry-wrapper.ts`, ADR-030) that wraps
capability execution rather than running as a lifecycle hook.

## Parameters

### context

[`Context`](../interfaces/Context.md)

### error?

`Error`

## Returns

`Promise`\<`void`\>
