[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / buildMessage

# Function: buildMessage()

> **buildMessage**(`parts`): [`Message`](../interfaces/Message.md)

Defined in: [packages/contracts/src/messages.ts:320](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L320)

Construct a protocol envelope with consistent defaults
(acknowledged=false, error=null, generated correlationId).

## Parameters

### parts

#### acknowledged?

`boolean`

#### correlationId?

`string`

#### direction

[`MessageDirection`](../type-aliases/MessageDirection.md)

#### error?

`string`

#### kind

[`MessageKind`](../type-aliases/MessageKind.md)

#### payload

[`ActionRecord`](../interfaces/ActionRecord.md) \| [`RenderedExperience`](../interfaces/RenderedExperience.md) \| [`ExperienceState`](../interfaces/ExperienceState.md)

## Returns

[`Message`](../interfaces/Message.md)
