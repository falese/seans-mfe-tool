[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / ObservabilityConfigSchema

# Variable: ObservabilityConfigSchema

> `const` **ObservabilityConfigSchema**: `ZodObject`\<\{ `opentelemetry`: `ZodOptional`\<`ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `exporters`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `endpoint`: `ZodString`; `type`: `ZodString`; \}, `$strip`\>\>\>; `sampling`: `ZodOptional`\<`ZodObject`\<\{ `probability`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>\>; `serviceName`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; `prometheus`: `ZodOptional`\<`ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `endpoint`: `ZodDefault`\<`ZodString`\>; `port`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:332](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L332)

Observability configuration
