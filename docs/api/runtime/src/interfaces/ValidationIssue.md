[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ValidationIssue

# Interface: ValidationIssue

Defined in: [packages/runtime/src/context.ts:175](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L175)

One failed field from a validation handler.

Named `ValidationIssue`, not `ValidationError`: this is a *result record*
describing what was wrong with one field, not something thrown. The old name
collided with the `ValidationError` class in `@seans-mfe/contracts` on the
runtime barrel, which is why generated code had no way to reach the thrown
classes at all (ADR-017).

## Properties

### actual?

> `optional` **actual**: `unknown`

Defined in: [packages/runtime/src/context.ts:179](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L179)

***

### expected?

> `optional` **expected**: `string`

Defined in: [packages/runtime/src/context.ts:178](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L178)

***

### field

> **field**: `string`

Defined in: [packages/runtime/src/context.ts:176](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L176)

***

### message

> **message**: `string`

Defined in: [packages/runtime/src/context.ts:177](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L177)
