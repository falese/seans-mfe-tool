[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / RenderedExperience

# Interface: RenderedExperience

Defined in: [packages/contracts/src/messages.ts:139](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L139)

What an MFE's `render()` returned, relayed by the daemon to renderers.
The MFE owns the shape of `output` — HTML string, component reference,
or structured data — discriminated by `contentType`.

## Properties

### capability

> **capability**: `string`

Defined in: [packages/contracts/src/messages.ts:144](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L144)

Which domain capability was rendered.

***

### contentType

> **contentType**: `string`

Defined in: [packages/contracts/src/messages.ts:148](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L148)

'text/html' | 'application/json' | 'module-federation' | … (open).

***

### createdAt

> **createdAt**: `string`

Defined in: [packages/contracts/src/messages.ts:151](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L151)

***

### id

> **id**: `string`

Defined in: [packages/contracts/src/messages.ts:140](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L140)

***

### mfe

> **mfe**: `string`

Defined in: [packages/contracts/src/messages.ts:142](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L142)

Which MFE produced this experience.

***

### output

> **output**: `unknown`

Defined in: [packages/contracts/src/messages.ts:146](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L146)

MFE-owned output: HTML string, component ref, data payload, …

***

### props?

> `optional` **props**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/messages.ts:150](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L150)

The resolution props this experience was rendered with.
