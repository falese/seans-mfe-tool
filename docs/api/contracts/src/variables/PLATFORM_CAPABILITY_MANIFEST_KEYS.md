[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / PLATFORM\_CAPABILITY\_MANIFEST\_KEYS

# Variable: PLATFORM\_CAPABILITY\_MANIFEST\_KEYS

> `const` **PLATFORM\_CAPABILITY\_MANIFEST\_KEYS**: readonly `string`[]

Defined in: [packages/contracts/src/platform-contract.ts:288](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/platform-contract.ts#L288)

Every spelling a manifest may use as a platform capability entry key — both
the camelCase name and the PascalCase manifest key. Consumers that classify
manifest entries as platform vs domain match against this, not against
PLATFORM_CAPABILITIES alone.
