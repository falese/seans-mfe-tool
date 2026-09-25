[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CapabilityEntrySchema

# Variable: CapabilityEntrySchema

> `const` **CapabilityEntrySchema**: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `authorization`: `ZodOptional`\<`ZodString`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodOptional`\<`ZodString`\>; `inputs`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `default`: `ZodOptional`\<`ZodUnknown`\>; `description`: `ZodOptional`\<`ZodString`\>; `formats`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `name`: `ZodString`; `type`: `ZodString`; `values`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; \}, `$strip`\>\>\>; `lifecycle`: `ZodOptional`\<`ZodObject`\<\{ `after`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `errorHandling`: ...; `handler`: ...; `mandatory`: ...; `onTimeout`: ...; `source`: ...; `timeout`: ...; \}, `$strip`\>\>\>\>; `before`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `errorHandling`: ...; `handler`: ...; `mandatory`: ...; `onTimeout`: ...; `source`: ...; `timeout`: ...; \}, `$strip`\>\>\>\>; `error`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `errorHandling`: ...; `handler`: ...; `mandatory`: ...; `onTimeout`: ...; `source`: ...; `timeout`: ...; \}, `$strip`\>\>\>\>; `main`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `errorHandling`: ...; `handler`: ...; `mandatory`: ...; `onTimeout`: ...; `source`: ...; `timeout`: ...; \}, `$strip`\>\>\>\>; \}, `$strip`\>\>; `outputs`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `name`: `ZodString`; `type`: `ZodString`; \}, `$strip`\>\>\>; `type`: `ZodEnum`\<\{ `domain`: `"domain"`; `platform`: `"platform"`; \}\>; \}, `$strip`\>\>

Defined in: [packages/dsl/src/schema.ts:340](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L340)

Capability entry (name → config)
