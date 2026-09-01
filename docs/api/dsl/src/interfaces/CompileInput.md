[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / CompileInput

# Interface: CompileInput

Defined in: [packages/dsl/src/control-plane-compiler.ts:51](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L51)

## Properties

### document

> **document**: `object`

Defined in: [packages/dsl/src/control-plane-compiler.ts:52](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L52)

#### mfes

> **mfes**: `string`[]

The MFE directories making up this fleet, relative to the document.

These supply the manifests the compiler derives registrations from and
resolves capabilities against.

#### namespace

> **namespace**: `string`

The state-key namespace this project owns.

Declared, never inferred from `project` — ADR-083 §1. Every compiled state
key must sit under it, which is the collision two projects sharing one
registry cannot otherwise detect.

#### project

> **project**: `string`

The deploying project this composition belongs to.

#### routes

> **routes**: `object`[]

Placement decisions.

***

### manifests

> **manifests**: readonly `object`[]

Defined in: [packages/dsl/src/control-plane-compiler.ts:54](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/control-plane-compiler.ts#L54)

Parsed manifests for the fleet, in `document.mfes` order.
