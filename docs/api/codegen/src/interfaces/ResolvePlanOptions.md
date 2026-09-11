[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ResolvePlanOptions

# Interface: ResolvePlanOptions

Defined in: [packages/codegen/src/file-plan.ts:77](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L77)

## Properties

### basePath

> **basePath**: `string`

Defined in: [packages/codegen/src/file-plan.ts:79](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L79)

MFE root that `out` paths are relative to.

***

### ctx

> **ctx**: `unknown`

Defined in: [packages/codegen/src/file-plan.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L85)

Passed to each spec's `when` and `vars`.

***

### io

> **io**: [`PlanIO`](PlanIO.md)

Defined in: [packages/codegen/src/file-plan.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L86)

***

### roots

> **roots**: `Partial`\<`Record`\<[`TemplateRootName`](../type-aliases/TemplateRootName.md), `string`\>\> & `object`

Defined in: [packages/codegen/src/file-plan.ts:81](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L81)

Template roots by name. `variant` is required; others are per-spec.

#### Type Declaration

##### variant

> **variant**: `string`

***

### vars

> **vars**: `Record`\<`string`, `unknown`\>

Defined in: [packages/codegen/src/file-plan.ts:83](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L83)

The shared render model handed to every template.
