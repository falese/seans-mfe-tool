[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / DockerStrategy

# Interface: DockerStrategy

Defined in: [packages/contracts/src/framework-plugin.ts:46](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L46)

Docker multi-stage build strategy.

## Properties

### artifactPaths

> **artifactPaths**: `string`[]

Defined in: [packages/contracts/src/framework-plugin.ts:50](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L50)

***

### buildCommands

> **buildCommands**: `string`[]

Defined in: [packages/contracts/src/framework-plugin.ts:49](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L49)

***

### builderImage

> **builderImage**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:47](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L47)

***

### cmd

> **cmd**: `string`[]

Defined in: [packages/contracts/src/framework-plugin.ts:51](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L51)

***

### configFiles?

> `optional` **configFiles**: [`DockerConfigFile`](DockerConfigFile.md)[]

Defined in: [packages/contracts/src/framework-plugin.ts:55](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L55)

Config files copied into the runtime stage (e.g. the nginx server block).

***

### expose?

> `optional` **expose**: `number`

Defined in: [packages/contracts/src/framework-plugin.ts:61](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L61)

Port the runtime stage advertises via EXPOSE.

***

### healthcheck?

> `optional` **healthcheck**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:53](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L53)

***

### needsCliBuilder

> **needsCliBuilder**: `boolean`

Defined in: [packages/contracts/src/framework-plugin.ts:52](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L52)

***

### runtimeImage

> **runtimeImage**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:48](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L48)

***

### runtimeSetup?

> `optional` **runtimeSetup**: `string`[]

Defined in: [packages/contracts/src/framework-plugin.ts:57](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L57)

RUN commands executed in the runtime stage (e.g. non-root user setup).

***

### user?

> `optional` **user**: `string`

Defined in: [packages/contracts/src/framework-plugin.ts:59](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/framework-plugin.ts#L59)

Non-root user the runtime stage drops to via the USER directive.
