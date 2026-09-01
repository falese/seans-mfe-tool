[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / capabilityImplemented

# Function: capabilityImplemented()

> **capabilityImplemented**(`componentFilePath`, `name`, `variant`): `Promise`\<`boolean`\>

Defined in: [packages/codegen/src/template-io.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/template-io.ts#L47)

Detect whether a domain capability is already realized in code.

`remote:generate` should scaffold a capability's feature stub only when it
has not been implemented yet, and otherwise leave the file untouched. The
signal is the presence of an exported symbol matching the capability name in
its own feature file:
  - React:   `export const <Name>` / `function` / `class` / `default <Name>`
  - Angular: `export class <Name>Component`

Note: the generated stub already exports `<Name>`, so a capability counts as
"implemented" from the moment its file exists — which is the intended
hands-off behavior (features are user-owned once created). A missing file
means the capability has not been generated yet → returns false.

## Parameters

### componentFilePath

`string`

### name

`string`

### variant

`"react-rspack"` | `"angular-webpack"`

## Returns

`Promise`\<`boolean`\>
