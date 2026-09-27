[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CapabilityScaffold

# Interface: CapabilityScaffold

Defined in: [packages/dsl/src/schema.ts:714](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L714)

Capability scaffold request

## Properties

### basePath

> **basePath**: `string`

Defined in: [packages/dsl/src/schema.ts:717](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L717)

***

### config

> **config**: `object`

Defined in: [packages/dsl/src/schema.ts:716](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L716)

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

> `optional` **after**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `errorHandling?`: \{ `types`: `object`[]; \}; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `onTimeout?`: `"skip"` \| `"error"` \| `"warn"`; `source?`: `string`; `timeout?`: `number`; \}\>[]

##### lifecycle.before?

> `optional` **before**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `errorHandling?`: \{ `types`: `object`[]; \}; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `onTimeout?`: `"skip"` \| `"error"` \| `"warn"`; `source?`: `string`; `timeout?`: `number`; \}\>[]

##### lifecycle.error?

> `optional` **error**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `errorHandling?`: \{ `types`: `object`[]; \}; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `onTimeout?`: `"skip"` \| `"error"` \| `"warn"`; `source?`: `string`; `timeout?`: `number`; \}\>[]

##### lifecycle.main?

> `optional` **main**: `Record`\<`string`, \{ `contained?`: `boolean`; `description?`: `string`; `errorHandling?`: \{ `types`: `object`[]; \}; `handler`: `string` \| `string`[]; `mandatory?`: `boolean`; `onTimeout?`: `"skip"` \| `"error"` \| `"warn"`; `source?`: `string`; `timeout?`: `number`; \}\>[]

#### outputs?

> `optional` **outputs**: `object`[]

#### type

> **type**: `"platform"` \| `"domain"` = `CapabilityTypeSchema`

***

### name

> **name**: `string`

Defined in: [packages/dsl/src/schema.ts:715](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L715)
