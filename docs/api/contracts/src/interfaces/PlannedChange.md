[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [contracts/src](../README.md) / PlannedChange

# Interface: PlannedChange

Defined in: [packages/contracts/src/envelope.ts:73](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L73)

The `--dry-run` mixin: what a mutating command reports it WOULD do.

Every mutating command carries it (ADR-018 / the CLI contract), so it is
part of the envelope's vocabulary rather than any one command's result. It
lives here because `@seans-mfe/contracts` is the one package the CLI and
every plugin already depend on — PLUGIN-CONTRACT §1 requires it as a regular
dependency — which makes this the only place all three can share one
definition.

It was previously declared in `src/oclif/results.ts` AND copied into
`@seans-mfe/plugin-bff/src/types.ts` under the comment "duplicated here so the
plugin is self-contained". Extracting a second plugin would have made three
copies of a contract type, which is precisely the shape ADR-080 exists to
make unrepresentable.

## Properties

### detail?

> `optional` **detail**: `string`

Defined in: [packages/contracts/src/envelope.ts:83](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L83)

***

### op

> **op**: `"create"` \| `"overwrite"` \| `"reseed"` \| `"skip"` \| `"spawn"`

Defined in: [packages/contracts/src/envelope.ts:81](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L81)

`overwrite` re-stamps a generator-owned file; `skip` leaves a
developer-owned one alone. `reseed` is the third outcome ADR-091 adds —
a developer-owned file that exists and WILL be replaced because `--force`
was passed. It is distinct from `overwrite` because it is the only op that
can destroy work, and a dry run that calls it `overwrite` hides that.

***

### target

> **target**: `string`

Defined in: [packages/contracts/src/envelope.ts:82](https://github.com/falese/seans-mfe-tool/blob/main/packages/contracts/src/envelope.ts#L82)
