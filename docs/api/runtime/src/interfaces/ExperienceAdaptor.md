[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ExperienceAdaptor

# Interface: ExperienceAdaptor

Defined in: [packages/runtime/src/layout-adaptors.ts:92](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L92)

## Methods

### mount()

> **mount**(`experience`, `slot`, `helpers`): `Promise`\<`void` \| [`UnmountFn`](../type-aliases/UnmountFn.md)\>

Defined in: [packages/runtime/src/layout-adaptors.ts:93](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L93)

#### Parameters

##### experience

[`RenderedExperience`](../../../contracts/src/interfaces/RenderedExperience.md)

##### slot

[`SlotElementLike`](SlotElementLike.md)

##### helpers

[`AdaptorHelpers`](AdaptorHelpers.md)

#### Returns

`Promise`\<`void` \| [`UnmountFn`](../type-aliases/UnmountFn.md)\>
