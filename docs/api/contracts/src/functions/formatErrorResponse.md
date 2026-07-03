[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / formatErrorResponse

# Function: formatErrorResponse()

> **formatErrorResponse**(`error`, `classification`): \{ `error`: \{ `code`: `string`; `field`: `any`; `message`: `string`; `type`: `"network"` \| `"validation"` \| `"business"` \| `"security"` \| `"system"` \| `"timeout"` \| `"unknown"`; \}; \} \| \{ `error`: \{ `code`: `string`; `field?`: `undefined`; `message`: `string`; `type`: `string`; \}; \}

Defined in: [packages/contracts/src/error-classifier.ts:63](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L63)

## Parameters

### error

`Error`

### classification

[`ErrorClassification`](../interfaces/ErrorClassification.md)

## Returns

\{ `error`: \{ `code`: `string`; `field`: `any`; `message`: `string`; `type`: `"network"` \| `"validation"` \| `"business"` \| `"security"` \| `"system"` \| `"timeout"` \| `"unknown"`; \}; \} \| \{ `error`: \{ `code`: `string`; `field?`: `undefined`; `message`: `string`; `type`: `string`; \}; \}
