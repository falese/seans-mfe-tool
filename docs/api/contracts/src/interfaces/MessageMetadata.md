[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MessageMetadata

# Interface: MessageMetadata

Defined in: packages/contracts/src/messages.ts:220

## Properties

### acknowledged

> **acknowledged**: `boolean`

Defined in: packages/contracts/src/messages.ts:224

True once the daemon has processed (not just received) the message.

***

### correlationId

> **correlationId**: `string`

Defined in: packages/contracts/src/messages.ts:222

UUID shared by the originating request and every downstream message.

***

### error

> **error**: `string` \| `null`

Defined in: packages/contracts/src/messages.ts:226

Non-null when the daemon or registry rejected or failed to process.
