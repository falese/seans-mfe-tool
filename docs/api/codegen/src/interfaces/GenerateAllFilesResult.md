[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / GenerateAllFilesResult

# Interface: GenerateAllFilesResult

Defined in: [packages/codegen/src/unified-generator.ts:174](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L174)

Generate all files (features, platform, BFF, configs) for a manifest

## Properties

### diagnostics

> **diagnostics**: [`GeneratorDiagnostic`](GeneratorDiagnostic.md)[]

Defined in: [packages/codegen/src/unified-generator.ts:182](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L182)

Everything the generator has to say about this run (ADR-094). Returned,
never printed: the caller decides whether that means chalk on a terminal,
a field in the JSON envelope, or nothing at all.

***

### files

> **files**: [`GeneratedFile`](GeneratedFile.md)[]

Defined in: [packages/codegen/src/unified-generator.ts:175](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L175)

***

### preservedCapabilities

> **preservedCapabilities**: `string`[]

Defined in: [packages/codegen/src/unified-generator.ts:176](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L176)
