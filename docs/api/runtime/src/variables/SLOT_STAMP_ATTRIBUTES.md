[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / SLOT\_STAMP\_ATTRIBUTES

# Variable: SLOT\_STAMP\_ATTRIBUTES

> `const` **SLOT\_STAMP\_ATTRIBUTES**: `object`

Defined in: [packages/runtime/src/layout-manager.ts:621](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-manager.ts#L621)

What a mounted slot is stamped with, beside data-layout-slot and
data-slot-state. A public DOM contract: tests, design capture and error
attribution select on these names, so renaming one is a breaking change.

## Type Declaration

### capability

> `readonly` **capability**: `"data-smt-capability"` = `'data-smt-capability'`

### contentType

> `readonly` **contentType**: `"data-smt-content-type"` = `'data-smt-content-type'`

### experience

> `readonly` **experience**: `"data-smt-experience"` = `'data-smt-experience'`

### mfe

> `readonly` **mfe**: `"data-smt-mfe"` = `'data-smt-mfe'`
