[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / TemplateRootName

# Type Alias: TemplateRootName

> **TemplateRootName** = `"variant"` \| `string` & `object`

Defined in: [packages/codegen/src/file-plan.ts:38](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L38)

Where a spec's template is looked up.

`variant` is reserved for the framework variant's own template directory and
is the default for a spec that names none. Any other value is a
`FileContributor` id, which is an open string — a plugin ships templates the
generator has never heard of, which is the point (ADR-092 §2). Typed as such
so the two literals below read as documentation rather than as a closed set
the generator can be trusted to enumerate.
