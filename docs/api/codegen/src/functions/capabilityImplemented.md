[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / capabilityImplemented

# Function: capabilityImplemented()

> **capabilityImplemented**(`componentFilePath`, `name`, `patterns`): `Promise`\<`boolean`\>

Defined in: [packages/codegen/src/template-io.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/template-io.ts#L47)

Detect whether a domain capability is already realized in code.

`remote:generate` scaffolds a capability's feature stub only when it has not
been implemented, and otherwise leaves the file alone. The signal is an
exported symbol matching the capability name — but *which* patterns count is
a framework question (React exports a const or function; Angular exports a
`<Name>Component` class), so the caller supplies them from the variant
rather than this module branching on a framework id (ADR-093).

Note: the generated stub already exports `<Name>`, so a capability counts as
implemented from the moment its file exists — the intended hands-off
behaviour, features being user-owned once created. A missing file means the
capability has not been generated yet.

## Parameters

### componentFilePath

`string`

### name

`string`

### patterns

readonly `RegExp`[]

## Returns

`Promise`\<`boolean`\>
