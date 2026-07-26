[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MFE\_LIFECYCLE\_STATES

# Variable: MFE\_LIFECYCLE\_STATES

> `const` **MFE\_LIFECYCLE\_STATES**: readonly \[`"uninitialized"`, `"loading"`, `"ready"`, `"rendering"`, `"error"`, `"destroyed"`\]

Defined in: packages/contracts/src/platform-contract.ts:36

The six lifecycle states, in progression order. An MFE starts at
`uninitialized` and may end at `destroyed`; `error` is recoverable via
`load()`, `destroyed` is not recoverable at all.
