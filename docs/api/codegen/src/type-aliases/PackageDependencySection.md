[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / PackageDependencySection

# Type Alias: PackageDependencySection

> **PackageDependencySection** = `"dependencies"` \| `"devDependencies"`

Defined in: [packages/codegen/src/package-dependency-diff.ts:18](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/package-dependency-diff.ts#L18)

Compare a freshly-rendered `package.json` (what `package.json.ejs` would
write) against the current, on-disk `package.json` (what's actually
there), for the `dependencies` and `devDependencies` sections.

`package.json` is developer-owned (`overwrite:false`), so `writeGeneratedFiles`
always skips it once it exists — the platform computes the exactly correct
content on every `remote:generate` and discards it. Generic across every
dependency the template would ever add or bump (framework version pins,
design-system deps, BFF/Mesh deps, build tooling): this reads the real
render, so it can never drift from what the template actually produces the
way a hand-maintained list of "the BFF deps" could.

Pure: both arguments are already-rendered/already-read JSON text, so this
does no I/O and is unit-testable without touching disk.
