[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CapabilityScaffold

# Interface: CapabilityScaffold

Defined in: [packages/dsl/src/schema.ts:667](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L667)

Capability scaffold request

## Properties

### basePath

> **basePath**: `string`

Defined in: [packages/dsl/src/schema.ts:670](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L670)

***

### config

> **config**: `object`

Defined in: [packages/dsl/src/schema.ts:669](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L669)

#### authorization?

> `optional` **authorization**: `string`

#### description?

> `optional` **description**: `string`

#### handler?

> `optional` **handler**: `string`

#### inputs?

> `optional` **inputs**: `object`[]

#### lifecycle?

> `optional` **lifecycle**: `object`

##### lifecycle.after?

> `optional` **after**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]

##### lifecycle.before?

> `optional` **before**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]

##### lifecycle.error?

> `optional` **error**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]

##### lifecycle.main?

> `optional` **main**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `source?`: `string`; \}\>[]

#### outputs?

> `optional` **outputs**: `object`[]

#### type

> **type**: `"platform"` \| `"domain"` = `CapabilityTypeSchema`

***

### name

> **name**: `string`

Defined in: [packages/dsl/src/schema.ts:668](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L668)
