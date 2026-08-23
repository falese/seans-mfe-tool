[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / LifecycleSchema

# Variable: LifecycleSchema

> `const` **LifecycleSchema**: `ZodObject`\<\{ `after`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<`ZodBoolean`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodUnion`\<readonly \[`ZodString`, `ZodArray`\<`ZodString`\>\]\>; `mandatory`: `ZodOptional`\<`ZodBoolean`\>; `source`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>\>\>; `before`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<`ZodBoolean`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodUnion`\<readonly \[`ZodString`, `ZodArray`\<`ZodString`\>\]\>; `mandatory`: `ZodOptional`\<`ZodBoolean`\>; `source`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>\>\>; `error`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<`ZodBoolean`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodUnion`\<readonly \[`ZodString`, `ZodArray`\<`ZodString`\>\]\>; `mandatory`: `ZodOptional`\<`ZodBoolean`\>; `source`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>\>\>; `main`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<`ZodBoolean`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodUnion`\<readonly \[`ZodString`, `ZodArray`\<`ZodString`\>\]\>; `mandatory`: `ZodOptional`\<`ZodBoolean`\>; `source`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:128](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L128)

Lifecycle configuration for a capability
