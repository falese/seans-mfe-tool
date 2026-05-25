---
id: 0071
title: Framework plugins — abstract BaseFrameworkPlugin with concrete implementations
status: Accepted
date: 2026-05-25
deciders: [sean]
enforcement: code (abstract class + oclif plugin packages)
supersedes: []
superseded-by: []
tags: [build, codegen, framework, bundler, plugin, oclif]
summary: Introduce an abstract `BaseFrameworkPlugin` class in core that defines the shape of framework-specific build, scaffold, and Docker concerns. Each framework is a concrete implementation (`ReactRspackPlugin`, `AngularWebpackPlugin`) in its own oclif plugin package. `remote:init` gains a `--framework` flag. UnifiedGenerator delegates to the resolved plugin. Follows the same abstract-base → concrete-implementation pattern as `BaseMFE → RemoteMFE / AngularRemoteMFE`.
rationale-summary: ADR-069's "branch in UnifiedGenerator" approach required 15+ fix commits for Angular. A custom `BuildAdapter` registry was rejected as over-engineering on top of oclif. A data-only config object was rejected because the core must own the build *logic* (dev server, Docker, env check) the same way `BaseMFE` owns lifecycle orchestration — concrete plugins implement the framework-specific parts. This mirrors the proven `BaseMFE` pattern already in the codebase.
long-form: true
---

# ADR-071: Framework plugins — abstract BaseFrameworkPlugin with concrete implementations

## Context and problem statement

ADR-069 added Angular support by forking template directories and branching in `UnifiedGenerator` with `if (isAngularWebpack)`. This required 15+ fix commits to stabilize. The branch-per-framework approach does not scale.

Two alternatives were considered and rejected:

1. **Custom `BuildAdapter` interface + `AdapterRegistry`** — over-engineers a dispatch system that duplicates what oclif already provides (plugin discovery, command registration, hooks).

2. **Data-only `FrameworkPlugin` config object** — the core reads fields from a config. But framework builds have real logic: Angular needs `ng serve` via `@angular-builders/custom-webpack` with specific environment setup; React needs `rspack serve` with HMR config. A data blob can't capture this. The core should own the *shape* of build operations (what methods exist, what they return); the plugin implements *how*.

The right pattern already exists in the codebase:

```
BaseMFE (abstract — core owns lifecycle shape + orchestration)
  └── RemoteMFE         (concrete — React implements doLoad, doRender, etc.)
  └── AngularRemoteMFE  (concrete — Angular implements doLoad, doRender, etc.)
```

The same principle applies to the build system.

## Decision

### 1. Abstract `BaseFrameworkPlugin` — core owns the shape

The core defines an abstract class in `packages/contracts/` (or `packages/oclif-base/`) that declares the methods every framework plugin must implement:

