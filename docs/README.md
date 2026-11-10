# Documentation

Start with the row that matches what you are trying to do.

## Start here

| If you want to… | Read |
|---|---|
| Understand what the platform is and why | [System map](./system-map.html) · [project README](../README.md) |
| Get one MFE running | [Getting started](./getting-started.md) |
| See a whole fleet working | [ABC Kids](../examples/abc-kids/README.md) · [Meridian Station](../examples/meridian-station/README.md) |
| Know what is built and what is not | [Project status](./PROJECT-STATUS.md) |

## Reference

Pages marked *generated* are produced from the code and checked in CI. Trust them over prose.

| Topic | Page |
|---|---|
| The manifest, field by field | [Manifest field reference](./schemas/manifest-fields.md) (*generated*) · [DSL manifest schema](./schemas/dsl-manifest.md) |
| The ten capabilities and the lifecycle | [Platform contract](./PLATFORM-CONTRACT.md) (tables *generated*) |
| Command output, `--json`, exit codes | [CLI contract](./cli-contract.md) |
| Every command's input and output | [`schemas/`](../schemas/) (*generated*), or run `seans-mfe-tool schemas` |
| Package APIs | [`docs/api/`](./api/) (*generated*) |
| Schemas and how contracts reach runtime, plugins and agents | [Schema and contract architecture](./schema-contracts.md) |

## How it works

| Area | Page |
|---|---|
| Architecture, current state | [Current architecture](./architecture-current-state.md) |
| Runtime | [Runtime platform](./architecture-runtime-platform.md) · [Class hierarchy](./runtime-class-hierarchy.md) |
| Code generation | [Codegen](./architecture-codegen.md) · [DSL](./architecture-dsl.md) · [CLI schematics](./cli-architecture.html) |
| Data | [BFF](./architecture-bff.md) · [Query capability](./query-capability.md) |
| Composition | [Composition primer](./architecture-composition-primer.md) · [Slot contract](./slot-contract.md) · [Slot architecture](./slot-architecture.md) |
| Native builds | [Native targets](./native-targets.md) |

## Extending

| To add… | Read |
|---|---|
| A CLI command plugin | [Plugin contract](./PLUGIN-CONTRACT.md) |
| A framework or build target | [Framework plugin authoring](./framework-plugin-authoring.md) |

## Splitting a monolith (early)

[Runbook](./decompose-runbook.md) · [capture](./decompose-capture.md) · [analyze](./decompose-analyze.md) ·
[propose](./decompose-propose.md) · [workspace](./decompose-workspace.md) · [verify](./decompose-verify.md) ·
[flows](./flows.md)

## Security

[Security policy and known limits](../SECURITY.md) ·
[2026-11 security assessment](./reviews/2026-11-platform-readiness/D-security-assessment.md)

## Decisions and history

| What | Where |
|---|---|
| Architecture decisions | [ADR index](./spec.md#adr-index) (*generated*) · [`architecture-decisions/`](./architecture-decisions/) |
| Product decisions | [`product-decisions/`](./product-decisions/) |
| Reviews | [`reviews/`](./reviews/2026-11-platform-readiness/README.md) |
| Publishing this documentation site | [Docs site](./docs-site.md) |
| Superseded plans and reports | [`archive/`](./archive/README.md) |
