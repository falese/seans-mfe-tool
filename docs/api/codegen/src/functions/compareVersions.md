[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / compareVersions

# Function: compareVersions()

> **compareVersions**(`a`, `b`): `number`

Defined in: [packages/codegen/src/platform-migrations.ts:126](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L126)

Compare two dotted versions numerically. Returns -1, 0 or 1.

Deliberately not `semver`: `packages/codegen` does not depend on it and
should not gain a dependency to compare three integers. Prerelease suffixes
are ignored rather than ordered — a migration deadline is a release-line
decision, and treating `2.0.0-rc.1` as `2.0.0` is the safe reading.

## Parameters

### a

`string`

### b

`string`

## Returns

`number`
