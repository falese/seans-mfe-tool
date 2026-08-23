[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / ControlPlaneFinding

# Interface: ControlPlaneFinding

Defined in: [packages/dsl/src/control-plane-compiler.ts:42](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L42)

## Properties

### fatal

> **fatal**: `boolean`

Defined in: [packages/dsl/src/control-plane-compiler.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L48)

Advisory findings must not fail a build; everything structural does.

***

### message

> **message**: `string`

Defined in: [packages/dsl/src/control-plane-compiler.ts:46](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L46)

***

### rule

> **rule**: [`ControlPlaneRule`](../type-aliases/ControlPlaneRule.md)

Defined in: [packages/dsl/src/control-plane-compiler.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L43)

***

### stateKey

> **stateKey**: `string`

Defined in: [packages/dsl/src/control-plane-compiler.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L45)

The state key the offending route produces, for locating it in the source.
