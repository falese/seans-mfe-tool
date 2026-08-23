[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / PlatformMigration

# Interface: PlatformMigration

Defined in: [packages/codegen/src/platform-migrations.ts:39](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L39)

## Properties

### adr

> **adr**: `string`

Defined in: [packages/codegen/src/platform-migrations.ts:54](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L54)

The decision this enforces.

***

### exempt?

> `optional` **exempt**: `RegExp`

Defined in: [packages/codegen/src/platform-migrations.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L62)

Lines matching this are exempt even if `pattern` matched. For the cases
where a single regex would either over- or under-match — see
`validation-error-renamed`, where only the *type* import moved.

***

### failsAt?

> `optional` **failsAt**: `string`

Defined in: [packages/codegen/src/platform-migrations.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L48)

Platform version at which the warning becomes an error. Omitted for a
change that is advice rather than a deadline.

***

### fix

> **fix**: `string`

Defined in: [packages/codegen/src/platform-migrations.ts:52](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L52)

What to do instead — concrete enough to act on without reading the ADR.

***

### id

> **id**: `string`

Defined in: [packages/codegen/src/platform-migrations.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L41)

Stable slug. Keys any suppression a consumer writes, so it must not churn.

***

### message

> **message**: `string`

Defined in: [packages/codegen/src/platform-migrations.ts:50](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L50)

What is wrong, in the developer's terms.

***

### pattern

> **pattern**: `RegExp`

Defined in: [packages/codegen/src/platform-migrations.ts:56](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L56)

Lines matching this are hits. Applied per line, so a hit carries a number.

***

### since

> **since**: `string`

Defined in: [packages/codegen/src/platform-migrations.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/platform-migrations.ts#L43)

Platform version that began warning about this.
