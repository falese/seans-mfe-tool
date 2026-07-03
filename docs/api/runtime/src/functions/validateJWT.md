[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [runtime/src](../README.md) / validateJWT

# Function: validateJWT()

> **validateJWT**(`context`): `Promise`\<`void`\>

Defined in: [packages/runtime/src/handlers/auth.ts:15](https://github.com/falese/seans-mfe-tool/blob/main/packages/runtime/src/handlers/auth.ts#L15)

Validates JWT in context and sets context.user
Emits telemetry events for success/failure

`jsonwebtoken` is loaded dynamically so it stays out of any browser bundle
that imports the runtime package — validation only ever runs server-side
(BFF handler) where the dynamic require is satisfied by Node.

## Parameters

### context

[`Context`](../interfaces/Context.md)

request context

## Returns

`Promise`\<`void`\>

## Throws

Error if JWT is missing, invalid, or secret is not set
