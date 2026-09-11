[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / featureSpecs

# Function: featureSpecs()

> **featureSpecs**(`ctx`, `capability`): [`FileSpec`](../interfaces/FileSpec.md)[]

Defined in: [packages/codegen/src/variants/shared.ts:226](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/shared.ts#L226)

One capability's three files: the component, its barrel, and its test.

All developer-owned — this is domain implementation, not scaffolding the
platform can rebuild, which is why `--force` cannot reach them either
(ADR-089 §3). A capability already realised in code is omitted entirely by
the caller rather than emitted and skipped.

## Parameters

### ctx

[`GenPlanContext`](../interfaces/GenPlanContext.md)

### capability

`string`

## Returns

[`FileSpec`](../interfaces/FileSpec.md)[]
