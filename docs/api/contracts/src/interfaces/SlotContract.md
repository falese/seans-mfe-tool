[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / SlotContract

# Interface: SlotContract

Defined in: packages/contracts/src/slot-contract.ts:69

## Properties

### declarations

> `readonly` **declarations**: readonly [`ProvidedSlotDeclaration`](ProvidedSlotDeclaration.md)[]

Defined in: packages/contracts/src/slot-contract.ts:71

The manifest declarations this contract was built from.

## Methods

### assertDeclared()

> **assertDeclared**(`id`): `void`

Defined in: packages/contracts/src/slot-contract.ts:75

Throw a ValidationError unless `id` is declared.

#### Parameters

##### id

`string`

#### Returns

`void`

***

### matches()

> **matches**(`id`): `boolean`

Defined in: packages/contracts/src/slot-contract.ts:73

True when `id` matches a declared literal or keyed pattern.

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### register()

> **register**\<`E`\>(`provideSlot`, `id`, `element`): `void`

Defined in: packages/contracts/src/slot-contract.ts:82

Guarded registration: asserts the id is declared, then hands the element
to the host. A null element releases the runtime registration; without a
host callback (standalone/dev mode) registration is a no-op. The assertion
still runs, so an undeclared id fails fast even before composition.

#### Type Parameters

##### E

`E`

#### Parameters

##### provideSlot

[`ProvideSlotFn`](../type-aliases/ProvideSlotFn.md)\<`E`\> | `undefined`

##### id

`string`

##### element

`E` | `null`

#### Returns

`void`
