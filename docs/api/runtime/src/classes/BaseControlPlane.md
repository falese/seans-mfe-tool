[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / BaseControlPlane

# Abstract Class: BaseControlPlane

Defined in: [packages/runtime/src/base-control-plane.ts:101](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L101)

Abstract base every control-plane implementation must extend.

Mirrors BaseMFE / BaseCommand / BaseFrameworkPlugin: the base owns the shape
(lifecycle, registry surface, LayoutManager wiring); the concrete class owns
the how (spawn vs connect, Node vs Rust vs mock).

## Constructors

### Constructor

> **new BaseControlPlane**(`config`): `BaseControlPlane`

Defined in: [packages/runtime/src/base-control-plane.ts:114](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L114)

#### Parameters

##### config

[`ControlPlaneConfig`](../interfaces/ControlPlaneConfig.md)

#### Returns

`BaseControlPlane`

## Properties

### \_\_controlPlaneBrand

> `readonly` **\_\_controlPlaneBrand**: `"__BaseControlPlane__"`

Defined in: [packages/runtime/src/base-control-plane.ts:108](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L108)

Brand tag for cross-module instanceof checks.
Concrete repos import BaseControlPlane from the runtime package; if the
same class appears at two different physical paths (e.g. npm link), a
string brand lets us duck-type safely.

***

### config

> `protected` `readonly` **config**: [`ControlPlaneConfig`](../interfaces/ControlPlaneConfig.md)

Defined in: [packages/runtime/src/base-control-plane.ts:114](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L114)

***

### displayName

> `abstract` `readonly` **displayName**: `string`

Defined in: [packages/runtime/src/base-control-plane.ts:122](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L122)

Human-readable name for CLI / observability output.

***

### id

> `abstract` `readonly` **id**: `string`

Defined in: [packages/runtime/src/base-control-plane.ts:119](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L119)

Unique id, e.g. `'node-daemon'`, `'rust-daemon'`, `'mock'`.

***

### implementation

> `abstract` `readonly` **implementation**: `string`

Defined in: [packages/runtime/src/base-control-plane.ts:125](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L125)

Runtime type tag, e.g. `'node'`, `'rust'`.

## Accessors

### activeSlots

#### Get Signature

> **get** **activeSlots**(): `string`[]

Defined in: [packages/runtime/src/base-control-plane.ts:228](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L228)

Names of currently active layout slots. Empty when not running.

##### Returns

`string`[]

***

### status

#### Get Signature

> **get** **status**(): [`ControlPlaneStatus`](../type-aliases/ControlPlaneStatus.md)

Defined in: [packages/runtime/src/base-control-plane.ts:129](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L129)

##### Returns

[`ControlPlaneStatus`](../type-aliases/ControlPlaneStatus.md)

***

### uptime

#### Get Signature

> **get** **uptime**(): `number`

Defined in: [packages/runtime/src/base-control-plane.ts:233](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L233)

Milliseconds since start() completed. Undefined when not running.

##### Returns

`number`

## Methods

### createTransport()

> `abstract` **createTransport**(): [`DaemonTransport`](../interfaces/DaemonTransport.md)

Defined in: [packages/runtime/src/base-control-plane.ts:207](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L207)

Return a DaemonTransport that LayoutManager uses to receive experiences
and send actions. Called once inside start(); not intended for host use.

#### Returns

[`DaemonTransport`](../interfaces/DaemonTransport.md)

***

### doStart()

> `abstract` `protected` **doStart**(): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-control-plane.ts:217](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L217)

Start the underlying daemon and registry.
Called by start() before LayoutManager is wired.
Concrete implementations may either spawn a subprocess or connect to
an already-running service — the abstract interface does not prescribe which.

#### Returns

`Promise`\<`void`\>

***

### doStop()

> `abstract` `protected` **doStop**(): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-control-plane.ts:223](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L223)

Shut down the underlying daemon and registry.
Called by stop() after LayoutManager has been torn down.

#### Returns

`Promise`\<`void`\>

***

### health()

> `abstract` **health**(): `Promise`\<[`ControlPlaneHealth`](../interfaces/ControlPlaneHealth.md)\>

Defined in: [packages/runtime/src/base-control-plane.ts:199](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L199)

Return current health of the daemon, registry, and registered MFEs.

#### Returns

`Promise`\<[`ControlPlaneHealth`](../interfaces/ControlPlaneHealth.md)\>

***

### register()

> `abstract` **register**(`mfe`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-control-plane.ts:186](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L186)

Register an MFE with the control plane's registry.

#### Parameters

##### mfe

[`MfeRegistration`](../../../contracts/src/interfaces/MfeRegistration.md)

#### Returns

`Promise`\<`void`\>

***

### resolve()

> `abstract` **resolve**(`action`): `Promise`\<[`Resolution`](../../../contracts/src/interfaces/Resolution.md)\>

Defined in: [packages/runtime/src/base-control-plane.ts:196](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L196)

Ask the registry to resolve an action to an experience.
Exposed for testing and tooling; in production the daemon calls this
internally as part of the action → resolution → render flow.

#### Parameters

##### action

[`ActionRecord`](../../../contracts/src/interfaces/ActionRecord.md)

#### Returns

`Promise`\<[`Resolution`](../../../contracts/src/interfaces/Resolution.md)\>

***

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-control-plane.ts:140](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L140)

Start the daemon + registry, wire LayoutManager to the configured
container, and begin receiving experiences from the control plane.

Calls `doStart()` first (concrete implementation starts the daemon),
then creates and starts LayoutManager using `createTransport()`.

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-control-plane.ts:170](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L170)

Tear down LayoutManager then shut down the daemon + registry.

Safe to call from any status; no-ops if already stopped.

#### Returns

`Promise`\<`void`\>

***

### unregister()

> `abstract` **unregister**(`name`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/base-control-plane.ts:189](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/base-control-plane.ts#L189)

Remove an MFE from the registry.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`void`\>
