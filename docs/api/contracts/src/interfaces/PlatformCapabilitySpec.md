[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / PlatformCapabilitySpec

# Interface: PlatformCapabilitySpec

Defined in: packages/contracts/src/platform-contract.ts:113

Everything the platform knows about one capability, in one place: how it is
spelled in a manifest, what it is called in code, what it returns, what the
daemon calls over HTTP, and how it moves the lifecycle machine.

## Properties

### description

> `readonly` **description**: `string`

Defined in: packages/contracts/src/platform-contract.ts:135

Human-readable purpose — sourced from docs/PLATFORM-CONTRACT.md.

***

### endpoint

> `readonly` **endpoint**: `string`

Defined in: packages/contracts/src/platform-contract.ts:133

Path it is served on.

***

### enterState?

> `readonly` `optional` **enterState**: `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"error"` \| `"destroyed"`

Defined in: packages/contracts/src/platform-contract.ts:142

State entered before execution, e.g. `load` → `loading`.

***

### errorState?

> `readonly` `optional` **errorState**: `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"error"` \| `"destroyed"`

Defined in: packages/contracts/src/platform-contract.ts:146

State entered on failure.

***

### exitState?

> `readonly` `optional` **exitState**: `"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"error"` \| `"destroyed"`

Defined in: packages/contracts/src/platform-contract.ts:144

State entered on success.

***

### httpMethod

> `readonly` **httpMethod**: `"GET"` \| `"POST"`

Defined in: packages/contracts/src/platform-contract.ts:131

HTTP verb the daemon or registry uses to invoke it.

***

### manifestKey

> `readonly` **manifestKey**: `string`

Defined in: packages/contracts/src/platform-contract.ts:121

PascalCase spelling used as a capability entry key in `mfe-manifest.yaml`.
Manifests are accepted in either spelling; see
PLATFORM_CAPABILITY_MANIFEST_KEYS.

***

### name

> `readonly` **name**: `"describe"` \| `"load"` \| `"render"` \| `"refresh"` \| `"emit"` \| `"query"` \| `"schema"` \| `"authorizeAccess"` \| `"health"` \| `"updateControlPlaneState"`

Defined in: packages/contracts/src/platform-contract.ts:115

Canonical camelCase name — the orchestrator method on `BaseMFE`.

***

### preStates

> `readonly` **preStates**: readonly (`"uninitialized"` \| `"loading"` \| `"ready"` \| `"rendering"` \| `"error"` \| `"destroyed"`)[]

Defined in: packages/contracts/src/platform-contract.ts:140

States the capability may be invoked from. Empty means any state,
including `destroyed` — only `emit` is that permissive.

***

### resultType

> `readonly` **resultType**: `string`

Defined in: packages/contracts/src/platform-contract.ts:129

Return type of the orchestrator, as a TypeScript type name.

***

### wrapperMethod

> `readonly` **wrapperMethod**: `string`

Defined in: packages/contracts/src/platform-contract.ts:127

The `do*()` method a concrete MFE implements. `BaseMFE` orchestrates
(guards, phases, telemetry) and delegates the domain work here — which is
also why these names are forbidden as lifecycle handler references.
