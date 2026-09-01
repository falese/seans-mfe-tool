[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / MigrationHit

# Interface: MigrationHit

Defined in: [packages/codegen/src/platform-migrations.ts:27](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L27)

One line of developer-owned source that uses something the platform changed.

## Properties

### line

> **line**: `number`

Defined in: [packages/codegen/src/platform-migrations.ts:29](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L29)

1-indexed, so it can be printed as `path:line`.

***

### text

> **text**: `string`

Defined in: [packages/codegen/src/platform-migrations.ts:31](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L31)

The offending line, trimmed — enough to recognise without opening the file.
