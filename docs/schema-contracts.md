# Schemas and Contracts

**Status:** Explanatory. How this repository generates its published contracts,
and what that does and doesn't catch.

**Typeset rendering:** [`derived-contracts.html`](./derived-contracts.html) —
same content, with the lane diagrams drawn. Published to the docs site and to an
Artifact from that same file. This file is canonical for the prose.

**Citations** are by symbol, not line number. Line numbers go stale.

**Scope:** where a contract comes from. For the envelope shape and exit codes see
[`cli-contract.md`](./cli-contract.md). For what the manifest accepts field by
field see [`schemas/manifest-fields.md`](./schemas/manifest-fields.md).

---

## 1. Why

`seans-mfe-tool` is a CLI, a library, and an MCP tool surface. All three need the
same facts: what a command accepts, what it returns, what a manifest allows.

Writing those facts down three times is how they end up disagreeing. What went
wrong here when we did:

- `build:*` had no schema entry, so an agent could scaffold and validate an MFE
  over MCP but not build one.
- `deploy` advertised eight flags the command doesn't have. Agents using them got
  a parse failure.
- `remote:generate` returned a `preserved` field missing from a schema marked
  `additionalProperties: false`. Validating clients rejected every successful
  response. Same for `bff:validate`'s `manifest` and `meshConfig`.
- Four documents described the manifest language. The one titled *"the complete
  platform contract that ALL MFEs must conform to"* didn't know the slot contract
  existed.
- Two packages read `manifest.transforms` against different tables.
  `[filterSchema]` was rejected by the DSL validator and accepted by codegen;
  `[filter-schema]` was the reverse.

The rule:

> Every published contract is generated from the code that enforces it, and a
> gate fails when the committed artifact disagrees.

Same approach as the ADR index (ADR-075) and the API reference (ADR-065):
generate the pages a reader can't easily check for themselves.

---

## 2. Components

| Component | Owns | Path |
|---|---|---|
| `@seans-mfe/contracts` | Shared vocabulary: envelope type, exit codes, typed errors, platform capabilities, the Mesh table, slot grammar | `packages/contracts/src/` |
| `CommandResult<T>`, `EXIT_CODES` | The envelope every command emits and the codes it exits with | `contracts/src/envelope.ts` |
| `BaseCommand<T>` | Subclasses implement `runCommand()`, not `run()`. This is what makes the output type findable | `oclif-base/src/BaseCommand.ts` |
| `DSLManifestSchema` | The manifest language, in Zod | `dsl/src/schema.ts` |
| Input derivation | Flag and arg declarations to input schema; which commands are agent-facing | `src/oclif/schema-derivation.ts` |
| Output derivation | TypeScript type to JSON Schema; finds the `T` in `extends BaseCommand<T>` | `src/oclif/type-to-schema.ts` |
| Command-lane driver | Loads the oclif registry, runs both halves, writes or diffs each contract | `scripts/generate-schemas.ts` |
| Manifest-lane driver | Runs Zod's JSON Schema emitter over the manifest and composition schemas | `scripts/generate-dsl-schema.ts` |
| The artifacts | 20 command contracts, 2 document schemas. Committed, gated, never hand-edited | `schemas/` |
| The consumer | Turns each contract into an agent-callable tool | `src/mcp/tool-registry.ts` |

---

## 3. Two lanes

```
LANE A — command contract

  command class
  ├─ static flags / args ──► deriveInputSchema ───┐
  │                          (oclif registry)     ├──► schemas/<cmd>.json ──► MCP tool
  └─ extends BaseCommand<T> ► resolveCommandResultType
                              typeToJsonSchema ───┘
                              (TypeScript checker)

LANE B — manifest contract

                        ┌─► z.infer ─────────► the generator's typed manifest
  dsl/src/schema.ts ────┤
  (Zod)                 └─► z.toJSONSchema ──► manifest.schema.json ──► editor validation
                                                                   └──► manifest-fields.md
```

Lane A needs two mechanisms because a command's truth is split between the
registry and the type system. Lane B needs one because the manifest's truth is a
single Zod schema.

---

## 4. Lane A — the command contract

### 4.1 Which commands get a contract

Generation starts from `Config.load(REPO_ROOT)`, the same resolution the CLI
performs at startup. The catalogue can't describe a command set the CLI doesn't
have, because it asks the dispatcher rather than parsing source.

`selectCatalogCommands` applies four filters:

| Filter | Why |
|---|---|
| `!hidden` | oclif's own signal that a command isn't public |
| `!isAliasEntry` | oclif lists an alias as its own registry entry, identifiable only by its id appearing in its own `aliases` array. Without this, `adr:doctor` and `mfe:doctor` each produce a duplicate tool |
| `isFirstParty` | `seans-mfe-tool`, `@seans-mfe/*`, `@falese/*` |
| `!CATALOG_EXCLUDED` | Two entries, each with a written reason |

