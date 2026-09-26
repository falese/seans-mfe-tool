[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / RenderCapability

# Interface: RenderCapability

Defined in: [packages/codegen/src/render-model.ts:61](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/render-model.ts#L61)

One capability row in the render model.

## Properties

### config

> **config**: `object`

Defined in: [packages/codegen/src/render-model.ts:63](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/render-model.ts#L63)

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

### method

> **method**: `string`

Defined in: [packages/codegen/src/render-model.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/render-model.ts#L62)

***

### returnTypeBase

> **returnTypeBase**: `string`

Defined in: [packages/codegen/src/render-model.ts:64](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/render-model.ts#L64)

***

### stubBody

> **stubBody**: `string`

Defined in: [packages/codegen/src/render-model.ts:65](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/render-model.ts#L65)
