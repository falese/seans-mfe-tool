[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / severityFor

# Function: severityFor()

> **severityFor**(`migration`, `platformVersion`): `"error"` \| `"warning"`

Defined in: [packages/codegen/src/platform-migrations.ts:152](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L152)

Whether this migration is still advice or has become a requirement, for the
platform version currently running.

The comparison is against the running CLI, not per-MFE state — there is none
to read (ADR-082 Boundaries). The effect is that the escalation arrives when
someone upgrades the platform, which is when a breaking change lands anyway.

## Parameters

### migration

[`PlatformMigration`](../interfaces/PlatformMigration.md)

### platformVersion

`string`

## Returns

`"error"` \| `"warning"`
