[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / SlotElementLike

# Interface: SlotElementLike

Defined in: [packages/runtime/src/layout-adaptors.ts:38](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L38)

## Properties

### innerHTML

> **innerHTML**: `string`

Defined in: [packages/runtime/src/layout-adaptors.ts:39](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L39)

## Methods

### addEventListener()

> **addEventListener**(`type`, `listener`): `void`

Defined in: [packages/runtime/src/layout-adaptors.ts:49](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L49)

#### Parameters

##### type

`string`

##### listener

(`event`) => `void`

#### Returns

`void`

***

### appendChild()

> **appendChild**(`child`): `unknown`

Defined in: [packages/runtime/src/layout-adaptors.ts:40](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L40)

#### Parameters

##### child

`unknown`

#### Returns

`unknown`

***

### remove()

> **remove**(): `void`

Defined in: [packages/runtime/src/layout-adaptors.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L41)

#### Returns

`void`

***

### removeAttribute()?

> `optional` **removeAttribute**(`name`): `void`

Defined in: [packages/runtime/src/layout-adaptors.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L48)

Optional so a host's own `createSlotElement` that predates it still type-
checks; every DOM element has it. Without it, cleared stamps are blanked
rather than removed (#408).

#### Parameters

##### name

`string`

#### Returns

`void`

***

### setAttribute()

> **setAttribute**(`name`, `value`): `void`

Defined in: [packages/runtime/src/layout-adaptors.ts:42](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L42)

#### Parameters

##### name

`string`

##### value

`string`

#### Returns

`void`
