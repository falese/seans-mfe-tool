[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / OpenTelemetryConfigSchema

# Variable: OpenTelemetryConfigSchema

> `const` **OpenTelemetryConfigSchema**: `ZodObject`\<\{ `enabled`: `ZodDefault`\<`ZodBoolean`\>; `exporters`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `endpoint`: `ZodString`; `type`: `ZodString`; \}, `$strip`\>\>\>; `sampling`: `ZodOptional`\<`ZodObject`\<\{ `probability`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>\>; `serviceName`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:312](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L312)

OpenTelemetry observability configuration
