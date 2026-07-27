[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / SLOT\_PARAM\_VALUE\_SOURCE

# Variable: SLOT\_PARAM\_VALUE\_SOURCE

> `const` **SLOT\_PARAM\_VALUE\_SOURCE**: `"[A-Za-z0-9_-]+"` = `'[A-Za-z0-9_-]+'`

Defined in: [packages/contracts/src/slot-grammar.ts:35](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/slot-grammar.ts#L35)

One runtime value instantiating a `{param}` segment. Deliberately excludes
`.` (would change the segment count) and `/` (path composition is
host-owned, ADR-068).
