[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / classifyHttpOutcome

# Function: classifyHttpOutcome()

> **classifyHttpOutcome**(`status?`): [`HttpOutcome`](../interfaces/HttpOutcome.md)

Defined in: packages/contracts/src/http-outcome.ts:34

Classify a failed request by its status. `undefined` or `0` means no
response arrived at all (offline, DNS, refused, CORS).

## Parameters

### status?

`number`

## Returns

[`HttpOutcome`](../interfaces/HttpOutcome.md)
