[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CapabilityScaffold

# Interface: CapabilityScaffold

Defined in: [packages/dsl/src/schema.ts:616](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L616)

Capability scaffold request

## Properties

### basePath

> **basePath**: `string`

Defined in: [packages/dsl/src/schema.ts:619](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L619)

***

### config

> **config**: `object`

Defined in: [packages/dsl/src/schema.ts:618](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L618)

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

Defined in: [packages/dsl/src/schema.ts:617](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L617)
