[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / validatePlacementRules

# Function: validatePlacementRules()

> **validatePlacementRules**(`documents`, `providers`): [`PlacementFinding`](../interfaces/PlacementFinding.md)[]

Defined in: [packages/dsl/src/slot-validation.ts:130](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/slot-validation.ts#L130)

Validate every `resolve.props.slot` in the supplied rule documents against
the fleet's declared address space.

A route with no `props.slot` is skipped: the LayoutManager applies its own
default, which is host-owned and not any MFE's to declare.

## Parameters

### documents

readonly [`PlacementRuleDocument`](../interfaces/PlacementRuleDocument.md)[]

### providers

readonly [`SlotProviderDeclarations`](../../../contracts/src/interfaces/SlotProviderDeclarations.md)[]

## Returns

[`PlacementFinding`](../interfaces/PlacementFinding.md)[]