`CATALOG_EXCLUDED` has two lines. `mcp:serve` would advertise a tool that starts
another copy of the server the agent is talking to. `schemas` lists the
catalogue, which the agent gets from `tools/list`. `build:*` is not on the list;
its absence from the catalogue was the defect this module was written to fix.

### 4.2 Input half

Args first, since declaration order is argv order, then flags.

`TRANSPORT_OWNED` strips `json`, `interactive` and `cwd` from every input schema.
The MCP transport appends `--json` to every child invocation and the envelope
contract depends on it, so a caller setting it breaks the response. `cwd` is the
execution argument the registry injects on every tool, so it can't also arrive as
a flag.

`x-positional` records which properties are positional args and in what order. A
JSON object has no order and argv does, so the transport needs this to rebuild a
command line.

### 4.3 Output half

A result type is a TypeScript artifact. It doesn't exist at runtime, so this lane
runs the compiler rather than the command.

**Find the type.** `resolveCommandResultType` walks the source file's top-level
children for a default-exported class, then its `extends` clause, then the type
argument on `BaseCommand`:

```ts
export default class MfeValidate extends BaseCommand<MfeValidateResult> {
```

`checker.getTypeFromTypeNode(arg)` turns that node into a `ts.Type`. No type
argument yields `undefined`, which is a build failure (§4.5).

**Convert it.** The conversion is narrow on purpose. A type it can't express
becomes an open schema rather than a confident wrong one.

| TypeScript | JSON Schema | Note |
|---|---|---|
| `string`, `number`, `boolean`, `null` | the obvious | |
| `unknown`, `any` | `{}` | constrains nothing |
| `object` | `{type: 'object'}` | TS flags the bare keyword `NonPrimitive`, not `Object` |
| `'a' \| 'b'` | `enum` | |
| `string \| null` | `type: ['null','string']` | sorted, because TS doesn't guarantee union order and these files are byte-gated |
| `a?: string` | `string`, omitted from `required` | TS models this as `string \| undefined`; optionality belongs in `required` |
| union of object shapes | `{}` | would need `oneOf`; no command result uses one |

Recursion is bounded by `MAX_DEPTH = 12` and a `seen` set.

**Lift the prose.** For every property:

```ts
const description = ts
  .displayPartsToString(prop.getDocumentationComment(checker))
  .trim();
if (description) schema.description = description;
```

The JSDoc explaining a field to a human reading the TypeScript becomes the
description an agent reads when deciding whether to call the tool. There's no
second place to update.

**Inherit.** `getPropertiesOfType` flattens inheritance, so fields from
`MutatingResult` land in the schema alongside the command's own.

**Close carefully.** `additionalProperties: false` makes a future undeclared
field fail loudly. But `additionalPropertiesFor` checks for a string index
signature first:

```ts
const indexInfo = checker.getIndexInfoOfType(type, ts.IndexKind.String);
if (!indexInfo) return false;
```

A type declaring `[key: string]: unknown` says extra keys are legal. Closing it
anyway publishes a schema stricter than the type it describes, which is how
`bff:validate`'s `manifest` came to be rejected by its own contract.

### 4.4 One pinned compiler option

`deriveOutputSchemas` builds its `ts.Program` from the repo `tsconfig.json` and
overrides three options. `noEmit` and `skipLibCheck` are housekeeping. The third
is not:

```ts
strictNullChecks: true,
```

It's redundant now that the repo compiles strict. It wasn't when written: under
`strict: false`, `string | null` collapses to `string`, and the schema claimed
`EnvCheckResult.found` was always a string while `build:check` returns `null` for
a missing tool. Pinning it means the contract doesn't depend on an unrelated
config file.

### 4.5 Two loud failures

**No derivable output type throws.** The driver's message names the two fixes:
give the command a typed result, or exclude it with a reason. Emitting `{}` would
publish a contract that promises nothing.

**Filenames must round-trip.** `topic:command` becomes `topic-command.json`, and
every consumer recovers the id by turning each `-` back into a `:`. So a hyphen
in a command id is ambiguous: `control-plane:build` comes back as
`control:plane:build`, matching no command and failing three unrelated suites
without naming the cause. `schemaFilename` throws instead.

**Orphans are removed.** A schema whose command no longer exists keeps
advertising a tool that can't run.

---

## 5. Lane B — the manifest contract

Zod does the work. One schema feeds two consumers:

`z.infer` gives the compiler `DSLManifest`. It's inferred, never declared
alongside, so there's no second definition to drift.

`z.toJSONSchema` gives the artifact. One option matters:

