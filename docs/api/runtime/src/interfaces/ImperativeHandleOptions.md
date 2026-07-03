[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ImperativeHandleOptions

# Interface: ImperativeHandleOptions

Defined in: [packages/runtime/src/imperative-handle.ts:26](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/imperative-handle.ts#L26)

## Properties

### defaultCapability?

> `optional` **defaultCapability**: `string`

Defined in: [packages/runtime/src/imperative-handle.ts:42](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/imperative-handle.ts#L42)

The capability rendered when `mount` is called without an explicit one.
Multi-capability MFEs expose several (PlayGame, ShowCover, …); this is the
fallback when the host does not select one. A per-mount `options.capability`
always wins.

***

### framework?

> `optional` **framework**: `string`

Defined in: [packages/runtime/src/imperative-handle.ts:28](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/imperative-handle.ts#L28)

Observability / negotiation tag (e.g. 'react', 'angular').

***

### inputs?

> `optional` **inputs**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/imperative-handle.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/imperative-handle.ts#L47)

Extra base render inputs merged beneath the resolved capability and the
per-mount props. Rarely needed; `defaultCapability` covers the common case.

***

### mfeReady?

> `optional` **mfeReady**: `Promise`\<`unknown`\>

Defined in: [packages/runtime/src/imperative-handle.ts:35](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/imperative-handle.ts#L35)

The remote's bootstrap load() promise, if it kicks load off itself
(the generated bootstrap does). When provided, the handle awaits it
instead of calling load() again — no redundant load, no state-machine
churn. When absent, the handle calls load() on demand if available.
