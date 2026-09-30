[**seans-mfe-tool API reference**](../../../README.md)

***

[seans-mfe-tool API reference](../../../README.md) / [dsl/src](../README.md) / HostSchema

# Variable: HostSchema

> `const` **HostSchema**: `ZodObject`\<\{ `id`: `ZodString`; \}, `$strict`\>

Defined in: [packages/dsl/src/schema.ts:223](https://github.com/falese/seans-mfe-tool/blob/main/packages/dsl/src/schema.ts#L223)

One shell this MFE declares it works in, named by that project's
control-plane `namespace` (ADR-107 §1).

An object rather than a bare string so a host's own access-management block
can be added beside `id` without a second spelling (§3). Strict until then:
an `auth:` written today would otherwise be stripped and read as configured.
