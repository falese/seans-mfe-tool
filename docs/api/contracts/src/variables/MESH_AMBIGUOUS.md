[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MESH\_AMBIGUOUS

# Variable: MESH\_AMBIGUOUS

> `const` **MESH\_AMBIGUOUS**: readonly \[`"mock"`, `"snapshot"`\]

Defined in: [packages/contracts/src/mesh-catalog.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/mesh-catalog.ts#L87)

Names Mesh ships in BOTH positions, so neither "this is a transform, not a
plugin" nor its converse is ever true of them.

Every previous copy of this table handled these by listing them in both sets,
which quietly disabled its own misclassification check for exactly the names
that most needed thought. Naming the ambiguity is the fix; listing twice was
a bug wearing the shape of completeness.
