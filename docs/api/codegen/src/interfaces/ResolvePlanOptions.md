[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ResolvePlanOptions

# Interface: ResolvePlanOptions

Defined in: [packages/codegen/src/file-plan.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L86)

## Properties

### basePath

> **basePath**: `string`

Defined in: [packages/codegen/src/file-plan.ts:88](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L88)

MFE root that `out` paths are relative to.

***

### ctx

> **ctx**: `unknown`

Defined in: [packages/codegen/src/file-plan.ts:98](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L98)

Passed to each spec's `when` and `vars`.

***

### io

> **io**: [`PlanIO`](PlanIO.md)

Defined in: [packages/codegen/src/file-plan.ts:99](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L99)

***

### roots

> **roots**: `Record`\<`string`, `string`\> & `object`

Defined in: [packages/codegen/src/file-plan.ts:94](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L94)

Template roots by name. `variant` is required; others are contributor ids.
Build it with [mergeTemplateRoots](../functions/mergeTemplateRoots.md) rather than by spreading — a
contributor id colliding with `variant` is otherwise a silent takeover.

#### Type Declaration

##### variant

> **variant**: `string`

***

### vars

> **vars**: `Record`\<`string`, `unknown`\>

Defined in: [packages/codegen/src/file-plan.ts:96](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L96)

The shared render model handed to every template.
