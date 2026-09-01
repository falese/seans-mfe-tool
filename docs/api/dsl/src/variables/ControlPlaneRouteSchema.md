[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / ControlPlaneRouteSchema

# Variable: ControlPlaneRouteSchema

> `const` **ControlPlaneRouteSchema**: `ZodObject`\<\{ `description`: `ZodOptional`\<`ZodString`\>; `forEach`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodArray`\<`ZodString`\>\>\>; `place`: `ZodArray`\<`ZodObject`\<\{ `capability`: `ZodString`; `from`: `ZodOptional`\<`ZodString`\>; `into`: `ZodOptional`\<`ZodString`\>; `props`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; \}, `$strip`\>\>; `when`: `ZodString`; \}, `$strip`\>

Defined in: [packages/dsl/src/control-plane-schema.ts:70](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-schema.ts#L70)

One route: when this state key fires, place these capabilities.

A single route may place several capabilities — meridian's
`meridian.open.docking` puts the board in `main` and the traffic log in
`status` from one click — which is why `place` is a list rather than a
single resolve.
