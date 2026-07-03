[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / selectHandle

# Function: selectHandle()

> **selectHandle**(`handles`, `hostFramework?`): [`PresentationHandle`](../type-aliases/PresentationHandle.md)

Defined in: [packages/contracts/src/presentation.ts:133](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/presentation.ts#L133)

The boundary negotiation primitive: pick the best handle for a host.
Returns a matching-framework native handle when one exists (integration),
otherwise the imperative floor (isolation). Pure and framework-neutral —
the single place the host/MFE framework match is decided.

## Parameters

### handles

[`PresentationHandles`](../interfaces/PresentationHandles.md)

### hostFramework?

`string`

## Returns

[`PresentationHandle`](../type-aliases/PresentationHandle.md)
