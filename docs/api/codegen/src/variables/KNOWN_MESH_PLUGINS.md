[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / KNOWN\_MESH\_PLUGINS

# Variable: KNOWN\_MESH\_PLUGINS

> `const` **KNOWN\_MESH\_PLUGINS**: `ReadonlySet`\<`string`\>

Defined in: [packages/codegen/src/catalog.ts:249](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/catalog.ts#L249)

Mesh plugin / transform allow-lists.

Derived from the single classification in `@seans-mfe/contracts` (ADR-090),
not restated. These used to be two hand-maintained Sets here, one of three
surviving copies across the repo that disagreed on both contents and
spelling; `codegen` read camelCase while `dsl` read kebab-case against the
same manifest field.

Kept as `Set`s under the existing names so the module's public surface — and
`bff:init`, which imports them — is unchanged by the move.
