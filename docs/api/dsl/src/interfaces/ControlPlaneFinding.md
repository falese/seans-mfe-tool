[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / ControlPlaneFinding

# Interface: ControlPlaneFinding

Defined in: [packages/dsl/src/control-plane-compiler.ts:44](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L44)

## Properties

### fatal

> **fatal**: `boolean`

Defined in: [packages/dsl/src/control-plane-compiler.ts:55](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L55)

Advisory findings must not fail a build; everything structural does.

***

### message

> **message**: `string`

Defined in: [packages/dsl/src/control-plane-compiler.ts:53](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L53)

***

### mfe?

> `optional` **mfe**: `string`

Defined in: [packages/dsl/src/control-plane-compiler.ts:52](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L52)

The fleet member the finding is about, when it is about one (ADR-107).

***

### rule

> **rule**: [`ControlPlaneRule`](../type-aliases/ControlPlaneRule.md)

Defined in: [packages/dsl/src/control-plane-compiler.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L45)

***

### stateKey?

> `optional` **stateKey**: `string`

Defined in: [packages/dsl/src/control-plane-compiler.ts:50](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L50)

The state key the offending route produces, for locating it in the source.
Absent for a finding about a fleet member rather than a route.
