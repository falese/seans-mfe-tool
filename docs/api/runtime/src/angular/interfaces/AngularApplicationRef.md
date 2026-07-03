[**seans-mfe-tool API reference**](../../../../README.md)

***

[seans-mfe-tool API reference](../../../../README.md) / [runtime/src/angular](../README.md) / AngularApplicationRef

# Interface: AngularApplicationRef

Defined in: [packages/runtime/src/angular-remote-mfe.ts:31](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L31)

Minimal Angular ApplicationRef surface the runtime depends on.

We avoid importing from '@angular/core' at module scope to keep this file
loadable in non-Angular contexts (the contract tests, BFF runtime, etc.).
The real @angular/core ApplicationRef is structurally compatible.

## Properties

### components

> **components**: readonly `object`[]

Defined in: [packages/runtime/src/angular-remote-mfe.ts:34](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L34)

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [packages/runtime/src/angular-remote-mfe.ts:32](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L32)

#### Returns

`void`

***

### tick()

> **tick**(): `void`

Defined in: [packages/runtime/src/angular-remote-mfe.ts:33](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L33)

#### Returns

`void`
