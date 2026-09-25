[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / handleError

# Function: handleError()

> **handleError**(`context`, `error?`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/handlers/error-handling.ts:13](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/error-handling.ts#L13)

`error` is optional because this handler is dispatched by name
(`platform.handleError`, ADR-076) with only `context` — the engine sets
`context.error` before running error-phase hooks, so that is the fallback.
An explicit second argument still wins for direct (non-dispatched) calls.

Retry is not this handler's job: exponential-backoff retry (ADR-030) is
per-hook policy — `errorHandling` on a lifecycle hook — applied by
BaseMFE.invokeGuarded around the handler call, not a hook of its own.

## Parameters

### context

[`Context`](../interfaces/Context.md)

### error?

`Error`

## Returns

`Promise`\<`void`\>
