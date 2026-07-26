[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MFE\_LIFECYCLE\_TRANSITIONS

# Variable: MFE\_LIFECYCLE\_TRANSITIONS

> `const` **MFE\_LIFECYCLE\_TRANSITIONS**: `Readonly`\<`Record`\<[`MfeLifecycleState`](../type-aliases/MfeLifecycleState.md), readonly [`MfeLifecycleState`](../type-aliases/MfeLifecycleState.md)[]\>\>

Defined in: [packages/contracts/src/platform-contract.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/platform-contract.ts#L59)

The legal edges of the machine: `from → to[]`. A transition not listed here
is a programming error and throws at the boundary rather than corrupting
MFE state silently (ADR-042).
