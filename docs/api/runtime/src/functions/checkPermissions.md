[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / checkPermissions

# Function: checkPermissions()

> **checkPermissions**(`context`, `requiredRoles`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/handlers/auth.ts:97](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/auth.ts#L97)

Checks if context.user has required roles
Emits telemetry for success/failure

## Parameters

### context

[`Context`](../interfaces/Context.md)

request context

### requiredRoles

`string`[]

array of required roles (any match)

## Returns

`Promise`\<`void`\>

## Throws

Error if user lacks required roles
