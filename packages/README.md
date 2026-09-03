# `packages/` — what each one is, and the order to read them

The CLI itself is **not** here. It lives at [`src/`](../src) (oclif commands, hooks, the MCP
server), and everything in this directory is a library it composes. `bin/run.js` → `src/` is the
tool; `packages/` is what the tool is made of.

## Read in this order

The list is a reading order, not an alphabetical one. Each entry assumes the ones above it.

| # | Package | What it is | Start at |
|---|---------|-----------|----------|
| 1 | **contracts** | The platform contract: ten capabilities, the six-state lifecycle machine and its transition table, typed errors, the `CommandResult` envelope, the slot grammar, the control-plane message protocol. **Zero dependencies, by invariant.** | `src/platform-contract.ts` |
| 2 | **dsl** | The manifest language — Zod schema, parser, validator — plus the control-plane composition schema and compiler. Everything a `mfe-manifest.yaml` is allowed to say. | `src/schema.ts` |
| 3 | **runtime** | What a generated MFE extends: `BaseMFE` (lifecycle orchestration, hook execution, handler dispatch), `RemoteMFE`/`AngularRemoteMFE`, the layout manager, the control-plane client. | `src/base-mfe.ts` |
| 4 | **codegen** | Manifest → files. One pipeline: validate → plan → render → emit. Owns which files a generated MFE gets and, through `overwrite`, which ones it owns forever. | `src/unified-generator.ts` |
| 5 | **oclif-base** | `BaseCommand` — the JSON envelope, the stdout/stderr split, typed exit codes. Every CLI command and every plugin command extends it. | `src/BaseCommand.ts` |
| 6 | **framework-react**, **framework-angular** | Framework adapters. Build, scaffold and Docker behaviour per framework, plus the slot sugar generated code imports. Adding a framework means adding one of these. | `src/plugin.ts` |
| 7 | **plugin-bff** | The BFF commands (`bff:init/validate/build/dev`) as an oclif plugin. The worked example for [`docs/PLUGIN-CONTRACT.md`](../docs/PLUGIN-CONTRACT.md). | `src/commands/` |
| 8 | **plugin-api** | OpenAPI → Express + Sequelize backend generation (`api:*`), as a plugin rather than a third of `src/` (ADR-063). The largest single thing that is *not* the CLI. | `src/commands/api.ts` |
| 9 | **plugin-adr** | The decision-record tooling (`adr:*`) and the governance gates behind `check:adr` / `build:adr-index` (ADR-075). Governs the repo; is not part of the platform contract. | `src/commands/` |
| 10 | **plugin-coder** | The coder seam (`coder:compile`): the intent-compilation contract and the DSL eval oracle, wrapping the external coder model service out-of-process (ADR-085/ADR-088). The model engine stays external `@falese/coder`. | `src/commands/coder/compile.ts` |
| 11 | **sentinel** | The reusable governance+generation kernel: the four ports (`validate` / `locateArtifacts` / `materialize` / `HardenedCheck`) and the deterministic `verify` floor. Host-agnostic — imports nothing `@seans-mfe/*`, deliberately unscoped so it extracts to its own repo mechanically (PDR-010, ADR-089). SMT's adapters live in `src/sentinel/`. | `src/index.ts` |
| — | **control-plane** | **Not a TypeScript library and not a workspace member.** Two Dockerised JavaScript services — `daemon/` and `registry/` — each with its own `package.json` and `Dockerfile`. It is under `packages/` because it ships with the platform (PDR-008, ADR-078), not because it compiles with the rest. | `README.md` |

## The layering is one-way

```
contracts ──────────────────────────────►  (imports nothing first-party)
    ▲   ▲   ▲   ▲
    │   │   │   └── oclif-base, framework-react, framework-angular
    │   │   └────── dsl
    │   └────────── runtime      → contracts, dsl
    └────────────── codegen      → contracts, dsl
                    plugin-bff   → contracts, codegen, oclif-base
                    plugin-api   → contracts, oclif-base
                    plugin-adr   → contracts, oclif-base
                    plugin-coder → contracts, dsl, oclif-base
```

`contracts` depending on nothing is the invariant the rest rests on (ADR-061, ADR-080): it is
what lets the DSL (which needs zod), the runtime (which is staged into generated MFEs) and
codegen (build-time only) all share one definition of the platform without pulling each other
in.

This is enforced, not documented: [`src/__tests__/import-direction.test.ts`](../src/__tests__/import-direction.test.ts)
parses real import declarations and fails on any edge not in its allow-list. Adding a dependency
between packages means editing that list on purpose.

## Two different things are called "plugin"

They load by different mechanisms, and conflating them is the most likely early stumble:

- **oclif command plugins** (`plugin-bff`, `plugin-api`, `plugin-adr`, `plugin-coder`) add *commands* to the CLI. Registered in the root
  `package.json` under `oclif.plugins`, resolved by oclif at startup. Contract:
  [`docs/PLUGIN-CONTRACT.md`](../docs/PLUGIN-CONTRACT.md).
- **framework plugins** (`framework-react`, `framework-angular`) add *build and scaffold
  behaviour* for a framework. Resolved at runtime by `loadFrameworkPlugin()` from the manifest's
  `framework` field (ADR-036). Guide:
  [`docs/framework-plugin-authoring.md`](../docs/framework-plugin-authoring.md).

## Namespaces

`@seans-mfe/*` is first-party; `@falese/*` is third-party (ADR-021).

One package does not follow that rule: **`runtime` publishes as `@seans-mfe-tool/runtime`**,
not `@seans-mfe/runtime` as ADR-021's own table lists it. It is the one name that is hard to
change — every generated MFE imports it and every example's `package.json` declares it — so
renaming it is a platform migration (ADR-082), not a rename. Tracked in
[#362](https://github.com/falese/seans-mfe-tool/issues/362); recorded here so the next reader
finds the discrepancy explained rather than surprising.

The rows above are checked against `ls packages/` by
[`src/__tests__/packages-readme-covers-disk.test.ts`](../src/__tests__/packages-readme-covers-disk.test.ts).
This file is the entry point to the reading order, which makes it the worst place in the repo
for a stale name — it went stale about three plugin extractions in the same pull request that
made them, and a reviewer reading the README first and `ls` second is what found it.
