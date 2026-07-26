[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / HealthResult

# Interface: HealthResult

Defined in: [packages/runtime/src/base-mfe.ts:123](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L123)

Result from health capability

## Properties

### checks

> **checks**: `object`[]

Defined in: [packages/runtime/src/base-mfe.ts:125](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L125)

#### message?

> `optional` **message**: `string`

#### name

> **name**: `string`

#### status

> **status**: `"pass"` \| `"fail"`

***

### status

> **status**: `"healthy"` \| `"degraded"` \| `"unhealthy"`

Defined in: [packages/runtime/src/base-mfe.ts:124](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L124)

***

### timestamp

> **timestamp**: `Date`

Defined in: [packages/runtime/src/base-mfe.ts:130](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L130)
