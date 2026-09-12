[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / GenerateAllFilesResult

# Interface: GenerateAllFilesResult

Defined in: [packages/codegen/src/unified-generator.ts:156](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L156)

Generate all files (features, platform, BFF, configs) for a manifest

## Properties

### diagnostics

> **diagnostics**: [`GeneratorDiagnostic`](GeneratorDiagnostic.md)[]

Defined in: [packages/codegen/src/unified-generator.ts:164](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L164)

Everything the generator has to say about this run (ADR-092). Returned,
never printed: the caller decides whether that means chalk on a terminal,
a field in the JSON envelope, or nothing at all.

***

### files

> **files**: [`GeneratedFile`](GeneratedFile.md)[]

Defined in: [packages/codegen/src/unified-generator.ts:157](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L157)

***

### preservedCapabilities

> **preservedCapabilities**: `string`[]

Defined in: [packages/codegen/src/unified-generator.ts:158](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L158)
