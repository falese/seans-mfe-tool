[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ExperienceState

# Interface: ExperienceState

Defined in: [packages/contracts/src/messages.ts:190](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L190)

The daemon's per-experience state entry: the experience plus every action
submitted against it. Payload of a STATE_SNAPSHOT message.

## Properties

### actions

> **actions**: [`ActionRecord`](ActionRecord.md)[]

Defined in: [packages/contracts/src/messages.ts:192](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L192)

***

### experience

> **experience**: [`RenderedExperience`](RenderedExperience.md)

Defined in: [packages/contracts/src/messages.ts:191](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L191)

***

### lastUpdated

> **lastUpdated**: `string`

Defined in: [packages/contracts/src/messages.ts:193](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L193)
