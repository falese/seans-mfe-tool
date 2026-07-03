[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MessageDirection

# Type Alias: MessageDirection

> **MessageDirection** = `"COMPONENT"` \| `"ACTION"`

Defined in: [packages/contracts/src/messages.ts:203](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L203)

Direction of data flow:
  COMPONENT = down (Registry → Daemon → Renderer)
  ACTION    = up   (Renderer/MFE → Daemon → Registry)
