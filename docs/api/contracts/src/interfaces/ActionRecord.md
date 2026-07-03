[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ActionRecord

# Interface: ActionRecord

Defined in: [packages/contracts/src/messages.ts:56](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L56)

A state change flowing up: Renderer → Daemon → Registry.
Covers both user interactions (CLICK, SUBMIT) and MFE-initiated
control-plane state updates (`updateControlPlaneState` → STATE_UPDATE
with a `stateKey`).

## Properties

### actionType

> **actionType**: `string`

Defined in: [packages/contracts/src/messages.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L62)

Canonical: CLICK | SUBMIT | STATE_UPDATE. Daemons normalise raw values
 (e.g. BUTTON_CLICK → CLICK) before forwarding to the registry.

***

### componentId

> **componentId**: `string`

Defined in: [packages/contracts/src/messages.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L59)

Id of the experience (or legacy component) the action targets.

***

### context?

> `optional` **context**: [`SessionContext`](SessionContext.md)

Defined in: [packages/contracts/src/messages.ts:70](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L70)

Who/where this action came from — drives per-user registry resolution.

***

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/messages.ts:63](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L63)

***

### id

> **id**: `string`

Defined in: [packages/contracts/src/messages.ts:57](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L57)

***

### mfe?

> `optional` **mfe**: `string`

Defined in: [packages/contracts/src/messages.ts:68](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L68)

Which MFE emitted the action, when known.

***

### stateKey?

> `optional` **stateKey**: `string`

Defined in: [packages/contracts/src/messages.ts:66](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L66)

Set for updateControlPlaneState signals, e.g. 'analysis.complete'.

***

### timestamp

> **timestamp**: `string`

Defined in: [packages/contracts/src/messages.ts:64](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L64)