```typescript
// packages/contracts/src/framework-plugin.ts

import type { DSLManifest } from './schema';

export interface EnvCheckResult {
  tool: string;                   // e.g. 'node', 'ng', 'rspack'
  required: string;               // e.g. '>=18'
  found: string | null;
  ok: boolean;
  fix?: string;                   // e.g. 'npm i -g @angular/cli@17'
}

export interface SharedDep {
  name: string;
  singleton: boolean;
  requiredVersion: string;
  eager?: boolean;
  strictVersion?: boolean;
}

export interface DockerStrategy {
  builderImage: string;
  runtimeImage: string;
  buildCommands: string[];
  artifactPaths: string[];
  cmd: string[];
  needsCliBuilder: boolean;
  healthcheck?: string;
}

export interface BuildResult {
  success: boolean;
  artifacts: string[];
  duration_ms: number;
  warnings: string[];
  errors: BuildError[];
}

export interface BuildError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  category: 'syntax' | 'type' | 'dependency' | 'config' | 'runtime' | 'unknown';
  suggestion?: string;
}

export interface DevServerHandle {
  stop: () => Promise<void>;
  url: string;
}

export abstract class BaseFrameworkPlugin {
  /** Unique identifier: e.g. 'react-rspack', 'angular-webpack'. */
  abstract readonly id: string;

  /** Human-readable name for CLI output. */
  abstract readonly displayName: string;

  /** Framework name matching manifest field. */
  abstract readonly framework: string;

  /** Bundler name matching manifest field. */
  abstract readonly bundler: string;

  // ── Scaffold ──────────────────────────────────────────────────────

  /** Default port for this framework (e.g. 3001 for React, 3101 for Angular). */
  abstract readonly defaultPort: number;

  /** Directory structure to create on `remote:init`. */
  abstract readonly directoryStructure: string[];

  /** Runtime dependencies to seed in the manifest. */
  abstract getRuntimeDependencies(): Record<string, string>;

  // ── Codegen ───────────────────────────────────────────────────────

  /** Path to the EJS template directory for this framework. */
  abstract getTemplateDir(): string;

  /** Template variables specific to this framework, merged with base vars. */
  abstract getTemplateVars(manifest: DSLManifest): Record<string, unknown>;

  /** Runtime import path for generated MFE code. */
  abstract getRuntimeImport(): string;

  /** Runtime class name for generated MFE code. */
  abstract getRuntimeClassName(): string;

  /** Source file extension (e.g. '.tsx', '.ts'). */
  abstract getSourceExtension(): string;

  /** Test file extension (e.g. '.test.tsx', '.spec.ts'). */
  abstract getTestExtension(): string;

  /** Shared dependencies for Module Federation (or equivalent). */
  abstract getSharedDependencies(manifest: DSLManifest): SharedDep[];

  // ── Build ─────────────────────────────────────────────────────────

  /** Validate that the local environment has the required tools. */
  abstract checkEnvironment(): Promise<EnvCheckResult[]>;

  /** Start the dev server. */
  abstract startDevServer(manifest: DSLManifest, opts: {
    port: number;
    cwd: string;
  }): Promise<DevServerHandle>;

  /** Run a production build with structured error output. */
  abstract buildProduction(manifest: DSLManifest, opts: {
    cwd: string;
    outputDir: string;
  }): Promise<BuildResult>;

  // ── Docker ────────────────────────────────────────────────────────

  /** Return the Docker build strategy for this framework. */
  abstract getDockerStrategy(manifest: DSLManifest): DockerStrategy;
}
```

This mirrors `BaseMFE`:
- `BaseMFE` defines `abstract doLoad()`, `abstract doRender()`, etc. — the core orchestrates, the concrete class implements.
- `BaseFrameworkPlugin` defines `abstract startDevServer()`, `abstract buildProduction()`, etc. — the core commands orchestrate, the concrete plugin implements.

### 2. Concrete implementations — one oclif plugin package per framework

```
packages/
  framework-react/       → @seans-mfe/framework-react
    src/
      index.ts           → exports ReactRspackPlugin instance
      plugin.ts          → class ReactRspackPlugin extends BaseFrameworkPlugin
    templates/           → EJS templates (moved from src/codegen/templates/base-mfe/)
    package.json         → oclif plugin config

  framework-angular/     → @seans-mfe/framework-angular
    src/
      index.ts
      plugin.ts          → class AngularWebpackPlugin extends BaseFrameworkPlugin
    templates/           → EJS templates (moved from src/codegen/templates/base-mfe-angular/)
    package.json
```

Example concrete implementation:

