[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / ErrorTypeHandlingSchema

# Variable: ErrorTypeHandlingSchema

> `const` **ErrorTypeHandlingSchema**: `ZodObject`\<\{ `backoff`: `ZodOptional`\<`ZodEnum`\<\{ `constant`: `"constant"`; `exponential`: `"exponential"`; `linear`: `"linear"`; \}\>\>; `baseDelay`: `ZodOptional`\<`ZodNumber`\>; `fallbackHandler`: `ZodOptional`\<`ZodString`\>; `jitter`: `ZodOptional`\<`ZodBoolean`\>; `maxDelay`: `ZodOptional`\<`ZodNumber`\>; `maxRetries`: `ZodOptional`\<`ZodNumber`\>; `message`: `ZodOptional`\<`ZodString`\>; `onRetry`: `ZodOptional`\<`ZodString`\>; `pattern`: `ZodOptional`\<`ZodString`\>; `retryable`: `ZodBoolean`; `type`: `ZodEnum`\<\{ `business`: `"business"`; `network`: `"network"`; `security`: `"security"`; `system`: `"system"`; `timeout`: `"timeout"`; `unknown`: `"unknown"`; `validation`: `"validation"`; \}\>; `userFacing`: `ZodOptional`\<`ZodBoolean`\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:251](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L251)

One error type's classification and retry policy (ADR-030).
