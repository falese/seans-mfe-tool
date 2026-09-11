[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / resolveFilePlan

# Function: resolveFilePlan()

> **resolveFilePlan**(`plan`, `options`): `Promise`\<[`ResolvedPlan`](../interfaces/ResolvedPlan.md)\>

Defined in: [packages/codegen/src/file-plan.ts:138](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L138)

Turn a plan into concrete files.

Emits a diagnostic rather than throwing when a required template is absent:
the generator's job is to report what it could not do and produce everything
else, not to abandon 20 correct files because the 21st has no template.

## Parameters

### plan

readonly [`FileSpec`](../interfaces/FileSpec.md)[]

### options

[`ResolvePlanOptions`](../interfaces/ResolvePlanOptions.md)

## Returns

`Promise`\<[`ResolvedPlan`](../interfaces/ResolvedPlan.md)\>
