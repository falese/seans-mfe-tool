[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / FrameworkVariant

# Interface: FrameworkVariant

Defined in: [packages/codegen/src/unified-generator.ts:84](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L84)

The resolved codegen variant a caller injects (ADR-061). The CLI derives it
from the framework plugin (loadFrameworkPlugin) so third-party frameworks
work; the generator itself never loads a plugin. When no variant is injected
the generator falls back to `deriveBuiltinVariant` — the two built-in trios,
computed purely from the manifest with no framework-loader dependency.

## Properties

### bundler

> **bundler**: `string`

Defined in: [packages/codegen/src/unified-generator.ts:86](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L86)

***

### framework

> **framework**: `string`

Defined in: [packages/codegen/src/unified-generator.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L85)

***

### templateVariant

> **templateVariant**: `string`

Defined in: [packages/codegen/src/unified-generator.ts:91](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/unified-generator.ts#L91)

The variant id. Open, not a union of the two built-ins: closing it was
half of why a third framework required editing this file (ADR-093).
