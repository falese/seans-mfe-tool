[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / parseFederationSharedEntries

# Function: parseFederationSharedEntries()

> **parseFederationSharedEntries**(`configSource`): [`SharedEntry`](../interfaces/SharedEntry.md)[]

Defined in: [packages/codegen/src/validate.ts:111](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/validate.ts#L111)

Extract Module-Federation `shared` entries from a bundler config's source
text (rspack.config.js / webpack.config.js). Matches every
`name: { … requiredVersion: '…' … }` object, which is exactly the generated
federation `shared` shape (ADR-071) and the common hand-authored form.

Text-based (not eval) so it is pure and safe on untrusted config; entries
without a `requiredVersion` (e.g. `shareAll` spreads) are ignored.

## Parameters

### configSource

`string`

## Returns

[`SharedEntry`](../interfaces/SharedEntry.md)[]
