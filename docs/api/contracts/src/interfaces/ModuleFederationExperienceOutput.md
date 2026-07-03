[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ModuleFederationExperienceOutput

# Interface: ModuleFederationExperienceOutput

Defined in: [packages/contracts/src/messages.ts:160](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L160)

The `output` shape for `contentType: 'module-federation'` experiences
(ADR-055). Gives a layout manager everything needed to load the remote and
drive its BaseMFE lifecycle — framework-independent: React and Angular
remotes share the same bootstrap contract (`{ mfe, mfeReady }`).

## Properties

### component?

> `optional` **component**: `string`

Defined in: [packages/contracts/src/messages.ts:168](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L168)

Component name passed to mfe.render() inputs.

***

### module

> **module**: `string`

Defined in: [packages/contracts/src/messages.ts:166](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L166)

Exposed module to import, e.g. './App' (must export `{ mfe, mfeReady }`).

***

### props?

> `optional` **props**: `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/messages.ts:170](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L170)

Extra props merged into the render inputs.

***

### remoteEntryUrl

> **remoteEntryUrl**: `string`

Defined in: [packages/contracts/src/messages.ts:162](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L162)

Where the renderer fetches the remote container, e.g. http://host:3001/remoteEntry.js

***

### scope

> **scope**: `string`

Defined in: [packages/contracts/src/messages.ts:164](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/messages.ts#L164)

Global container name, e.g. 'abc_kids_flappy'.
