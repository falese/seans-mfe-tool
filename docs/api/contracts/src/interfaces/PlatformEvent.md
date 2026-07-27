[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / PlatformEvent

# Interface: PlatformEvent

Defined in: [packages/contracts/src/observability.ts:52](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L52)

One observability record.

A record with a `duration` reads as a span; one with a `severity` and no
`duration` reads as a log event. Both travel the same channel on purpose:
splitting logs from traces at the producer is what makes them impossible to
join at the consumer.

## Properties

### attributes?

> `optional` **attributes**: [`Attributes`](../type-aliases/Attributes.md)

Defined in: [packages/contracts/src/observability.ts:69](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L69)

***

### duration?

> `optional` **duration**: `number`

Defined in: [packages/contracts/src/observability.ts:64](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L64)

Milliseconds. Present on spans, absent on log events.

***

### name

> **name**: `string`

Defined in: [packages/contracts/src/observability.ts:60](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L60)

Operation name for a span; the message for a log event.

***

### parentSpanId?

> `optional` **parentSpanId**: `string`

Defined in: [packages/contracts/src/observability.ts:58](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L58)

The enclosing span, when there is one.

***

### severity?

> `optional` **severity**: [`Severity`](../type-aliases/Severity.md)

Defined in: [packages/contracts/src/observability.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L68)

***

### spanId

> **spanId**: `string`

Defined in: [packages/contracts/src/observability.ts:56](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L56)

16 lowercase hex characters. Identifies this record's own unit of work.

***

### startTime

> **startTime**: `string`

Defined in: [packages/contracts/src/observability.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L62)

ISO-8601.

***

### status

> **status**: [`EventStatus`](../type-aliases/EventStatus.md)

Defined in: [packages/contracts/src/observability.ts:65](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L65)

***

### statusMessage?

> `optional` **statusMessage**: `string`

Defined in: [packages/contracts/src/observability.ts:67](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L67)

Why the status is what it is — typically an error message.

***

### traceId

> **traceId**: `string`

Defined in: [packages/contracts/src/observability.ts:54](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/observability.ts#L54)

32 lowercase hex characters. Shared by everything in one logical operation.
