[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / parseHandlerSource

# Function: parseHandlerSource()

> **parseHandlerSource**(`source`, `hookName`): \{ `exportName`: `string`; `module`: `string`; \} \| `null`

Defined in: [packages/codegen/src/render-model.ts:226](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/render-model.ts#L226)

Parse a DSL `source:` specifier into a static import descriptor.

Grammar: *   "./rel/path"               → named import `{ <hookName> } from './rel/path'`
  "@org/pkg"                 → default import `<hookName> from '@org/pkg'`
  "@org/pkg#namedExport"     → named import `{ namedExport as <hookName> } from '@org/pkg'`

Returning `null` means the source is malformed (empty / only whitespace);
the caller logs and falls back to stub generation so codegen never crashes
on a typo.

## Parameters

### source

`string`

### hookName

`string`

## Returns

\{ `exportName`: `string`; `module`: `string`; \} \| `null`
