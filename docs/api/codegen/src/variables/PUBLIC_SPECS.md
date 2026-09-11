[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / PUBLIC\_SPECS

# Variable: PUBLIC\_SPECS

> `const` **PUBLIC\_SPECS**: [`FileSpec`](../interfaces/FileSpec.md)[]

Defined in: [packages/codegen/src/variants/shared.ts:169](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/variants/shared.ts#L169)

Public assets. `demo.html` and `favicon.ico` are optional: a variant may
legitimately not ship them (an Angular MFE is served through the Angular
builder and has no standalone demo page), and warning about that printed two
lines per Angular MFE on every run.
