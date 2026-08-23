[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CapabilityEntrySchema

# Variable: CapabilityEntrySchema

> `const` **CapabilityEntrySchema**: `ZodRecord`\<`ZodString`, `ZodObject`\<\{ `authorization`: `ZodOptional`\<`ZodString`\>; `description`: `ZodOptional`\<`ZodString`\>; `handler`: `ZodOptional`\<`ZodString`\>; `inputs`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `default`: `ZodOptional`\<`ZodUnknown`\>; `description`: `ZodOptional`\<`ZodString`\>; `formats`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `name`: `ZodString`; `type`: `ZodString`; `values`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; \}, `$strip`\>\>\>; `lifecycle`: `ZodOptional`\<`ZodObject`\<\{ `after`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `handler`: ...; `mandatory`: ...; `source`: ...; \}, `$strip`\>\>\>\>; `before`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `handler`: ...; `mandatory`: ...; `source`: ...; \}, `$strip`\>\>\>\>; `error`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `handler`: ...; `mandatory`: ...; `source`: ...; \}, `$strip`\>\>\>\>; `main`: `ZodOptional`\<`ZodArray`\<`ZodRecord`\<`ZodString`, `ZodObject`\<\{ `contained`: ...; `description`: ...; `handler`: ...; `mandatory`: ...; `source`: ...; \}, `$strip`\>\>\>\>; \}, `$strip`\>\>; `outputs`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `name`: `ZodString`; `type`: `ZodString`; \}, `$strip`\>\>\>; `type`: `ZodEnum`\<\{ `domain`: `"domain"`; `platform`: `"platform"`; \}\>; \}, `$strip`\>\>

Defined in: [packages/dsl/src/schema.ts:153](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L153)

Capability entry (name → config)
