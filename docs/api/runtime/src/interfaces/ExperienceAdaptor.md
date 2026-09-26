[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ExperienceAdaptor

# Interface: ExperienceAdaptor

Defined in: [packages/runtime/src/layout-adaptors.ts:99](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L99)

## Methods

### mount()

> **mount**(`experience`, `slot`, `helpers`): `Promise`\<`void` \| [`UnmountFn`](../type-aliases/UnmountFn.md)\>

Defined in: [packages/runtime/src/layout-adaptors.ts:100](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/layout-adaptors.ts#L100)

#### Parameters

##### experience

[`RenderedExperience`](../../../contracts/src/interfaces/RenderedExperience.md)

##### slot

[`SlotElementLike`](SlotElementLike.md)

##### helpers

[`AdaptorHelpers`](AdaptorHelpers.md)

#### Returns

`Promise`\<`void` \| [`UnmountFn`](../type-aliases/UnmountFn.md)\>
