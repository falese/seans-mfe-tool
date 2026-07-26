[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / ModuleFederationExperienceOutput

# Interface: ModuleFederationExperienceOutput

Defined in: packages/contracts/src/messages.ts:160

The `output` shape for `contentType: 'module-federation'` experiences
(ADR-055). Gives a layout manager everything needed to load the remote and
drive its BaseMFE lifecycle — framework-independent: React and Angular
remotes share the same bootstrap contract (`{ mfe, mfeReady }`).

## Properties

### component?

> `optional` **component**: `string`

Defined in: packages/contracts/src/messages.ts:168

Component name passed to mfe.render() inputs.

***

### module

> **module**: `string`

Defined in: packages/contracts/src/messages.ts:166

Exposed module to import, e.g. './App' (must export `{ mfe, mfeReady }`).

***

### props?

> `optional` **props**: `Record`\<`string`, `unknown`\>

Defined in: packages/contracts/src/messages.ts:170

Extra props merged into the render inputs.

***

### remoteEntryUrl

> **remoteEntryUrl**: `string`

Defined in: packages/contracts/src/messages.ts:162

Where the renderer fetches the remote container, e.g. http://host:3001/remoteEntry.js

***

### scope

> **scope**: `string`

Defined in: packages/contracts/src/messages.ts:164

Global container name, e.g. 'abc_kids_flappy'.
