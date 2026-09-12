[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / ownershipOf

# Function: ownershipOf()

> **ownershipOf**(`plan`): `Record`\<`string`, [`FileSpec`](../interfaces/FileSpec.md)\[`"owner"`\]\>

Defined in: [packages/codegen/src/file-plan.ts:281](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/file-plan.ts#L281)

The ownership map, read straight off the plan.

Three subsystems need this split and each used to derive it independently:
`check:mfe-drift` (compares only generator-owned files), `mfe:validate`'s
`developerOwned` predicate (scans only the other half for platform
migrations), and the dry-run planner. Ownership was 25 inline booleans, so
moving a file between the two was invisible in review — which is the risk
ADR-082 exists to mitigate. Here it is one column.

## Parameters

### plan

readonly [`FileSpec`](../interfaces/FileSpec.md)[]

## Returns

`Record`\<`string`, [`FileSpec`](../interfaces/FileSpec.md)\[`"owner"`\]\>
