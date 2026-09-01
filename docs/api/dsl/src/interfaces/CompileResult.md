[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CompileResult

# Interface: CompileResult

Defined in: [packages/dsl/src/control-plane-compiler.ts:57](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L57)

## Properties

### findings

> **findings**: [`ControlPlaneFinding`](ControlPlaneFinding.md)[]

Defined in: [packages/dsl/src/control-plane-compiler.ts:60](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L60)

***

### payload

> **payload**: [`CompiledRuleDocument`](CompiledRuleDocument.md)[]

Defined in: [packages/dsl/src/control-plane-compiler.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L59)

One entry per MFE, in fleet order, whether or not it has routes.
