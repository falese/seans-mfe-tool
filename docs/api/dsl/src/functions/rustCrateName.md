[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / rustCrateName

# Function: rustCrateName()

> **rustCrateName**(`manifest`): `string`

Defined in: [packages/dsl/src/browser-build.ts:39](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/browser-build.ts#L39)

Cargo package name: `targets.rust.crateName`, else the MFE name.

Hyphens are legal in a package name, so kebab-case passes through; anything
else illegal becomes `-`, and a leading digit gets an `mfe-` prefix.

## Parameters

### manifest

[`RustNamingInput`](../interfaces/RustNamingInput.md)

## Returns

`string`
