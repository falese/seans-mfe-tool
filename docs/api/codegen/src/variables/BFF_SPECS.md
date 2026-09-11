[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / BFF\_SPECS

# Variable: BFF\_SPECS

> `const` **BFF\_SPECS**: [`FileSpec`](../interfaces/FileSpec.md)[]

Defined in: [packages/codegen/src/variants/shared.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/shared.ts#L73)

Emitted only when the manifest declares a `data:` section.

`package.json` is deliberately absent. The MFE root template is already a
hybrid owning both MFE deps (rspack, react, MUI) and BFF deps (mesh,
express, helmet); the BFF template's own `package.json.ejs` is a strict
subset and used to clobber it, leaving generated MFEs without MUI while
`src/App.tsx` imported it.

`server.ts` is generator-owned — pure BFF runtime nobody customises. The
rest are developer-owned so customisation survives regeneration.
