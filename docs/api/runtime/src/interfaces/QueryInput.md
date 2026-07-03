[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / QueryInput

# Interface: QueryInput

Defined in: [packages/runtime/src/context.ts:138](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L138)

Shape of context.inputs expected by the query capability.
Pass via ContextFactory.create({ inputs: { document, variables } })
or ContextFactory.cloneForCapability(ctx, 'query', { document, variables }).

## Properties

### bffUrl?

> `optional` **bffUrl**: `string`

Defined in: [packages/runtime/src/context.ts:150](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L150)

Caller-supplied BFF URL override — takes priority over all manifest/env defaults.
Use this when the shell knows the remote's absolute BFF endpoint
(e.g. 'http://localhost:3001/graphql') but the MFE's manifest has only a
relative serve.endpoint path. Omit when the manifest's `endpoint` field provides
the full origin already.

***

### document

> **document**: `string`

Defined in: [packages/runtime/src/context.ts:140](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L140)

GraphQL document string

***

### variables?

> `optional` **variables**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/context.ts:142](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L142)

GraphQL variables
