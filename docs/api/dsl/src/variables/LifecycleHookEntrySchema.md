[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / LifecycleHookEntrySchema

# Variable: LifecycleHookEntrySchema

> `const` **LifecycleHookEntrySchema**: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: `ZodOptional`\<`ZodBoolean`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodUnion`\<readonly \[`ZodString`, `ZodArray`\<`ZodString`\>\]\>; `mandatory`: `ZodOptional`\<`ZodBoolean`\>; `source`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>

Defined in: [packages/dsl/src/schema.ts:136](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L136)

Lifecycle hook entry (name → config)
