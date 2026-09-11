[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / PlanIO

# Interface: PlanIO

Defined in: [packages/codegen/src/file-plan.ts:72](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L72)

The filesystem operations a plan needs, injected so the plan stays pure.

## Methods

### exists()

> **exists**(`templatePath`): `Promise`\<`boolean`\>

Defined in: [packages/codegen/src/file-plan.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L73)

#### Parameters

##### templatePath

`string`

#### Returns

`Promise`\<`boolean`\>

***

### render()

> **render**(`templatePath`, `vars`): `Promise`\<`string`\>

Defined in: [packages/codegen/src/file-plan.ts:74](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L74)

#### Parameters

##### templatePath

`string`

##### vars

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`string`\>
