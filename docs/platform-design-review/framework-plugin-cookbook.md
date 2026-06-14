# Framework Plugin Cookbook

**Part of:** [Platform Design Review](./README.md) · DOCS-P2 (#221)
**Relationship:** This is the *recipe* companion to the reference [`framework-plugin-authoring.md`](../framework-plugin-authoring.md). The authoring guide explains the interface section-by-section; this cookbook gives task-oriented recipes, the compatibility matrix, and failure-mode guidance an operator/author hits in practice.
**Grounding:** ADR-036 (framework plugins), `packages/contracts/src/framework-plugin.ts` (the shape), `src/framework/loader.ts` (resolution).

> **Core principle (ADR-036).** *Core owns the shape; plugins own the how.* Adding a framework is publishing `@seans-mfe/framework-<name>` that extends `BaseFrameworkPlugin` — never editing the core to special-case a framework.

---

## What the contract requires

`BaseFrameworkPlugin` (`framework-plugin.ts:98–175`) is abstract. A plugin MUST provide:

**Identity & shape**
- `id`, `displayName`, `framework`, `bundler`, `defaultPort` (`:110–124`)
- `directoryStructure: string[]` — dirs created on `remote:init` (`:127`)

**Codegen inputs**
- `getRuntimeDependencies()`, `getTemplateDir()`, `getTemplateVars(manifest)` (`:130–138`)
- `getRuntimeImport()`, `getRuntimeClassName()` (`:141–144`)
- `getSourceExtension()`, `getTestExtension()` (`:147–150`)
- `getSharedDependencies(manifest)` — Module-Federation shared deps; empty for non-MF (`:153`)

**Build lifecycle** (called polymorphically by `build:check/dev/prod/docker`)
- `checkEnvironment(): Promise<EnvCheckResult[]>` (`:157`)
- `startDevServer(manifest, {port, cwd}): Promise<DevServerHandle>` (`:161–164`)
- `buildProduction(manifest, {cwd, outputDir}): Promise<BuildResult>` (`:168–171`)
- `getDockerStrategy(manifest): DockerStrategy` (`:175`)

---

## Recipe 1 — Add a new framework plugin (e.g. `vue-vite`)

1. **Scaffold the package** `@seans-mfe/framework-vue` (mirror `examples/plugin-skeleton/` and the `vue-vite` skeleton in the authoring guide §"Skeleton").
2. **Implement identity:** `framework = 'vue'`, `bundler = 'vite'`, `defaultPort`, `directoryStructure`.
3. **Wire codegen:** point `getTemplateDir()` at your EJS templates; return runtime import/class names so generated MFE code extends the right base.
4. **Implement build lifecycle:** `checkEnvironment` (verify the toolchain), `startDevServer`, `buildProduction` (return a structured `BuildResult` / `BuildError` with source locations), `getDockerStrategy`.
5. **Export** `frameworkPlugin` (or `default`) from the package entry — the loader reads `mod.frameworkPlugin ?? mod.default` (`loader.ts:64`, `:77`).
6. **Publish** `@seans-mfe/framework-vue`. No core change is required.

### How resolution finds your plugin

`loadFrameworkPlugin(framework)` (`loader.ts:51`):
1. **Built-in:** known dirs (`react`, `angular`) resolve from `packages/<dir>` relative to project root (`:61–64`).
2. **External:** otherwise `require('@seans-mfe/framework-<name>')` (`:52`, `:75–77`).
3. **Invalid/missing:** throws `ValidationError` (`:80`, `:93`) — the CLI surfaces it as a validation envelope (exit 64).

So once published and installed, `--framework vue` (or `framework: vue` in the manifest) just works.

---

## Recipe 2 — Use an unknown framework/bundler value safely

`FrameworkSchema` and `BundlerSchema` are `z.string().min(1)` — **not enums** (ADR-036, #181). Consequence:

- An unknown `framework`/`bundler` is **not** a validation error. It emits a **stderr warning** and proceeds.
- This is deliberate: it lets authors prototype a plugin before it's a "known" built-in.
- If no plugin resolves for that value, `loadFrameworkPlugin` throws `ValidationError` at the point of use — not at manifest parse time.

**Author guidance:** ship the plugin package first; then the warning is harmless and the build resolves.

---

## Recipe 3 — Docker builds that need the codegen templates

`DockerConfigFile.from` selects the COPY source (`framework-plugin.ts:36–43`):

- `from: 'context'` — file comes from the build context (the MFE repo).
- `from: 'cli-builder'` — file comes from the `seans-mfe-tool-cli` builder image, which bundles the codegen templates and `dist/runtime`.

Use `'cli-builder'` for anything generated/owned by the platform (runtime files, templates); use `'context'` for the app's own sources. `getDockerStrategy()` returns the `builderImage` + `buildCommands`.

> **Rebuild rule (CLAUDE.md):** after any `src/runtime/**` change, `npm run build && npm run docker:build:cli` — `dist/runtime` is baked into the CLI image and staged into MFEs. A stale image is the #1 cause of "works locally, fails in Docker."

---

## Compatibility matrix

| Framework | Bundler | Plugin package | Status | Notes |
|---|---|---|---|---|
| React | rspack | `@seans-mfe/framework-react` | ✅ Shipped | Reference implementation |
| Angular | webpack / @angular-builders | `@seans-mfe/framework-angular` | ✅ Shipped | `--legacy-peer-deps` in examples CI |
| Vue | vite | `@seans-mfe/framework-vue` | 📋 Example/planned | Cookbook Recipe 1; roadmap G10 |
| (other) | (other) | `@seans-mfe/framework-<name>` | Author-provided | Open schema; warns if unknown until plugin ships |

**Compatibility notes**
- The runtime **lifecycle contract is framework-agnostic** — a new framework is a new template variant + plugin, never a new lifecycle (CLAUDE.md "resolved decisions").
- Module Federation shared deps are plugin-supplied via `getSharedDependencies()`; non-MF delivery returns `[]`.
- Node ≥18 for the published CLI; Bun only for the dev entry.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `ValidationError: framework plugin not found` | Package not installed, or wrong name | Install `@seans-mfe/framework-<name>`; name must match the manifest `framework` |
| Plugin loads but exports nothing usable | Entry doesn't export `frameworkPlugin`/`default`, or not a `BaseFrameworkPlugin` instance | Export an instance; the brand `__frameworkPluginBrand` (`:105`) is the validity check |
| stderr warning about unknown framework | Open-schema value with no plugin yet | Ship/install the plugin; warning then clears |
| Docker build can't find runtime files | Used `from: 'context'` for platform-owned files, or stale CLI image | Use `from: 'cli-builder'`; rebuild the CLI image |

See also: the [MCP Integration Playbook](./mcp-integration-playbook.md) (plugins' commands are exposed as MCP tools) and [Contract Alignment Pass](./contract-alignment-pass.md).
