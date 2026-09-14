# Schema & Contract Architecture

**Status:** Informative reference for the contract subsystem — the types, schemas and
generated artifacts that describe what commands accept and return, and what a manifest
may contain. Normative rules live in the ADRs cited inline.

**Typeset rendering:** [`derived-contracts.html`](./derived-contracts.html), published to
the docs site. This file is canonical for the prose.

**Authoritative sources:**

| Concept | Source |
| --- | --- |
| Shared vocabulary | `packages/contracts/src/` |
| Envelope and exit codes | `packages/contracts/src/envelope.ts` |
| Command base class | `packages/oclif-base/src/BaseCommand.ts` |
| Manifest language | `packages/dsl/src/schema.ts` |
| Input schema derivation | `src/oclif/schema-derivation.ts` |
| Output schema derivation | `src/oclif/type-to-schema.ts` |
| Command-lane generator | `scripts/generate-schemas.ts` |
| Manifest-lane generator | `scripts/generate-dsl-schema.ts` |
| Published artifacts | `schemas/` |
| Agent tool registry | `src/mcp/tool-registry.ts`, `src/mcp/sources/local.ts` |
| Governing decisions | ADR-018 (envelope), ADR-019 and ADR-077 (schema derivation), ADR-065 (generated reference), ADR-075 (generate and gate), ADR-036 (open framework/bundler) |

---

## 1. What the contract subsystem does

Four things are published as machine-readable contracts:

| Contract | Artifact | Consumed by |
| --- | --- | --- |
| What a command accepts | `schemas/<cmd>.json` → `input` | the MCP tool catalogue |
| What a command returns | `schemas/<cmd>.json` → `output` | validating clients, conformance tests |
| What a manifest accepts | `schemas/dsl/manifest.schema.json` | editors, registry rule authoring |
| What a composition document accepts | `schemas/dsl/control-plane.schema.json` | `compose:build`, editors |

None of them is hand-written. Each is generated from the code that already enforces the
same rule, and a CI gate fails when the committed artifact differs from a fresh
generation (§8). The same approach produces the ADR index (ADR-075) and the API
reference (ADR-065).

---

## 2. Package layout

Dependencies run one way. `contracts` is the root and depends on nothing.

```
                      the CLI (src/)
                            ▲
        ┌───────────┬───────┴───────┬─────────────┐
   plugin-adr   plugin-api     plugin-bff    plugin-coder
        ▲           ▲               ▲             ▲
        └───────────┴──────┬────────┴─────────────┘
                           │
          oclif-base      codegen      framework-react
              ▲              ▲          framework-angular
              │              │                 ▲
              │             dsl                │
              │              ▲                 │
              └──────────────┴─────────────────┘
                             │
                         contracts
```

Separate deployables, not linked into the CLI:

| Package | Role |
| --- | --- |
| `packages/runtime` | The lifecycle barrel a generated MFE imports at build time (§6) |
| `packages/control-plane` | Registry and daemon GraphQL services a fleet deploys |

Internal dependency edges, as declared in each `package.json`:

| Package | Depends on |
| --- | --- |
| `contracts` | — |
| `dsl` | `contracts` |
| `codegen` | `contracts`, `dsl` |
| `oclif-base` | `contracts` |
| `framework-react`, `framework-angular` | `contracts` |
| `plugin-adr`, `plugin-api` | `contracts`, `oclif-base` |
| `plugin-bff` | `contracts`, `oclif-base`, `codegen` |
| `plugin-coder` | `contracts`, `dsl`, `oclif-base` |
| the CLI (`src/`) | the four plugins, `contracts`, `oclif-base` |

The framework packages carry no dependency edge from the CLI. They are resolved at run
time by `loadFrameworkPlugin()` (ADR-036), which tries the built-in package directory
first and falls back to `require('@seans-mfe/framework-<name>')`, so a third-party
framework works without an edit here.

---

## 3. `@seans-mfe/contracts`

The vocabulary every other package shares. It sits at the root of the graph because
three or more packages read each of these facts.

