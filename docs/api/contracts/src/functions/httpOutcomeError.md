[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / httpOutcomeError

# Function: httpOutcomeError()

> **httpOutcomeError**(`message`, `status?`): [`BusinessError`](../classes/BusinessError.md) \| [`NetworkError`](../classes/NetworkError.md) \| [`SecurityError`](../classes/SecurityError.md) \| [`ValidationError`](../classes/ValidationError.md)

Defined in: [packages/contracts/src/http-outcome.ts:44](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/http-outcome.ts#L44)

The typed error a caller that throws should throw for this outcome.

## Parameters

### message

`string`

### status?

`number`

## Returns

[`BusinessError`](../classes/BusinessError.md) \| [`NetworkError`](../classes/NetworkError.md) \| [`SecurityError`](../classes/SecurityError.md) \| [`ValidationError`](../classes/ValidationError.md)
