[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / HealthResult

# Interface: HealthResult

Defined in: [packages/runtime/src/base-mfe.ts:133](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L133)

Result from health capability

## Properties

### checks

> **checks**: `object`[]

Defined in: [packages/runtime/src/base-mfe.ts:135](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L135)

#### message?

> `optional` **message**: `string`

#### name

> **name**: `string`

#### status

> **status**: `"pass"` \| `"fail"`

***

### status

> **status**: `"healthy"` \| `"degraded"` \| `"unhealthy"`

Defined in: [packages/runtime/src/base-mfe.ts:134](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L134)

***

### timestamp

> **timestamp**: `Date`

Defined in: [packages/runtime/src/base-mfe.ts:140](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L140)
