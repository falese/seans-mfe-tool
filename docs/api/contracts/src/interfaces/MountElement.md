[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MountElement

# Interface: MountElement

Defined in: [packages/contracts/src/presentation.ts:31](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L31)

The host-owned element an imperative handle mounts into. Structural so the
neutral contract needs no DOM lib; the provider and the MFE's mount
implementation cast to their concrete element type (e.g. HTMLElement).

## Methods

### appendChild()

> **appendChild**(`child`): `unknown`

Defined in: [packages/contracts/src/presentation.ts:32](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L32)

#### Parameters

##### child

`unknown`

#### Returns

`unknown`
