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

### defaultPort

> `abstract` `readonly` **defaultPort**: `number`

Defined in: [packages/contracts/src/framework-plugin.ts:129](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L129)

Default port for dev server.

***

### directoryStructure

> `abstract` `readonly` **directoryStructure**: `string`[]

Defined in: [packages/contracts/src/framework-plugin.ts:132](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L132)

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

## Methods

### buildProduction()

> `abstract` **buildProduction**(`manifest`, `opts`): `Promise`\<[`BuildResult`](../interfaces/BuildResult.md)\>

Defined in: [packages/contracts/src/framework-plugin.ts:172](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L172)

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

Defined in: [packages/contracts/src/framework-plugin.ts:163](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L163)

Validate that the local environment has the required tools.

#### Returns

`Promise`\<[`EnvCheckResult`](../interfaces/EnvCheckResult.md)[]\>

***

### getDockerStrategy()

> `abstract` **getDockerStrategy**(`manifest`): [`DockerStrategy`](../interfaces/DockerStrategy.md)

Defined in: [packages/contracts/src/framework-plugin.ts:180](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L180)

Return the Docker build strategy for this framework.

#### Parameters

##### manifest

`unknown`

#### Returns

[`DockerStrategy`](../interfaces/DockerStrategy.md)

***

### getRuntimeClassName()

> `abstract` **getRuntimeClassName**(): `string`

Defined in: [packages/contracts/src/framework-plugin.ts:149](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L149)

Runtime class name for generated MFE code.

#### Returns

`string`

***

### getRuntimeDependencies()

> `abstract` **getRuntimeDependencies**(): `Record`\<`string`, `string`\>

Defined in: [packages/contracts/src/framework-plugin.ts:135](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L135)

Runtime dependencies seeded into the manifest on init.

#### Returns

`Record`\<`string`, `string`\>

***

### getRuntimeImport()

> `abstract` **getRuntimeImport**(): `string`

Defined in: [packages/contracts/src/framework-plugin.ts:146](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L146)

Runtime package import path for generated MFE code.

#### Returns

`string`

***

### getSharedDependencies()

> `abstract` **getSharedDependencies**(`manifest`): [`SharedDep`](../interfaces/SharedDep.md)[]

Defined in: [packages/contracts/src/framework-plugin.ts:158](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L158)

Shared dependencies for Module Federation. Empty for non-MF targets.

#### Parameters

##### manifest

`unknown`

#### Returns

[`SharedDep`](../interfaces/SharedDep.md)[]

***

### getSourceExtension()

> `abstract` **getSourceExtension**(): `string`

Defined in: [packages/contracts/src/framework-plugin.ts:152](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L152)

Source file extension, e.g. `'.tsx'`.

#### Returns

`string`

***

### getTemplateDir()

> `abstract` **getTemplateDir**(): `string`

Defined in: [packages/contracts/src/framework-plugin.ts:140](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L140)

Absolute path to the EJS template directory.

#### Returns

`string`

***

### getTemplateVars()

> `abstract` **getTemplateVars**(`manifest`): `Record`\<`string`, `unknown`\>

Defined in: [packages/contracts/src/framework-plugin.ts:143](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L143)

Framework-specific template variables, merged with base vars.

#### Parameters

##### manifest

`unknown`

#### Returns

`Record`\<`string`, `unknown`\>

***

### getTestExtension()

> `abstract` **getTestExtension**(): `string`

Defined in: [packages/contracts/src/framework-plugin.ts:155](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L155)

Test file extension, e.g. `'.test.tsx'`.

#### Returns

`string`

***

### startDevServer()

> `abstract` **startDevServer**(`manifest`, `opts`): `Promise`\<[`DevServerHandle`](../interfaces/DevServerHandle.md)\>

Defined in: [packages/contracts/src/framework-plugin.ts:166](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L166)

Start the dev server.

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
