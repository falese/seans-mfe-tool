[**seans-mfe-tool API reference**](../../../../README.md)

***

[seans-mfe-tool API reference](../../../../README.md) / [runtime/src/angular](../README.md) / AngularApplicationRef

# Interface: AngularApplicationRef

Defined in: [packages/runtime/src/angular-remote-mfe.ts:34](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L34)

Minimal Angular ApplicationRef surface the runtime depends on.

We avoid importing from '@angular/core' at module scope to keep this file
loadable in non-Angular contexts (the contract tests, BFF runtime, etc.).
The real @angular/core ApplicationRef is structurally compatible.

## Properties

### components

> **components**: readonly `object`[]

Defined in: [packages/runtime/src/angular-remote-mfe.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L41)

***

### injector

> **injector**: `object`

Defined in: [packages/runtime/src/angular-remote-mfe.ts:40](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L40)

The app's injector — used to fetch its NgZone.

#### get()

> **get**(`token`): `object`

##### Parameters

###### token

`unknown`

##### Returns

`object`

###### run()

> **run**\<`T`\>(`fn`): `T`

###### Type Parameters

###### T

`T`

###### Parameters

###### fn

() => `T`

###### Returns

`T`

## Methods

### bootstrap()

> **bootstrap**(`component`, `rootElement?`): `unknown`

Defined in: [packages/runtime/src/angular-remote-mfe.ts:38](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L38)

ApplicationRef.bootstrap(componentType, rootElement) — binds to the given node.

#### Parameters

##### component

`unknown`

##### rootElement?

`Element`

#### Returns

`unknown`

***

### destroy()

> **destroy**(): `void`

Defined in: [packages/runtime/src/angular-remote-mfe.ts:35](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L35)

#### Returns

`void`

***

### tick()

> **tick**(): `void`

Defined in: [packages/runtime/src/angular-remote-mfe.ts:36](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/angular-remote-mfe.ts#L36)

#### Returns

`void`
