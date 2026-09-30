[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / DependenciesSchema

# Variable: DependenciesSchema

> `const` **DependenciesSchema**: `ZodObject`\<\{ `design-system`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodString`\>\>; `mfes`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodString`\>\>; `runtime`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodString`\>\>; \}, `$strict`\>

Defined in: [packages/dsl/src/schema.ts:581](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L581)

Dependencies section.

Closed (#373): a plain `z.object` strips an unknown key, so
`dependencies.devDependencies` validated clean and was silently dropped —
while the JSON Schema generated from this source (ADR-065) rejects it. A
strict object makes the two agree and tells the author where the key goes.
