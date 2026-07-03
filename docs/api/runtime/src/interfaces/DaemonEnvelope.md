[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / DaemonEnvelope

# Interface: DaemonEnvelope

Defined in: [packages/runtime/src/layout-transport.ts:30](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L30)

The transport envelope delivered on the daemon's `messages` subscription.

This is NOT the logical `Message` (ADR-054). The downward payload is wrapped
in a component envelope: `kind: 'COMPONENT_UPDATE'` with `payload.type`
(`'EXPERIENCE' | 'RESOLUTION_ERROR'`) discriminating the envelope and
`payload.data` carrying the ADR-054 `RenderedExperience`. The `type`
discriminator is an envelope tag, not a revived CARD/FORM/NOTIFICATION
component type (ADR-054 "Wire envelope vs logical message").

## Properties

### direction?

> `optional` **direction**: `string`

Defined in: [packages/runtime/src/layout-transport.ts:31](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L31)

***

### kind?

> `optional` **kind**: `string`

Defined in: [packages/runtime/src/layout-transport.ts:32](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L32)

***

### metadata?

> `optional` **metadata**: `object`

Defined in: [packages/runtime/src/layout-transport.ts:39](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L39)

#### acknowledged?

> `optional` **acknowledged**: `boolean`

#### correlationId?

> `optional` **correlationId**: `string`

#### error?

> `optional` **error**: `string`

***

### payload?

> `optional` **payload**: `object`

Defined in: [packages/runtime/src/layout-transport.ts:33](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-transport.ts#L33)

#### Index Signature

\[`key`: `string`\]: `unknown`

#### data?

> `optional` **data**: `Record`\<`string`, `unknown`\>

#### id?

> `optional` **id**: `string`

#### type?

> `optional` **type**: `string`
