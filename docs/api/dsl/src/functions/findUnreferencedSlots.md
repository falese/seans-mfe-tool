[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / findUnreferencedSlots

# Function: findUnreferencedSlots()

> **findUnreferencedSlots**(`declarations`, `sources`): [`UnreferencedSlotFinding`](../interfaces/UnreferencedSlotFinding.md)[]

Defined in: [packages/dsl/src/slot-validation.ts:66](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/slot-validation.ts#L66)

Report declared slots that no source file mentions.

**This is a lint, not a proof.** It catches dead declarations, typos, and
slots removed from a component but left in the manifest. It cannot see
conditional registration, and an id assembled from non-literal parts will
evade it. Proving the opposite — that every declared slot is really
registered — would mean rendering every capability with props the platform
cannot invent.

## Parameters

### declarations

readonly [`ProvidedSlotDeclaration`](../../../contracts/src/interfaces/ProvidedSlotDeclaration.md)[]

### sources

readonly [`SourceFile`](../interfaces/SourceFile.md)[]

## Returns

[`UnreferencedSlotFinding`](../interfaces/UnreferencedSlotFinding.md)[]
