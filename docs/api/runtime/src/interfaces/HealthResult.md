[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / HealthResult

# Interface: HealthResult

Defined in: [packages/runtime/src/base-mfe.ts:135](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L135)

Result from health capability

## Properties

### checks

> **checks**: `object`[]

Defined in: [packages/runtime/src/base-mfe.ts:137](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L137)

#### message?

> `optional` **message**: `string`

#### name

> **name**: `string`

#### status

> **status**: `"pass"` \| `"fail"`

***

### status

> **status**: `"healthy"` \| `"degraded"` \| `"unhealthy"`

Defined in: [packages/runtime/src/base-mfe.ts:136](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L136)

***

### timestamp

> **timestamp**: `Date`

Defined in: [packages/runtime/src/base-mfe.ts:142](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L142)
