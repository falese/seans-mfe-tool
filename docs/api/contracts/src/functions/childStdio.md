[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / childStdio

# Function: childStdio()

> **childStdio**(`env`): [`ChildStdio`](../type-aliases/ChildStdio.md)

Defined in: packages/contracts/src/child-stdio.ts:57

The stdio triple a child process should be given.

## Parameters

### env

`ProcessEnv` = `process.env`

Environment to read the JSON-mode marker from. Defaults to
             `process.env`; injectable so this is testable without mutating
             global state.

## Returns

[`ChildStdio`](../type-aliases/ChildStdio.md)