```ts
z.toJSONSchema(DSLManifestSchema, {
  target: 'draft-2020-12',
  unrepresentable: 'any',
})
```

`framework` and `bundler` are `z.string().min(1)` rather than enums (ADR-036),
and authorization is deferred (ADR-007). `unrepresentable: 'any'` renders those
permissively instead of failing generation.

The field reference is generated from the generated JSON Schema, not from the Zod
source. Descriptions come from `.describe()` calls on the Zod fields, so one
sentence serves the schema, the editor tooltip and the reference page.

---

## 6. What an agent sees

The local MCP source walks `schemas/` and turns each file into a tool:
`bff-init.json` becomes `mfe:bff:init`, with `schema.input` as the
`inputSchema`.

It filters on the presence of an `input` key. `schemas/` holds command contracts
and standalone document schemas like `manifest.schema.json`; only the first kind
maps to a runnable command, so only the first kind becomes a tool.

`loadToolRegistry` merges local, plugin and remote sources and aborts startup on
a name collision rather than letting one source shadow another.

Every tool accepts a reserved `cwd` injected by the registry, which is why `cwd`
is in `TRANSPORT_OWNED` (§4.2). Those two are in different packages and agree
because one is written as the reason for the other.

---

## 7. Gates

| Gate | Catches |
|---|---|
| `npm run build` then `git diff --exit-code schemas/` | Committed command contracts disagreeing with a fresh generation |
| `build:schema:dsl:check` | A stale manifest schema. `providesSlots` shipped and was missing from the artifact for months because this check existed but wasn't wired in (ADR-073 §6) |
| `build:manifest-reference:check` | A stale field reference |
| `build:docs` + `git diff docs/api` | A stale TypeDoc reference (ADR-065) |
| `output-schema-conformance.test.ts` | What commands actually return, validated with ajv against what they publish |
| `command-conformance.test.ts` | Every catalogued command either exercised or excluded with a reason |

The conformance test looks redundant. Output schemas come from the declared type
and TypeScript enforces that a command returns it, so what's left? Its header:
*"a belt over the compiler's braces."* It catches what the type system can't see
— a runtime `as` cast, a hand-built object literal escaping the declared type, a
field added by a helper.

The command lane is gated by write-then-diff; the other lanes use a `--check`
mode. Both work. `--check` gives a better message.

---

## 8. What this catches, and what it doesn't

The chain is:

```
implementation  →  declared type T  →  published schema  →  agent tool
```

TypeScript enforces the first link, generation produces the second and third, and
a gate holds the committed artifact to it. No runtime validation anywhere. A
published contract can't describe a shape the code doesn't produce.

It can still describe that shape in a sentence that's wrong.

> ADR-089 redefined `--force` from *does nothing* to *replaces developer-owned
> files*. One command's flag description stayed `'Overwrite existing files'`.
> The pipeline republished that sentence into the published schema on every
> build, for months, where an agent read it as the tool's documentation. The
> schema matched the code. The sentence in it was wrong.

A person caught it, reading the string against the ADR that superseded it. No
gate here can do that, because every gate compares an artifact to a source, and
the source was the thing that was wrong.

So: this removes transcription error and does nothing about authoring error. The
second is now the only kind left, which makes it easier to find and easier to
overlook.

A second case, found while writing this page. The header of
`schema-derivation.ts` claimed *"Output schemas stay hand-authored: a command's
TypeScript result type is not introspectable at runtime."* That stopped being
true when `type-to-schema.ts` landed. Nothing generates a module comment and
nothing gates one.

---

## 9. Working with it

**Adding a command.** Declare `extends BaseCommand<TResult>` with a real result
interface. Run `npm run build:schemas`. If it throws *"No output schema"*, the
source file wasn't found by convention (`topic:cmd` → `src/commands/topic/cmd.ts`)
or the class has no type argument. Commit the generated file.

**Changing a result type.** Add the field with a JSDoc; that comment becomes its
published description. Regenerate and commit.

**Changing a flag's help text.** This is a contract change. It reaches the
published schema and the agent-facing tool description. Regenerate and commit.

**Changing the manifest language.** Edit the Zod schema including its
`.describe()`. Run `build:schema:dsl` and `build:manifest-reference`, commit both.

**Don't hand-edit** anything under `schemas/`, `docs/api`, or
`docs/schemas/manifest-fields.md`. Each has a generated-file header and a gate.

---

## Related

- [`cli-contract.md`](./cli-contract.md) — envelope shape and exit codes
- [`schemas/manifest-fields.md`](./schemas/manifest-fields.md) — generated field reference
- ADR-018 (envelope), ADR-019 and ADR-077 (schema derivation), ADR-065 (API
  reference), ADR-075 (generate-and-gate), ADR-036 (open `framework`/`bundler`)
