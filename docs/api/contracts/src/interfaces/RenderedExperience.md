[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / RenderedExperience

# Interface: RenderedExperience

Defined in: packages/contracts/src/messages.ts:139

What an MFE's `render()` returned, relayed by the daemon to renderers.
The MFE owns the shape of `output` — HTML string, component reference,
or structured data — discriminated by `contentType`.

## Properties

### capability

> **capability**: `string`

Defined in: packages/contracts/src/messages.ts:144

Which domain capability was rendered.

***

### contentType

> **contentType**: `string`

Defined in: packages/contracts/src/messages.ts:148

'text/html' | 'application/json' | 'module-federation' | … (open).

***

### createdAt

> **createdAt**: `string`

Defined in: packages/contracts/src/messages.ts:151

***

### id

> **id**: `string`

Defined in: packages/contracts/src/messages.ts:140

***

### mfe

> **mfe**: `string`

Defined in: packages/contracts/src/messages.ts:142

Which MFE produced this experience.

***

### output

> **output**: `unknown`

Defined in: packages/contracts/src/messages.ts:146

MFE-owned output: HTML string, component ref, data payload, …

***

### props?

> `optional` **props**: `Record`\<`string`, `unknown`\>

Defined in: packages/contracts/src/messages.ts:150

The resolution props this experience was rendered with.
