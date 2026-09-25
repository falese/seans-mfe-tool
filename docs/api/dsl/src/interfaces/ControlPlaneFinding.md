[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / ControlPlaneFinding

# Interface: ControlPlaneFinding

Defined in: [packages/dsl/src/control-plane-compiler.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L43)

## Properties

### fatal

> **fatal**: `boolean`

Defined in: [packages/dsl/src/control-plane-compiler.ts:49](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L49)

Advisory findings must not fail a build; everything structural does.

***

### message

> **message**: `string`

Defined in: [packages/dsl/src/control-plane-compiler.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L47)

***

### rule

> **rule**: [`ControlPlaneRule`](../type-aliases/ControlPlaneRule.md)

Defined in: [packages/dsl/src/control-plane-compiler.ts:44](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L44)

***

### stateKey

> **stateKey**: `string`

Defined in: [packages/dsl/src/control-plane-compiler.ts:46](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L46)

The state key the offending route produces, for locating it in the source.
