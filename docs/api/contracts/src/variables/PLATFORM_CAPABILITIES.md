[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / PLATFORM\_CAPABILITIES

# Variable: PLATFORM\_CAPABILITIES

> `const` **PLATFORM\_CAPABILITIES**: readonly \[`"describe"`, `"load"`, `"render"`, `"refresh"`, `"emit"`, `"query"`, `"schema"`, `"authorizeAccess"`, `"health"`, `"updateControlPlaneState"`\]

Defined in: packages/contracts/src/platform-contract.ts:92

The ten platform capabilities, ordered as in the
`docs/PLATFORM-CONTRACT.md` reference table. Anything a manifest declares
that is not in this list is a *domain* capability.
