[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / SwiftTargetSchema

# Variable: SwiftTargetSchema

> `const` **SwiftTargetSchema**: `ZodObject`\<\{ `bundleId`: `ZodOptional`\<`ZodString`\>; `deploymentTarget`: `ZodDefault`\<`ZodString`\>; `moduleName`: `ZodOptional`\<`ZodString`\>; `swiftToolsVersion`: `ZodDefault`\<`ZodString`\>; \}, `$strip`\>

Defined in: [packages/dsl/src/schema.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L86)

The Swift native target (ADR-095, ADR-096).

Deliberately tiny: everything here is either unavailable to codegen (an
Apple bundle id) or a toolchain pin. Capability set, module identity and
lifecycle all come from the manifest proper — a secondary target declares
how to BUILD, never what the MFE IS.
