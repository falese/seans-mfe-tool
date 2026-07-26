[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MessageKind

# Type Alias: MessageKind

> **MessageKind** = `"COMPONENT_UPDATE"` \| `"STATE_SNAPSHOT"` \| `"ACTION_ECHO"` \| `"ACTION"` \| `"ACTION_FORWARD"`

Defined in: [packages/contracts/src/messages.ts:213](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L213)

Purpose of a message:
  COMPONENT_UPDATE — a new/changed RenderedExperience pushed to renderers
  STATE_SNAPSHOT   — full ExperienceState for one experience
  ACTION_ECHO      — immediate daemon ack of a received action
  ACTION           — raw upward action (set by the renderer or MFE)
  ACTION_FORWARD   — daemon → registry forwarded action