| Module | Contains | Read by |
| --- | --- | --- |
| `envelope.ts` | `CommandResult<T>`, `MutatingResult`, `PlannedChange`, `EXIT_CODES` | `oclif-base`, every command, the schema generator |
| `errors/` | `ValidationError`, `BusinessError`, `NetworkError`, `SystemError`, `TimeoutError`, `SecurityError` | every package, and generated MFE code via `runtime` |
| `error-classifier.ts` | Maps an error to its exit code | `oclif-base`, `runtime` |
| `platform-contract.ts` | `PLATFORM_CAPABILITIES`, `PLATFORM_CAPABILITY_SPECS` (ADR-080) | `codegen`, `runtime` |
| `slot-grammar.ts` | Slot id grammar (ADR-069) | `dsl`, `codegen`, `runtime` |
| `slot-contract.ts` | Matching, guard, address registry (ADR-073) | `dsl`, `runtime` |
| `mesh-catalog.ts` | Mesh plugin/transform classification (ADR-092) | `dsl`, `codegen` |
| `framework-plugin.ts` | `BaseFrameworkPlugin` (ADR-036) | the CLI's loader, both framework packages |
| `build-output-parser.ts`, `messages.ts`, `observability.ts`, `presentation.ts` | CLI-side concerns | the CLI |

`packages/contracts/src/__tests__/extraction-boundary.test.ts` records which of these
modules the generator core (`codegen` and `dsl`) is allowed to import, and fails when
that set changes.

---

## 4. The command contract

### 4.1 Structure

```
  command class
  ├─ static flags / args ──► deriveInputSchema ───────┐
  │                          (oclif registry)          │
  │                                                    ├──► schemas/<cmd>.json
  └─ extends BaseCommand<T> ► resolveCommandResultType │     { input, output, errorCodes }
                              typeToJsonSchema ────────┘
                              (TypeScript checker)
```

Two halves, because a command's contract lives in two places: its flag declarations are
runtime data on the class, and its result type exists only in the type system.

### 4.2 Which commands get a contract

`scripts/generate-schemas.ts` loads the registry with `Config.load(REPO_ROOT)`, the same
resolution the CLI performs at startup, so the catalogue reflects the command set the CLI
actually has. `selectCatalogCommands` then filters:

| Filter | Rule |
| --- | --- |
| `!hidden` | oclif's own signal that a command is not public |
| `!isAliasEntry` | oclif registers an alias as its own entry, identifiable by its id appearing in its own `aliases` array |
| `isFirstParty` | `seans-mfe-tool`, `@seans-mfe/*`, `@falese/*` |
| `!CATALOG_EXCLUDED` | Named exclusions, each with a written reason |

`CATALOG_EXCLUDED` holds two commands. `mcp:serve` would advertise a tool that starts
another copy of the server the agent is connected to. `schemas` prints the catalogue,
which an agent gets from `tools/list`.

### 4.3 Input half

`deriveInputSchema` reads args first, since declaration order is argv order, then flags.

- `TRANSPORT_OWNED` (`json`, `interactive`, `cwd`) is excluded. The MCP transport appends
  `--json` to every child invocation and injects `cwd` as a reserved argument, so neither
  may also arrive as a caller-set flag.
- Boolean flags map to `{type: 'boolean'}`; `multiple` flags to an array; everything else
  to a string, with `enum` when the flag declares `options`.
- `description` and `default` carry through to the schema.
- `x-positional` lists the positional args in order. JSON objects are unordered and argv
  is not, so the transport needs this to rebuild a command line.

### 4.4 Output half

`resolveCommandResultType` walks the source file for a default-exported class, reads its
`extends` clause, and takes the type argument on `BaseCommand`:

```ts
export default class MfeValidate extends BaseCommand<MfeValidateResult> {
```

`typeToJsonSchema` then converts that type:

| TypeScript | JSON Schema |
| --- | --- |
| `string`, `number`, `boolean`, `null` | the matching primitive |
| `unknown`, `any` | `{}` |
| `object` (bare keyword) | `{type: 'object'}` — TS flags this `NonPrimitive` |
| `'a' \| 'b'` | `{type: 'string', enum: [...]}` |
| `string \| null` | `{type: ['null','string']}`, sorted |
| `a?: string` | `string`, omitted from `required` |
| `T[]` | `{type: 'array', items: ...}` |
| union of object shapes | `{}` |

Three behaviours worth knowing:

