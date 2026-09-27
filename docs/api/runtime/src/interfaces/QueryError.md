[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / QueryError

# Interface: QueryError

Defined in: [packages/runtime/src/capability-results.ts:97](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L97)

One error in a query result.

A GraphQL error from the BFF carries `message` and `path`. A transport
failure (a non-2xx, or no response at all) also carries `type`, `retryable`
and `status`, classified by `classifyHttpOutcome` (ADR-106), so a caller can
tell a transient 503 from a misconfigured endpoint without parsing text.

## Properties

### message

> **message**: `string`

Defined in: [packages/runtime/src/capability-results.ts:98](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L98)

***

### path?

> `optional` **path**: `string`[]

Defined in: [packages/runtime/src/capability-results.ts:99](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L99)

***

### retryable?

> `optional` **retryable**: `boolean`

Defined in: [packages/runtime/src/capability-results.ts:101](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L101)

***

### status?

> `optional` **status**: `number`

Defined in: [packages/runtime/src/capability-results.ts:103](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L103)

HTTP status; 0 when no response arrived.

***

### type?

> `optional` **type**: `"network"` \| `"validation"` \| `"business"` \| `"security"`

Defined in: [packages/runtime/src/capability-results.ts:100](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/capability-results.ts#L100)
