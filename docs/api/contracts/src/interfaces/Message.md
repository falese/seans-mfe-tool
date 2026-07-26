[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / Message

# Interface: Message

Defined in: packages/contracts/src/messages.ts:236

The wire envelope for every message on the daemon's `messages` GraphQL
subscription. `payload` by `kind`:
  COMPONENT_UPDATE → RenderedExperience
  STATE_SNAPSHOT   → ExperienceState
  ACTION_ECHO / ACTION / ACTION_FORWARD → ActionRecord

## Properties

### direction

> **direction**: [`MessageDirection`](../type-aliases/MessageDirection.md)

Defined in: packages/contracts/src/messages.ts:237

***

### kind

> **kind**: [`MessageKind`](../type-aliases/MessageKind.md)

Defined in: packages/contracts/src/messages.ts:238

***

### metadata

> **metadata**: [`MessageMetadata`](MessageMetadata.md)

Defined in: packages/contracts/src/messages.ts:240

***

### payload

> **payload**: [`ActionRecord`](ActionRecord.md) \| [`RenderedExperience`](RenderedExperience.md) \| [`ExperienceState`](ExperienceState.md)

Defined in: packages/contracts/src/messages.ts:239
