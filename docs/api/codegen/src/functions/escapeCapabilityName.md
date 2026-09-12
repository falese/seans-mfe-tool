[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / escapeCapabilityName

# Function: escapeCapabilityName()

> **escapeCapabilityName**(`name`): `string`

Defined in: [packages/codegen/src/variants/shared.ts:31](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/shared.ts#L31)

Escape a capability name for use inside a RegExp.

Lives here rather than once per variant: it was copied verbatim into both
built-ins, and a variant author copying a third time is how the escaping
eventually gets dropped from one of them. A capability name is manifest text
— `Order.Detail` or `A+B` compile to a pattern that matches the wrong files
unescaped.

## Parameters

### name

`string`

## Returns

`string`
