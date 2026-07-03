[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / classifyError

# Function: classifyError()

> **classifyError**(`error`, `config`): [`ErrorClassification`](../interfaces/ErrorClassification.md)

Defined in: [packages/contracts/src/error-classifier.ts:34](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/error-classifier.ts#L34)

Classifies an error using hybrid detection:
1. Check for typed error (has 'type' property)
2. Pattern match error message against config
3. Default to 'unknown' (not retryable)

ADR-030: Error Classification with Hybrid Detection

## Parameters

### error

`Error`

### config

[`ErrorHandlingConfig`](../interfaces/ErrorHandlingConfig.md)

## Returns

[`ErrorClassification`](../interfaces/ErrorClassification.md)
