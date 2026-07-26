[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / SlotTargetResult

# Type Alias: SlotTargetResult

> **SlotTargetResult** = \{ `status`: `"ok"`; \} \| \{ `message`: `string`; `reason`: [`SlotTargetRejection`](SlotTargetRejection.md); `status`: `"rejected"`; \}

Defined in: [packages/contracts/src/slot-contract.ts:149](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/slot-contract.ts#L149)

Discriminated on `status` rather than a boolean: this repo compiles without
`strictNullChecks`, and TypeScript does not narrow a boolean-literal
discriminant in that mode, so `{ ok: true } | { ok: false; ... }` would force
every consumer into a cast.
