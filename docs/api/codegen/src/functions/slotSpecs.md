[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / slotSpecs

# Function: slotSpecs()

> **slotSpecs**(`ctx`): [`FileSpec`](../interfaces/FileSpec.md)[]

Defined in: [packages/codegen/src/variants/shared.ts:200](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/shared.ts#L200)

The slot contract sugar (ADR-067), when the manifest declares slots and the
variant ships a template for it.

Always generator-owned so the code can never register a slot id the manifest
does not declare — declaration and behaviour share one source.

## Parameters

### ctx

[`GenPlanContext`](../interfaces/GenPlanContext.md)

## Returns

[`FileSpec`](../interfaces/FileSpec.md)[]
