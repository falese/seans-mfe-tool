[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / findMigrationHits

# Function: findMigrationHits()

> **findMigrationHits**(`migration`, `source`): [`MigrationHit`](../interfaces/MigrationHit.md)[]

Defined in: [packages/codegen/src/platform-migrations.ts:165](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L165)

Every line of `source` that uses what `migration` describes.

## Parameters

### migration

[`PlatformMigration`](../interfaces/PlatformMigration.md)

### source

[`SourceLike`](../interfaces/SourceLike.md)

## Returns

[`MigrationHit`](../interfaces/MigrationHit.md)[]
