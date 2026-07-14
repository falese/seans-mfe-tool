# Getting Started — Zero to a Running MFE

**Status:** Informative onboarding guide. The fastest path from a clean checkout to a
running, federable MFE. Closes documentation gaps **G27/G29** (no documented zero-to-running
path) and establishes the onboarding baseline referenced by the
[Documentation KPI Framework](./platform-design-review/documentation-kpi-framework.md).

**Audience:** a new contributor or adopter who has cloned the repo and has Node ≥18 (and
optionally Bun for the fastest dev entry — ADR-020).

> Every command accepts `--json` for a machine-readable `CommandResult<T>` envelope and every
> mutating command accepts `--dry-run`. See the [CLI Contract](./cli-contract.md).

---

## 0. Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node | ≥18 | Published runtime |
| npm | bundled with Node | Install + scripts |
| Bun | latest (optional) | Dev entry, no transpile (`bin/dev.ts`) |
| Docker | optional | `build:docker` and example image builds |

## 1. Build the tool (once)

```bash
npm install
npm run build         # builds packages, compiles, generates the oclif manifest + schemas
```

You can now invoke the CLI three ways (`README.md:97–102`):

```bash
bun bin/dev.ts <cmd> [args]    # dev entry — Bun, no transpile, fastest feedback
./bin/run.js <cmd> [args]      # compiled entry
seans-mfe-tool <cmd> [args]    # when installed globally
```

The rest of this guide writes `seans-mfe-tool`; substitute `bun bin/dev.ts` while developing.

## 2. Scaffold a remote MFE

```bash
seans-mfe-tool remote:init my-feature --port 3001            # React + rspack (default)
# or:
seans-mfe-tool remote:init my-feature --framework angular    # Angular + webpack
```

This writes a project skeleton and a minimal `mfe-manifest.yaml`. `remote:init` resolves the
framework/bundler via `loadFrameworkPlugin()` — omit `--framework` and you get React + rspack
for back-compat (see [DSL Architecture](./architecture-dsl.md) §2).

## 3. Declare capabilities, then generate

Edit `mfe-manifest.yaml` to add capabilities (the platform contract surface — `load`,
`render`, etc., plus any domain capabilities). If the MFE contributes named layout
regions, declare those too:

```yaml
providesSlots:
  - id: main
    description: Primary content region
  - id: info
    description: Contextual information
```

Then scaffold source from the manifest:

```bash
cd my-feature
seans-mfe-tool remote:generate --dry-run    # preview what will be written
seans-mfe-tool remote:generate              # write feature stubs + platform/base-mfe + remote entry
```

Codegen is idempotent: your edits to `src/features/**` are developer-owned and survive
re-runs; the platform layer is regenerated. See
[Code Generation Architecture](./architecture-codegen.md) §4 for the ownership-marker
contract.

When `providesSlots` is present, generation also writes the manifest-backed slot
contract:

- React: `src/slots.tsx`, including the thin `DeclaredSlot` component.
- Angular: `src/slots.ts`, including the standalone `[smtDeclaredSlot]` directive.

Both variants validate local ids against the manifest and register them through the
host-provided `provideSlot(id, element | null)` callback. The host turns local ids into
stable addresses such as `my-feature/main`; see the [Slot Contract](./slot-contract.md).

## 4. Install and run

```bash
npm install
npm run dev
```

The remote serves at `http://localhost:3001` with `remoteEntry.js` at
`http://localhost:3001/remoteEntry.js` (`src/commands/remote/init.ts:84–85`). A shell can now
federate it.

## 5. Build for production / container

```bash
seans-mfe-tool build:prod       # production bundle
seans-mfe-tool build:docker     # hardened container image (ADR-044)
```

## 6. (Optional) Add a BFF

If your MFE needs data, declare a `data:` section in the manifest and generate the GraphQL
BFF (see [BFF Architecture](./architecture-bff.md)):

```bash
seans-mfe-tool bff:init --port 4000
seans-mfe-tool bff:dev
```

## What "done" looks like

- `remote:generate` reports the feature + platform files it wrote.
- `npm run dev` serves `remoteEntry.js` at the chosen port.
- Under `--json`, each command prints exactly one `CommandResult` line with `"ok":true`.

If a step fails, the envelope's `error.type` + exit code tells you why (validation = 64,
system = 69, …); see the [CLI Contract](./cli-contract.md) and, for runtime/lifecycle issues,
the [Runtime Operational Runbook](./platform-design-review/runtime-operational-runbook.md).

## Onboarding baseline (KPI)

This guide is the reference path for the **time-to-first-running-MFE** KPI. Day-0 baseline:
the path was previously **undocumented** (a new contributor had to read code to discover the
`init → edit manifest → generate → install → dev` sequence). With this guide the documented
path is **6 steps / 5 commands**. The KPI framework tracks measured time-to-first-MFE against
this baseline.

## Related

- [CLI Contract](./cli-contract.md)
- [DSL Architecture](./architecture-dsl.md) · [Code Generation](./architecture-codegen.md) · [BFF](./architecture-bff.md)
- [Slot Contract](./slot-contract.md)
- [ABC Kids end-to-end example](../examples/abc-kids/README.md)
- [Architecture: current state](./architecture-current-state.md)
</content>
