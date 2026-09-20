[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / BaseFrameworkPlugin

# Abstract Class: BaseFrameworkPlugin

Defined in: [packages/contracts/src/framework-plugin.ts:103](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L103)

Abstract base class every framework plugin must extend.

Core commands (`build:check`, `build:dev`, `build:prod`, `build:docker`)
call these methods polymorphically — same pattern as BaseMFE.load()
orchestrating this.doLoad().

## Constructors

### Constructor

> **new BaseFrameworkPlugin**(): `BaseFrameworkPlugin`

#### Returns

`BaseFrameworkPlugin`

## Properties

### \_\_frameworkPluginBrand

> `readonly` **\_\_frameworkPluginBrand**: `"__BaseFrameworkPlugin__"`

Defined in: [packages/contracts/src/framework-plugin.ts:110](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L110)

Brand tag for cross-module instanceof checks.
When the same class is loaded from different physical paths
(e.g. npm link), `instanceof` fails because they are different
class objects.  This string brand lets us duck-type safely.

***

### bundler

> `abstract` `readonly` **bundler**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:124](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L124)

Bundler name matching the manifest `bundler` field.

***

### defaultPort?

> `readonly` `optional` **defaultPort**: `number`

Defined in: [packages/contracts/src/framework-plugin.ts:147](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L147)

Default dev-server port.

Optional since ADR-097: a target that is not served over HTTP has no port.
The web lane declares one; the Swift lane does not. Declared rather than
abstract: an optional abstract member still demands an implementation.

***

### directoryStructure

> `abstract` `readonly` **directoryStructure**: `string`[]

Defined in: [packages/contracts/src/framework-plugin.ts:150](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L150)

Directories to create on `remote:init`.

***

### displayName

> `abstract` `readonly` **displayName**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:118](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L118)

Human-readable name for CLI output.

***

### framework

> `abstract` `readonly` **framework**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:121](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L121)

Framework name matching the manifest `framework` field.

***

### id

> `abstract` `readonly` **id**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:115](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L115)

Unique id, e.g. `'react-rspack'`, `'angular-webpack'`.

***

### targetId

> `readonly` **targetId**: `string` = `'web'`

Defined in: [packages/contracts/src/framework-plugin.ts:136](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L136)

Which build this plugin produces for a manifest (ADR-097).

`'web'` — the default — is the primary build, selected by the manifest's
`framework` field. Any other value names a key under `targets:`, a build
produced ALONGSIDE the primary one from the same capabilities (ADR-095).

Concrete, not abstract, so a plugin written before secondary targets
existed keeps working unchanged.

## Methods

### buildProduction()

> `abstract` **buildProduction**(`manifest`, `opts`): `Promise`\<[`BuildResult`](../interfaces/BuildResult.md)\>

Defined in: [packages/contracts/src/framework-plugin.ts:210](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L210)

Run a production build with structured error output.

#### Parameters

##### manifest

`unknown`

##### opts

###### cwd

`string`

###### outputDir

`string`

#### Returns

`Promise`\<[`BuildResult`](../interfaces/BuildResult.md)\>

***

### checkEnvironment()

> `abstract` **checkEnvironment**(): `Promise`\<[`EnvCheckResult`](../interfaces/EnvCheckResult.md)[]\>

Defined in: [packages/contracts/src/framework-plugin.ts:196](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L196)

Validate that the local environment has the required tools.

#### Returns

`Promise`\<[`EnvCheckResult`](../interfaces/EnvCheckResult.md)[]\>

***

### getDockerStrategy()?

> `optional` **getDockerStrategy**(`manifest`): [`DockerStrategy`](../interfaces/DockerStrategy.md)

Defined in: [packages/contracts/src/framework-plugin.ts:223](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L223)

Return the Docker build strategy for this target.

Optional since ADR-097. The shipped strategies serve a built bundle from
nginx, which a natively-linked target has no use for.

#### Parameters

##### manifest

`unknown`

#### Returns

[`DockerStrategy`](../interfaces/DockerStrategy.md)

***

### getSharedDependencies()

> `abstract` **getSharedDependencies**(`manifest`): [`SharedDep`](../interfaces/SharedDep.md)[]

Defined in: [packages/contracts/src/framework-plugin.ts:191](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L191)

Shared dependencies for Module Federation. Empty for non-MF targets.

#### Parameters

##### manifest

`unknown`

#### Returns

[`SharedDep`](../interfaces/SharedDep.md)[]

***

### getTestExtension()

> `abstract` **getTestExtension**(): `string`

Defined in: [packages/contracts/src/framework-plugin.ts:188](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L188)

Test file extension, e.g. `'.test.tsx'`.

#### Returns

`string`

***

### registerCodegen()?

> `optional` **registerCodegen**(): `void`

Defined in: [packages/contracts/src/framework-plugin.ts:185](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L185)

Register this plugin's contribution to code generation (ADR-097).

ADR-092 §5 removed six scalar codegen getters from this class —
`getTemplateDir`, `getTemplateVars`, `getRuntimeImport`,
`getRuntimeClassName`, `getSourceExtension`, `getRuntimeDependencies` —
because every one was abstract, implemented twice, and called by nothing.
`getTemplateDir()` had rotted to a directory deleted in ADR-061 and its
test still passed, because it asserted the STRING and never that the
directory existed.

It also said what the replacement would have to look like:

  > the real extension point needs a template directory AND a file plan
  > together, not six scalar getters

This is that member, and the generator is now able to receive it: ADR-093
made what is emitted a list of `FileSpec`s, and ADR-094 gave the generator
`FileContributor` — a template root the contributor owns plus the specs to
resolve against it. So one method with a real caller replaces six without
one.

Implementations call `registerVariant()` (a primary build) or
`registerFileContributor()` (a secondary target) from `@seans-mfe/codegen`.
Typed as an optional no-arg method rather than returning a codegen type,
because `contracts` imports nothing first-party (ADR-061) and must not
learn codegen's vocabulary to declare this.

Idempotent: both registries key by id, so calling it once per manifest in
a loop over a fleet is safe and is what the drift gate does.

#### Returns

`void`

***

### startDevServer()?

> `optional` **startDevServer**(`manifest`, `opts`): `Promise`\<[`DevServerHandle`](../interfaces/DevServerHandle.md)\>

Defined in: [packages/contracts/src/framework-plugin.ts:204](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L204)

Start the dev server.

Optional since ADR-097 — meaningless for a target with no HTTP surface.
Absent rather than throwing, so a caller can tell from the type.

#### Parameters

##### manifest

`unknown`

##### opts

###### cwd

`string`

###### port

`number`

#### Returns

`Promise`\<[`DevServerHandle`](../interfaces/DevServerHandle.md)\>
