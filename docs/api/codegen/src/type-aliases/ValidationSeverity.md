[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ValidationSeverity

# Type Alias: ValidationSeverity

> **ValidationSeverity** = `"error"` \| `"warning"`

Defined in: [packages/codegen/src/validate.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L73)

`error` fails validation; `warning` reports and does not.

Introduced for ADR-082: regeneration cannot reach developer-owned files, so
the platform needs a way to say "this is yours, and something it uses has
changed" without failing anyone's build. Optional, and absent means `error`,
so every rule written before this behaves exactly as it did.
