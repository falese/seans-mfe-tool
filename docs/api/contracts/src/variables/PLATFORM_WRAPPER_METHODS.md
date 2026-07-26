[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / PLATFORM\_WRAPPER\_METHODS

# Variable: PLATFORM\_WRAPPER\_METHODS

> `const` **PLATFORM\_WRAPPER\_METHODS**: readonly `string`[]

Defined in: packages/contracts/src/platform-contract.ts:278

The `do*()` wrapper methods. A lifecycle hook may not reference one of these
as its handler — that would re-enter the orchestrator it is running inside.
