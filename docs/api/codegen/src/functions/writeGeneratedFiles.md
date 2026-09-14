[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [codegen/src](../README.md) / writeGeneratedFiles

# Function: writeGeneratedFiles()

> **writeGeneratedFiles**(`files`, `options`): `Promise`\<\{ `errors`: `string`[]; `files`: [`GeneratedFile`](../interfaces/GeneratedFile.md)[]; `reseeded`: `string`[]; `skipped`: `string`[]; \}\>

Defined in: [packages/codegen/src/template-io.ts:88](https://github.com/falese/seans-mfe-tool/blob/main/packages/codegen/src/template-io.ts#L88)

Write the generation plan to disk.

Ownership decides what happens to a file that already exists (ADR-043,
ADR-077 §1); `force` decides whether the developer-owned half can be
re-seeded (ADR-091).

| exists | `overwrite` | `force` | outcome            |
|--------|-------------|---------|--------------------|
| no     | either      | either  | written            |
| yes    | `true`      | either  | re-stamped         |
| yes    | `false`     | no      | skipped — yours    |
| yes    | `false`     | yes     | **re-seeded**      |

Generator-owned files are re-stamped unconditionally and always were: ADR-043
makes regeneration idempotent and `check:mfe-drift` requires those files to
match a fresh generation at all times. `force` never had a role there, which
is why it did nothing at all until ADR-091 gave it this one.

`reseeded` is reported separately from `files` because it is the only outcome
that can destroy work. A caller that cannot tell a re-seed from a first write
cannot warn about it, and this flag is worth warning about.

WHAT `force` STILL CANNOT REACH: a capability whose feature file already
exists. Those never enter the plan — `generateAllFiles` omits them (see
`capabilityImplemented`) rather than marking them — so a writer that walks
the plan cannot touch them however it is called. That is the boundary between
scaffolding, which the platform can re-seed, and domain implementation, which
it must not (ADR-091 §3).

## Parameters

### files

[`GeneratedFile`](../interfaces/GeneratedFile.md)[]

### options

#### dryRun?

`boolean`

#### force?

`boolean`

## Returns

`Promise`\<\{ `errors`: `string`[]; `files`: [`GeneratedFile`](../interfaces/GeneratedFile.md)[]; `reseeded`: `string`[]; `skipped`: `string`[]; \}\>
