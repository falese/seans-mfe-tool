[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ValidationIssue

# Interface: ValidationIssue

Defined in: [packages/runtime/src/context.ts:166](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L166)

One failed field from a validation handler.

Named `ValidationIssue`, not `ValidationError`: this is a *result record*
describing what was wrong with one field, not something thrown. The old name
collided with the `ValidationError` class in `@seans-mfe/contracts` on the
runtime barrel, which is why generated code had no way to reach the thrown
classes at all (ADR-017).

## Properties

### actual?

> `optional` **actual**: `unknown`

Defined in: [packages/runtime/src/context.ts:170](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L170)

***

### expected?

> `optional` **expected**: `string`

Defined in: [packages/runtime/src/context.ts:169](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L169)

***

### field

> **field**: `string`

Defined in: [packages/runtime/src/context.ts:167](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L167)

***

### message

> **message**: `string`

Defined in: [packages/runtime/src/context.ts:168](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/context.ts#L168)
