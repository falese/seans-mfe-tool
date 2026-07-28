[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / AttributeValue

# Type Alias: AttributeValue

> **AttributeValue** = `string` \| `number` \| `boolean` \| `string`[] \| `number`[] \| `boolean`[]

Defined in: [packages/contracts/src/observability.ts:34](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L34)

The OTel primitive attribute set. Anything outside it cannot be exported
without lossy coercion, so it is not representable here either.

Names follow OTel semantic conventions where one exists (`service.name`,
`error.type`) and a platform namespace where none does (`cli.command`,
`mfe.id`, `mfe.capability`, `mfe.phase`, `slot.address`, `codegen.template`).