```typescript
// packages/framework-react/src/plugin.ts

export class ReactRspackPlugin extends BaseFrameworkPlugin {
  readonly id = 'react-rspack';
  readonly displayName = 'React + rspack';
  readonly framework = 'react';
  readonly bundler = 'rspack';
  readonly defaultPort = 3001;
  readonly directoryStructure = ['src', 'src/features', 'public'];

  getRuntimeDependencies() {
    return { react: '^18.2.0', 'react-dom': '^18.2.0' };
  }

  getTemplateDir() {
    return path.join(__dirname, '../templates');
  }

  getRuntimeImport() {
    return '@seans-mfe-tool/runtime';
  }

  getRuntimeClassName() {
    return 'RemoteMFE';
  }

  getSourceExtension() { return '.tsx'; }
  getTestExtension()   { return '.test.tsx'; }

  getSharedDependencies() {
    return [
      { name: 'react', singleton: true, requiredVersion: '^18.2.0', eager: true },
      { name: 'react-dom', singleton: true, requiredVersion: '^18.2.0', eager: true },
    ];
  }

  async checkEnvironment() {
    return [
      await checkTool('node', '>=18.0.0'),
      await checkTool('npm', '>=9.0.0'),
      await checkTool('rspack', '>=0.5.0', 'npm i -g @rspack/cli'),
    ];
  }

  async startDevServer(manifest, { port, cwd }) {
    const proc = spawn('npx', ['rspack', 'serve', '--port', String(port)], { cwd });
    return { stop: () => kill(proc), url: `http://localhost:${port}` };
  }

  async buildProduction(manifest, { cwd, outputDir }) {
    return runBuild('npx rspack build --mode production', { cwd, outputDir });
  }

  getDockerStrategy() {
    return {
      builderImage: 'node:20-slim',
      runtimeImage: 'nginx:alpine',
      buildCommands: ['npm ci', 'npm run build'],
      artifactPaths: ['dist/'],
      cmd: ['nginx', '-g', 'daemon off;'],
      needsCliBuilder: false,
      healthcheck: 'wget -qO- http://127.0.0.1:80/ || exit 1',
    };
  }
}
```

### 3. Plugin resolution — `loadFrameworkPlugin()`

A thin utility in core:

```typescript
// src/framework/loader.ts

export function loadFrameworkPlugin(framework: string): BaseFrameworkPlugin {
  const packageName = `@seans-mfe/framework-${framework}`;
  try {
    const mod = require(packageName);
    const plugin = mod.frameworkPlugin ?? mod.default;
    if (!(plugin instanceof BaseFrameworkPlugin)) {
      throw new ValidationError(
        `${packageName} does not export a valid BaseFrameworkPlugin instance`,
        'framework', framework
      );
    }
    return plugin;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      throw new ValidationError(
        `Framework "${framework}" not available. Install it:\n` +
        `  seans-mfe-tool plugins:install ${packageName}`,
        'framework', framework
      );
    }
    throw err;
  }
}
```

No registry. No custom dispatch. `require()` + `instanceof` check. oclif's plugin system ensures the package is discoverable.

### 4. Unified `remote:init --framework <name>`

Replace `remote:init` + `remote:init-angular` with one command:

```bash
seans-mfe-tool remote:init my-mfe                      # React (default)
seans-mfe-tool remote:init my-mfe --framework angular   # Angular
seans-mfe-tool remote:init my-mfe --framework vue       # when @seans-mfe/framework-vue installed
```

The command:
1. Calls `loadFrameworkPlugin(flags.framework)`
2. Uses `plugin.defaultPort`, `plugin.directoryStructure`, `plugin.getRuntimeDependencies()` to scaffold
3. Writes `mfe-manifest.yaml` with `framework` and `bundler` from the plugin

`remote:init-angular` becomes a deprecated alias.

### 5. Core `build:*` commands — core orchestrates, plugin implements

```typescript
// src/commands/build/dev.ts (simplified)

class BuildDev extends BaseCommand<{ url: string }> {
  protected async runCommand() {
    const manifest = await loadManifest(flags.manifest);
    const plugin = loadFrameworkPlugin(manifest.framework ?? 'react');
    const port = flags.port ?? plugin.defaultPort;
    const handle = await plugin.startDevServer(manifest, { port, cwd: process.cwd() });
    return { url: handle.url };
  }
}
```

The pattern: core command reads manifest → loads plugin → calls abstract method → plugin's concrete implementation runs. Same as how `BaseMFE.load()` orchestrates the lifecycle and calls `this.doLoad()`.

### 6. UnifiedGenerator refactor

```typescript
// Before:
const isAngularWebpack = manifest.framework === 'angular' || manifest.bundler === 'webpack';
const templateDir = isAngularWebpack ? '../templates/base-mfe-angular' : '../templates/base-mfe';