- **Property descriptions come from JSDoc.** `prop.getDocumentationComment(checker)`
  populates `schema.description`, so the comment on a result field is what an agent reads.
- **Inheritance is flattened.** `getPropertiesOfType` returns inherited members, so
  `MutatingResult`'s `dryRun` and `plannedChanges` appear alongside the command's own.
- **Objects close unless they declare an index signature.**
  `additionalProperties: false` by default; a type declaring `[key: string]: unknown` is
  left open, since closing it would publish a schema stricter than the type.

The program is built with `strictNullChecks: true` regardless of the repo's tsconfig, so
`string | null` does not collapse to `string` in the published schema.

### 4.5 Assembly

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id":     "https://seans-mfe.dev/schemas/<id>.json",
  "title":   "<command id>",
  "description": "<the command's description>",
  "input":   { "...": "§4.3" },
  "output":  { "...": "§4.4" },
  "errorCodes": { "ok": 0, "usage": 2, "validation": 64, "...": "" }
}
```

`errorCodes` is spread from `EXIT_CODES` rather than restated.

Filenames encode `topic:command` as `topic-command.json`, and consumers decode by turning
each `-` back into a `:`. A hyphen inside a command id cannot round-trip, so
`schemaFilename` throws on one. A schema file with no matching command is deleted, or
reported in check mode.

A command with no resolvable result type is a generation failure, not an empty schema.

---

## 5. The manifest contract

`packages/dsl/src/schema.ts` is the Zod definition and the single source. It feeds two
consumers:

```
                        ┌─► z.infer ─────────► DSLManifest (the generator's input type)
  dsl/src/schema.ts ────┤
  (Zod)                 └─► z.toJSONSchema ──► schemas/dsl/manifest.schema.json
                                                         │
                                        editor validation ┤
                                                          └─► docs/schemas/manifest-fields.md
```

`DSLManifest` is inferred, never declared alongside the schema, so the generator receives
a manifest that is already typed and already validated.

`scripts/generate-dsl-schema.ts` emits both the manifest schema and
`control-plane.schema.json` for the composition document (ADR-083). It passes
`unrepresentable: 'any'` because parts of the language are deliberately open —
`framework` and `bundler` are `z.string().min(1)` rather than enums (ADR-036), and
authorization is deferred (ADR-007).

`scripts/generate-manifest-reference.ts` renders the field table from the generated JSON
Schema rather than from the Zod source. Field descriptions come from `.describe()` calls
on the Zod fields, so one sentence serves the schema, the editor tooltip and the
reference page.

See [DSL & Type System Architecture](./architecture-dsl.md) for the manifest's own
structure.

---

## 6. How contracts reach generated code

A generated MFE never imports `codegen` or `contracts`. It imports
`@seans-mfe-tool/runtime` and its two framework subpaths. The runtime barrel
(`packages/runtime/src/index.ts`) is the compatibility surface.

```
  contracts ──► runtime ──► the generated MFE
   (types)     (barrel)      (import specifier)
```

A generated `package.json` declares one platform dependency,
`@seans-mfe-tool/runtime`, and resolves the contracts behind it too.

What arrives that way:

| Generated code imports | Defined in | Reaches it via |
| --- | --- | --- |
| `ValidationError`, `SystemError` | `contracts/src/errors/` | `runtime/src/errors/index.ts` re-export |
| `createSlotContract`, `ProvidedSlotDeclaration` | `contracts/src/slot-contract.ts` | `runtime/src/slot-contract.ts` re-export (ADR-073) |
| `ImperativeMountHandle` | `contracts/src/` | direct re-export from the barrel |
| `Context`, `LoadResult`, `RenderResult`, `QueryResult` | `runtime/src/` | the barrel |
| `RemoteMFE` | `runtime/src/react/` | `@seans-mfe-tool/runtime/react` |
| `AngularRemoteMFE` | `runtime/src/angular/` | `@seans-mfe-tool/runtime/angular` |
| `createImperativeHandle` | `runtime/src/imperative-handle.ts` | the barrel |

Two consequences:

- A rename in `contracts` can change generated code with no runtime file in the diff,
  because the change travels through a re-export shim. `PLATFORM_MIGRATIONS`
  (`packages/codegen/src/platform-migrations.ts`, ADR-082) is where such a change is
  declared for developer-owned files that regeneration cannot reach.
- `npm run check:template-typecheck` is the gate that proves the barrel still satisfies
  generated code. It scaffolds an MFE per framework lane, installs it, and typechecks it.

See [Runtime Platform Architecture](./architecture-runtime-platform.md) for what the
runtime does once an MFE is loaded.

---

## 7. How contracts reach agents

`mcp:serve` builds its tool list from three sources:

| Source | Origin | Tool prefix |
| --- | --- | --- |
| local | the CLI's own `schemas/` | `mfe:` |
| plugin | installed oclif plugins carrying a `schemas/` directory | the plugin's topic |
| remote | servers listed in `~/.config/seans-mfe/mcp.json` | the server name |

`loadLocalTools` walks `schemas/` one level deep and turns each file into a tool:
`bff-init.json` becomes `mfe:bff:init`, with `schema.input` as the `inputSchema` and
`schema.description` as the description. It skips any file without an `input` key, which
is how standalone document schemas such as `manifest.schema.json` stay out of the tool
list.

`loadToolRegistry` merges the three sources and throws a `SystemError` on a duplicate
tool name rather than letting one source shadow another. Every tool accepts a reserved
`cwd` injected by the registry, which is the execution directory for the child process.

Each tool call spawns `seans-mfe-tool <cmd> --json` as a child process and parses one
`CommandResult` line from its stdout. Two calls are two processes, so neither observes
the other's `process.exit` or working-directory change.

See [CLI Contract](./cli-contract.md) for the envelope and exit codes.

---

## 8. Build and check commands

| Command | Produces | Gated in CI by |
| --- | --- | --- |
| `npm run build:schemas` | `schemas/<cmd>.json` for every catalogued command | `npm run build` then `git diff --exit-code schemas/` |
| `npm run build:schema:dsl` | `schemas/dsl/*.schema.json` | `build:schema:dsl:check` |
| `npm run build:manifest-reference` | `docs/schemas/manifest-fields.md` | `build:manifest-reference:check` |
| `npm run build:docs` | `docs/api` (TypeDoc, ADR-065) | the API-docs workflow |

Each generator has a `--check` mode that regenerates in memory and exits non-zero on a
difference.

Two test suites cover what generation cannot:

- `src/oclif/__tests__/output-schema-conformance.test.ts` runs each command and validates
  its real `data` payload against the published output schema with ajv. It catches what
  the type system does not see: a runtime `as` cast, a hand-built object literal, a field
  added by a helper.
- `src/oclif/__tests__/command-conformance.test.ts` asserts every catalogued command is
  either exercised there or excluded with a named reason.

---

## 9. Adding or changing a contract

**A new command.** Declare `extends BaseCommand<TResult>` with a result interface and
implement `runCommand()`. Run `npm run build:schemas`. A *"No output schema"* error means
the source file was not found by convention (`topic:cmd` →
`src/commands/topic/cmd.ts`) or the class has no type argument. Commit the generated file.

**A new result field.** Add it to the interface with a JSDoc comment; that comment becomes
the field's published description. Regenerate and commit.

**A flag's help text.** This is a contract change. It reaches the published schema and the
agent-facing tool description. Regenerate and commit.

**A manifest field.** Edit the Zod schema including its `.describe()`. Run
`build:schema:dsl` and `build:manifest-reference`, and commit both artifacts.

**A change in `contracts` that generated code sees.** Check whether it travels through the
runtime barrel (§6). If it reaches developer-owned files, add a `PLATFORM_MIGRATIONS`
entry in the same commit (ADR-082) and run `check:template-typecheck`.

Nothing under `schemas/`, `docs/api` or `docs/schemas/manifest-fields.md` is hand-edited.
Each carries a generated-file header and a gate.

---

## Related

- [CLI Contract](./cli-contract.md) — envelope shape, `--json` behaviour, exit codes
- [Code Generation Architecture](./architecture-codegen.md) — the pipeline that consumes the manifest
- [DSL & Type System Architecture](./architecture-dsl.md) — the manifest language
- [Runtime Platform Architecture](./architecture-runtime-platform.md) — the runtime the barrel exposes
- [Manifest field reference](./schemas/manifest-fields.md) — generated
