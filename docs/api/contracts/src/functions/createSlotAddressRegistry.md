[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / createSlotAddressRegistry

# Function: createSlotAddressRegistry()

> **createSlotAddressRegistry**(`providers`): [`SlotAddressRegistry`](../interfaces/SlotAddressRegistry.md)

Defined in: [packages/contracts/src/slot-contract.ts:172](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/slot-contract.ts#L172)

Build the fleet's address space from the providers' manifests.

Unqualified addresses (`root`, the LayoutManager's default `main`) are
host-owned: no MFE manifest declares them and none can, so they are accepted
without a contract to check against (ADR-067 boundary).

## Parameters

### providers

readonly [`SlotProviderDeclarations`](../interfaces/SlotProviderDeclarations.md)[]

## Returns

[`SlotAddressRegistry`](../interfaces/SlotAddressRegistry.md)
