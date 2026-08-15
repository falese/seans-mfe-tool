[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / JSON\_MODE\_ENV

# Variable: JSON\_MODE\_ENV

> `const` **JSON\_MODE\_ENV**: `"SMT_JSON_MODE"` = `'SMT_JSON_MODE'`

Defined in: [packages/contracts/src/child-stdio.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/child-stdio.ts#L45)

Marker for "an ancestor process is emitting a JSON envelope on stdout".

Set by `redirectStdoutToStderr()` in `@falese/smt-oclif-base`, read here.
An environment variable rather than a module-level flag because it has to
cross a process boundary: if the CLI shells out to another CLI, the
grandchild's children must keep fd 1 clean too, and inherited env is what
carries that down the tree.
