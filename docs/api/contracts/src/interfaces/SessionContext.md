[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / SessionContext

# Interface: SessionContext

Defined in: [packages/contracts/src/messages.ts:37](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L37)

Per-session context threaded through every action so the registry can
resolve experiences for THIS user, in THIS application, right now.
Carried on `ActionRecord.context`; the daemon copies it into the MFE
`Context` (user, jwt, requestId) when invoking capabilities.

## Properties

### application?

> `optional` **application**: `string`

Defined in: [packages/contracts/src/messages.ts:43](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L43)

Host application type: 'web' | 'mobile' | 'desktop' | 'cli' | … (open).

***

### attributes?

> `optional` **attributes**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/messages.ts:45](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L45)

***

### jwt?

> `optional` **jwt**: `string`

Defined in: [packages/contracts/src/messages.ts:41](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L41)

Raw JWT, forwarded as the Authorization header on MFE capability calls.

***

### locale?

> `optional` **locale**: `string`

Defined in: [packages/contracts/src/messages.ts:44](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L44)

***

### sessionId

> **sessionId**: `string`

Defined in: [packages/contracts/src/messages.ts:38](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L38)

***

### user?

> `optional` **user**: [`ControlPlaneUser`](ControlPlaneUser.md)

Defined in: [packages/contracts/src/messages.ts:39](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L39)
