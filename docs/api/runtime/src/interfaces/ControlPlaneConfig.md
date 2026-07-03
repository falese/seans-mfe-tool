[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / ControlPlaneConfig

# Interface: ControlPlaneConfig

Defined in: [packages/runtime/src/base-control-plane.ts:60](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L60)

Constructor configuration accepted by every control-plane implementation.

Concrete implementations extend this with their own daemon-connection fields
(e.g. `daemonUrl` for a remote Node daemon, `binaryPath` for a spawned Rust
binary).

## Properties

### adaptors?

> `optional` **adaptors**: `Record`\<`string`, [`ExperienceAdaptor`](ExperienceAdaptor.md)\>

Defined in: [packages/runtime/src/base-control-plane.ts:85](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L85)

Custom content-type adaptors merged with the built-in set.
Use sparingly — prefer the built-in adaptors (module-federation,
text/html, application/json).

***

### container

> **container**: [`LayoutHostLike`](LayoutHostLike.md)

Defined in: [packages/runtime/src/base-control-plane.ts:62](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L62)

Host element (or structural equivalent) LayoutManager mounts into.

***

### hostFramework?

> `optional` **hostFramework**: `string`

Defined in: [packages/runtime/src/base-control-plane.ts:72](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L72)

The host shell's framework (e.g. `'react'`).
When set, LayoutManager uses ADR-056 handle negotiation: MFEs that expose a
matching native handle (e.g. a React component) are composed in-tree with
shared context (providers, router, store). Omit for a framework-free host —
every MFE then composes via its guaranteed imperative handle (isolation).

***

### onError()?

> `optional` **onError**: (`message`) => `void`

Defined in: [packages/runtime/src/base-control-plane.ts:89](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L89)

Called when LayoutManager encounters a mounting error.

#### Parameters

##### message

`string`

#### Returns

`void`

***

### onStatus()?

> `optional` **onStatus**: (`status`) => `void`

Defined in: [packages/runtime/src/base-control-plane.ts:87](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L87)

Called when the daemon transport status changes.

#### Parameters

##### status

[`TransportStatus`](../type-aliases/TransportStatus.md)

#### Returns

`void`

***

### providerValues?

> `optional` **providerValues**: `Record`\<`string`, `unknown`\>

Defined in: [packages/runtime/src/base-control-plane.ts:79](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L79)

Host-injected provider values (theme, locale, auth claims, router state, …)
delivered to every composed MFE as `props.hostContext` (ADR-060
value-injection). The island re-provides its own framework context from
these — context reaches the MFE without a shared reconciler.

***

### session?

> `optional` **session**: [`SessionContext`](../../../contracts/src/interfaces/SessionContext.md)

Defined in: [packages/runtime/src/base-control-plane.ts:64](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L64)

Session context threaded into every action (user, jwt, locale).
