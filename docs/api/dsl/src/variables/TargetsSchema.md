[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / TargetsSchema

# Variable: TargetsSchema

> `const` **TargetsSchema**: `ZodObject`\<\{ `swift`: `ZodOptional`\<`ZodObject`\<\{ `bundleId`: `ZodOptional`\<`ZodString`\>; `deploymentTarget`: `ZodDefault`\<`ZodString`\>; `moduleName`: `ZodOptional`\<`ZodString`\>; `swiftToolsVersion`: `ZodDefault`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:117](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L117)

Secondary build targets — a second artifact from the same manifest.

Open in shape for the same reason `framework` is an open string: `swift` is
the only key the platform ships, not the only key that may exist.
