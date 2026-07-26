[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / toProvidedSlotAddress

# Function: toProvidedSlotAddress()

> **toProvidedSlotAddress**(`providerMfeId`, `declaredSlotId`): `string`

Defined in: packages/contracts/src/slot-contract.ts:50

Compose the stable host address for an MFE-provided local slot id.

Path composition is host-owned (ADR-068): a local id containing "/" could
mint an address outside the provider's own prefix (provider `a` +
`b/main` colliding with provider `a/b` + `main`), so it is rejected here —
the one seam every registration crosses, including contract-bypassing
callers that never ran the manifest guard.

## Parameters

### providerMfeId

`string`

### declaredSlotId

`string`

## Returns

`string`
