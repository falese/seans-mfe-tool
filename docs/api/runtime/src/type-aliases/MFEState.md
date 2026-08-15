[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / MFEState

# Type Alias: MFEState

> **MFEState** = [`MfeLifecycleState`](../../../contracts/src/type-aliases/MfeLifecycleState.md)

Defined in: [packages/runtime/src/base-mfe.ts:204](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-mfe.ts#L204)

MFE lifecycle state. The states and their legal edges are defined once in
`@falese/smt-contracts` (ADR-080); this is the runtime's name for the same
type, kept because generated MFEs and the runtime's public surface refer to
it as `MFEState`.
