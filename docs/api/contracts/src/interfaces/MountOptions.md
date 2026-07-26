[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MountOptions

# Interface: MountOptions

Defined in: [packages/contracts/src/presentation.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L41)

Per-mount options. `capability` selects WHICH named domain capability to
render — MFEs are multi-capability by design (e.g. PlayGame, ShowCover,
GetGameInfo), so the host/registry picks one per mount. Omit it to use the
handle's bound default capability.

## Properties

### capability?

> `optional` **capability**: `string`

Defined in: [packages/contracts/src/presentation.ts:42](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L42)

***

### props?

> `optional` **props**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/presentation.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L43)
