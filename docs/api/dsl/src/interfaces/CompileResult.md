[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CompileResult

# Interface: CompileResult

Defined in: [packages/dsl/src/control-plane-compiler.ts:64](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L64)

## Properties

### findings

> **findings**: [`ControlPlaneFinding`](ControlPlaneFinding.md)[]

Defined in: [packages/dsl/src/control-plane-compiler.ts:70](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L70)

***

### payload

> **payload**: [`CompiledRuleDocument`](CompiledRuleDocument.md)[]

Defined in: [packages/dsl/src/control-plane-compiler.ts:69](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L69)

One entry per MFE, in fleet order, whether or not it has routes — plus one
per browser build, right after its MFE (ADR-103).
