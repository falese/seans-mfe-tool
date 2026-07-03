[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / MfeRegistration

# Interface: MfeRegistration

Defined in: [packages/contracts/src/messages.ts:90](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L90)

What the registry stores when an MFE registers (via `describe`). Gives the
daemon everything it needs to reach the MFE's capability endpoints and
gives renderers what they need to mount the presentation layer.

## Properties

### baseUrl

> **baseUrl**: `string`

Defined in: [packages/contracts/src/messages.ts:96](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L96)

Base URL where the daemon reaches the capability endpoints (/render, …).

***

### capabilities

> **capabilities**: `string`[]

Defined in: [packages/contracts/src/messages.ts:97](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L97)

***

### contentType?

> `optional` **contentType**: `string`

Defined in: [packages/contracts/src/messages.ts:99](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L99)

Default render delivery mechanism, e.g. 'module-federation'.

***

### framework?

> `optional` **framework**: `string`

Defined in: [packages/contracts/src/messages.ts:115](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L115)

Framework the MFE is built with (e.g. 'react', 'angular'). Observability
plus native-handle negotiation (ADR-056). Open string (ADR-036).

***

### handleKinds?

> `optional` **handleKinds**: `string`[]

Defined in: [packages/contracts/src/messages.ts:121](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L121)

Presentation handle kinds this MFE exposes (ADR-056). Lets a host-side
provider negotiate the composition strategy before loading the remote —
`imperative-dom` is the guaranteed floor; native kinds are opt-in.

***

### manifest?

> `optional` **manifest**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/messages.ts:122](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L122)

***

### moduleFederation?

> `optional` **moduleFederation**: `object`

Defined in: [packages/contracts/src/messages.ts:110](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L110)

For client-side MFEs delivered via module federation: how a layout
manager loads and mounts the remote (ADR-055). When present together
with `remoteEntryUrl` and `contentType: 'module-federation'`, the daemon
synthesizes the RenderedExperience from the registration instead of
calling HTTP capability endpoints — the BaseMFE lifecycle runs in the
host shell, not server-side.

#### component?

> `optional` **component**: `string`

#### module

> **module**: `string`

#### scope

> **scope**: `string`

***

### name

> **name**: `string`

Defined in: [packages/contracts/src/messages.ts:91](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L91)

***

### remoteEntryUrl?

> `optional` **remoteEntryUrl**: `string`

Defined in: [packages/contracts/src/messages.ts:101](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L101)

For module-federation MFEs: where the renderer fetches remoteEntry.

***

### type

> **type**: `string`

Defined in: [packages/contracts/src/messages.ts:94](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L94)

DSL manifest `type`: tool | agent | feature | service | remote | shell | bff.

***

### version

> **version**: `string`

Defined in: [packages/contracts/src/messages.ts:92](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L92)
