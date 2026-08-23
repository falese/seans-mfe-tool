[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / OPTIONAL\_PUBLIC\_ASSETS

# Variable: OPTIONAL\_PUBLIC\_ASSETS

> `const` **OPTIONAL\_PUBLIC\_ASSETS**: readonly `string`[]

Defined in: [packages/codegen/src/catalog.ts:37](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/catalog.ts#L37)

Public assets a template variant may legitimately not ship (#341).

Absence is a variant's choice, not a defect, so it is emitted silently rather
than warned about. `base-mfe-angular` ships neither: an Angular MFE is served
through the Angular builder and has no standalone demo page. Warning anyway
printed two lines per Angular MFE on every run — eight across the fleet,
landing in the middle of `check:mfe-drift` output a reader is meant to be
studying carefully.

The set is deliberately short. Everything not in it — `index.html`,
`App.tsx`, `index.tsx`, `mfe.ts` — still warns when its template is missing,
because there the absence really is a broken variant. Silencing the
diagnostic wholesale would trade a noisy gate for a silent one.

Follows the same rule as slot emission below, which probes the variant's
`templateDir` for a `slots.*.ejs` instead of hardcoding framework names, so
a new framework adds support by shipping a template (ADR-036).
