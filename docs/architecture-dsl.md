# DSL & Type System Architecture

**Status:** Informative reference for the DSL manifest and type system. Validation rules
are normative and enforced by Zod at runtime. Closes documentation gap **G02**.

**Authoritative sources:**

| Concept | Source |
| --- | --- |
| Manifest schema (Zod, single source of truth) | `src/dsl/schema.ts` |
| Parser | `src/dsl/parser.ts` |
| Validator | `src/dsl/validator.ts` |
| Type system | `src/dsl/type-system.ts` |
| Governing decisions | ADR-006 (unified types), ADR-008 (data-type metadata), ADR-010 (data lifecycle), ADR-034/036 (open framework/bundler), ADR-040 (handler sources) |

> Types are **inferred from the Zod schemas** (`schema.ts:6–7`) — the schema is the single
> source of truth for both runtime validation and the TypeScript types. There is no
> separate hand-maintained type definition to drift from.

---

## 1. The manifest at a glance

`DSLManifestSchema` (`src/dsl/schema.ts:382–416`) is the root. Top-level shape:

| Field | Type | Rule | Source |
| --- | --- | --- | --- |
| `name` | string | required, min length 1 | `:384` |
| `version` | string | required, semver `^\d+\.\d+\.\d+` | `:385` |
| `type` | enum | `tool \| agent \| feature \| service \| remote \| shell \| bff` | `:386`, `:17–19` |
| `language` | enum | `javascript \| typescript \| python \| go \| rust \| java` | `:387`, `:23–29` |
| `framework` | string (optional) | open string; omit ⇒ `react` | `:391`, `:39` |
| `bundler` | string (optional) | open string; omit ⇒ `rspack` | `:392`, `:43` |
| `description`,`owner`,`tags`,`category` | optional identity | — | `:395–398` |
| `endpoint`,`remoteEntry`,`discovery` | URL (optional) | must be valid URLs | `:401–403` |
| `capabilities` | array | the contract surface (§3) | `:406` |
| `dependencies` | object (optional) | pinned versions (ADR-050) | `:407` |
| `data` | object (optional) | BFF/data config (§4) | `:408` |
| `performance` | object (optional) | plugins/transforms (ADR-027) | `:411` |
| `transforms` | string[] (optional) | resolver-composition YAML | `:412` |
| `authorization` | unknown (optional) | **deferred — ADR-007** | `:415` |

## 2. Open vs. closed fields — the polyglot decision

`framework` and `bundler` are deliberately **open strings**
(`FrameworkSchema = z.string().min(1)`, `:39`/`:43`), not enums. Unknown values emit a
**stderr warning, not a validation error** (ADR-036, #181), so a third-party plugin can
register `vue`/`vite` without a core change. `KNOWN_FRAMEWORKS` / `KNOWN_BUNDLERS`
(`:33`/`:36`) drive only the warning, not rejection.

By contrast `type` and `language` are **closed enums** — they select codegen templates and
must be known to the core.

## 3. Capabilities, lifecycle hooks, and handler sources

`capabilities` is an array of `CapabilityEntry` records (`:155–156`); each maps a capability
name to a `CapabilityConfig` (`:143–152`) with `inputs`, `outputs`, `description`, and a
`lifecycle` block.

- **Platform capabilities** — the nine names in `PLATFORM_CAPABILITIES` (`:51–61`): `load`,
  `render`, `refresh`, `authorizeAccess`, `health`, `describe`, `schema`, `query`, `emit`.
  Every MFE implements these (the runtime contract; see
  [runtime platform](./architecture-runtime-platform.md)).
- **Domain capabilities** — any other name; codegen emits a developer-owned stub.
- **Lifecycle hooks** — under each capability's `lifecycle.{before,main,after,error}`
  (`LifecycleSchema`, `:130–136`). Codegen aggregates and dedupes these across capabilities.
- **Handler sources (ADR-040)** — a hook with a `source` field is resolved from an external
  module and wired through the generated handler registry rather than stubbed. See
  [Code Generation Architecture](./architecture-codegen.md) §2.5.

## 4. The `data` section (BFF input)

`DataConfigSchema` (`:263–271`) carries the BFF/GraphQL-Mesh configuration: `sources`,
`transforms`, `plugins`, `serve` (`endpoint`, `playground`), `lineage`, and the demo-mode
`mockSwitch` (`:259`, ADR-052). This is the input the BFF generator consumes to write
`.meshrc.yaml`; see [BFF Architecture](./architecture-bff.md).

## 5. Validation flow

`parser.ts` loads and parses YAML; `validator.ts` runs the Zod schema and surfaces typed
errors. Validation is **fail-fast and structured** — a malformed manifest produces a
`ValidationError` (exit 64; see the [CLI Contract](./cli-contract.md)) with the offending
field and constraint, never a partial generation.

> **Drift guard (G13):** because types are inferred from Zod, this field reference should be
> regenerated from `schema.ts` rather than hand-maintained. Until that is wired into CI,
> treat `schema.ts` line citations above as authoritative over this table if they disagree.

## Related

- [Code Generation Architecture](./architecture-codegen.md) — consumes this manifest.
- [BFF Architecture](./architecture-bff.md) — consumes the `data` section.
- [CLI Contract](./cli-contract.md) — validation error envelope/exit codes.
</content>