// After:
const plugin = loadFrameworkPlugin(manifest.framework ?? 'react');
const templateDir = plugin.getTemplateDir();
const runtimeImport = plugin.getRuntimeImport();
const runtimeClassName = plugin.getRuntimeClassName();
const sourceExt = plugin.getSourceExtension();
const sharedDeps = plugin.getSharedDependencies(manifest);
```

All `isAngularWebpack` branches are eliminated. The generator becomes framework-agnostic.

### 7. Templates move into plugin packages

```
# Before:
src/codegen/templates/base-mfe/          → react-rspack templates
src/codegen/templates/base-mfe-angular/  → angular-webpack templates

# After:
packages/framework-react/templates/      → react-rspack templates
packages/framework-angular/templates/    → angular-webpack templates
```

Templates are still core-owned (in the monorepo), but co-located with the plugin that uses them.

## Alternatives considered

### A. Keep branching in UnifiedGenerator (ADR-069 status quo)

Add `if (isVueVite)` branches for each new framework. No new abstractions.

**Rejected:** Already required 15+ fix commits for one framework. Each new framework adds O(n) conditionals across a 975-line file.

### B. Custom `BuildAdapter` interface + `AdapterRegistry`

A standalone registry that maps `framework-bundler` keys to adapter instances. Adapters implement a typed interface.

**Rejected:** Reinvents what oclif already does. Adds a parallel plugin system on top of oclif's existing plugin discovery. Over-engineering.

### C. Data-only config object

Each plugin exports a plain config object. The core reads fields and owns all logic.

**Rejected:** Framework builds have real logic that varies per framework. Angular's `ng serve` with `@angular-builders/custom-webpack` has fundamentally different setup and teardown than rspack's dev server. A data blob can't capture these differences without the core becoming a switch statement — which is the same problem we're solving.

### D. No abstract base — each plugin is standalone

Each plugin is a fully independent oclif plugin with its own commands (`react:build`, `angular:build`). No shared abstract class.

**Rejected:** Breaks the unified DX goal. `build:dev` should work regardless of framework. The abstract base ensures all plugins conform to the same contract so core commands can call them polymorphically.

## Consequences

### Positive

- **Mirrors the proven `BaseMFE` pattern.** The team already understands abstract-base → concrete-implementation. Same mental model for builds.
- **Adding a framework is additive.** Create a new package, extend `BaseFrameworkPlugin`, implement the abstract methods, export an instance. No changes to core commands or UnifiedGenerator.
- **oclif-native.** No custom registry. Plugin discovery via `require()` + oclif plugin system.
- **Polymorphic core commands.** `build:dev`, `build:prod`, `build:docker`, `build:check` work for any framework without branching.
- **`--framework` flag enables multi-target scaffolding.** Same domain capabilities deployed across React and Angular from one manifest.
- **Type-safe contract.** The abstract class enforces that every plugin implements every method. TypeScript catches missing implementations at compile time.

### Tradeoffs

- **Abstract class in `@seans-mfe/contracts`.** Adds a non-trivial type to the contracts package. This is the stability commitment — breaking changes to `BaseFrameworkPlugin` affect all plugins.
- **Two new workspace packages** (`framework-react`, `framework-angular`). Follows the existing pattern (`contracts`, `oclif-base`, `bff-plugin`) but grows the monorepo.
- **Template cross-cutting changes still per-variant.** Each framework plugin owns its templates independently. A future EJS partial system could address shared concerns (e.g. BFF block, CORS headers).
- **`require()` for plugin lookup** is not pure oclif. oclif discovers commands, not arbitrary exports. `loadFrameworkPlugin()` is a thin utility that bridges this gap.

### Out of scope

- **Swift/Kotlin native targets.** Separate effort with its own ADR for the native lifecycle contract. `BaseFrameworkPlugin` is designed to accommodate them when the time comes.
- **EJS template partial system.**
- **Schema evolution** (opening `FrameworkSchema`/`BundlerSchema` to arbitrary strings). Deferred to Phase 4.
- **Framework-specific oclif commands.** If a framework plugin needs custom commands (e.g. `angular:migrate`), it can add them as standard oclif commands in its package — but that's opt-in, not required by the contract.

## References

- ADR-069 — Pluggable bundler + framework via codegen variants (predecessor)
- ADR-070 — Docker + Turborepo integration
- `BaseMFE` at `src/runtime/base-mfe.ts` — the abstract base pattern this ADR mirrors
- #167 — Build Adapter System epic
