# Framework Plugin Authoring Guide

This guide explains how to create a custom framework plugin for `seans-mfe-tool` by extending `BaseFrameworkPlugin`. Once published, your plugin is automatically discovered by `loadFrameworkPlugin()` and wired into `build:dev`, `build:prod`, `build:docker`, `build:check`, `remote:init`, and `deploy`.

**Governing ADR:** ADR-071  
**Type definitions:** `packages/contracts/src/framework-plugin.ts`  
**Reference implementation:** `packages/framework-react/src/plugin.ts`

---

## Overview

The plugin system separates _what to build_ (the framework/bundler combination) from _how the CLI orchestrates_ it. Each plugin:

- Describes its identity (`id`, `framework`, `bundler`)
- Provides scaffolding defaults (`defaultPort`, `directoryStructure`, `getRuntimeDependencies`)
- Generates codegen variables (`getTemplateVars`, `getSharedDependencies`)
- Implements the build lifecycle (`checkEnvironment`, `startDevServer`, `buildProduction`, `getDockerStrategy`)

---

## Naming convention

| Concept | Convention | Example |
|---|---|---|
| npm package | `@seans-mfe/framework-<name>` | `@seans-mfe/framework-vue` |
| Plugin `id` | `<framework>-<bundler>` | `vue-vite` |
| Named export | `frameworkPlugin` | `export const frameworkPlugin = new VueVitePlugin()` |

`loadFrameworkPlugin('vue')` resolves `@seans-mfe/framework-vue` and reads the `frameworkPlugin` export.

---

## Implementing `BaseFrameworkPlugin`

Import the abstract class from `@seans-mfe/contracts`:

```ts
import {
  BaseFrameworkPlugin,
  type EnvCheckResult,
  type SharedDep,
  type DockerStrategy,
  type BuildResult,
  type DevServerHandle,
} from '@seans-mfe/contracts';
```

Your class must implement every abstract member. Here is the full contract with the expected return type for each method:

### Identity

```ts
readonly id: string           // unique slug, e.g. 'vue-vite'
readonly displayName: string  // human label, e.g. 'Vue 3 + Vite'
readonly framework: string    // manifest 'framework' field, e.g. 'vue'
readonly bundler: string      // manifest 'bundler' field, e.g. 'vite'
```

### Scaffolding

```ts
readonly defaultPort: number              // default dev server port
readonly directoryStructure: string[]     // dirs created by remote:init

getRuntimeDependencies(): Record<string, string>
// Returns { '<pkg>': '<semver>' } seeded into mfe-manifest.yaml on init.
```

### Codegen

```ts
getTemplateDir(): string
// Absolute path to the EJS template directory. Must exist at runtime.
// Convention: path.resolve(__dirname, '../../..', 'src/codegen/templates/base-mfe-<name>')

getTemplateVars(manifest: unknown): Record<string, unknown>
// Extra variables merged into EJS rendering context.

getRuntimeImport(): string     // e.g. '@seans-mfe-tool/runtime'
getRuntimeClassName(): string  // e.g. 'RemoteMFE'
getSourceExtension(): string   // e.g. '.tsx'
getTestExtension(): string     // e.g. '.test.tsx'

getSharedDependencies(manifest: unknown): SharedDep[]
// Module Federation singleton declarations. Return [] for non-MF targets.
// SharedDep: { name, singleton, requiredVersion, eager?, strictVersion? }
```

### Build lifecycle

```ts
checkEnvironment(): Promise<EnvCheckResult[]>
// One EnvCheckResult per required tool: { tool, required, found, ok, fix? }
// 'ok: false' causes build:check to exit non-zero.

startDevServer(manifest: unknown, opts: { port: number; cwd: string }): Promise<DevServerHandle>
// Start the dev server and return a handle. Block until stop() is called.
// DevServerHandle: { url: string; stop: () => Promise<void> }

buildProduction(manifest: unknown, opts: { cwd: string; outputDir: string }): Promise<BuildResult>
// Run the production build. Never throw — return success:false with errors[] instead.
// BuildResult: { success, artifacts, duration_ms, warnings, errors: BuildError[] }

getDockerStrategy(manifest: unknown): DockerStrategy
// Describe the multi-stage Docker build.
// DockerStrategy: { builderImage, runtimeImage, buildCommands, artifactPaths, cmd,
//                   needsCliBuilder, healthcheck? }
// Set needsCliBuilder:true if your MFE uses @seans-mfe-tool/runtime (virtually all do).
```

---

## Skeleton — `vue-vite` plugin

```ts
// packages/framework-vue/src/plugin.ts
import * as path from 'path';
import { execSync } from 'child_process';
import {
  BaseFrameworkPlugin,
  type EnvCheckResult,
  type SharedDep,
  type DockerStrategy,
  type BuildResult,
  type DevServerHandle,
} from '@seans-mfe/contracts';

export class VueVitePlugin extends BaseFrameworkPlugin {
  readonly id = 'vue-vite';
  readonly displayName = 'Vue 3 + Vite';
  readonly framework = 'vue';
  readonly bundler = 'vite';
  readonly defaultPort = 3201;
  readonly directoryStructure = ['src', 'src/features', 'public'];

  getRuntimeDependencies() {
    return { 'vue': '^3.4.0' };
  }

  getTemplateDir() {
    return path.resolve(__dirname, '../../..', 'src/codegen/templates/base-mfe-vue');
  }

  getTemplateVars(_manifest: unknown) {
    return { framework: 'vue', bundler: 'vite', templateVariant: 'vue-vite' };
  }

  getRuntimeImport() { return '@seans-mfe-tool/runtime'; }
  getRuntimeClassName() { return 'RemoteMFE'; }
  getSourceExtension() { return '.vue'; }
  getTestExtension() { return '.test.ts'; }

  getSharedDependencies(_manifest: unknown): SharedDep[] {
    return [{ name: 'vue', singleton: true, requiredVersion: '^3.4.0', eager: true }];
  }

  async checkEnvironment(): Promise<EnvCheckResult[]> {
    try {
      const v = execSync('node --version', { encoding: 'utf8' }).trim().replace(/^v/, '');
      return [{ tool: 'node', required: '>=18', found: v, ok: parseInt(v) >= 18 }];
    } catch {
      return [{ tool: 'node', required: '>=18', found: null, ok: false, fix: 'https://nodejs.org' }];
    }
  }

  async startDevServer(_manifest: unknown, opts: { port: number; cwd: string }): Promise<DevServerHandle> {
    const { spawn } = await import('child_process');
    const proc = spawn('npx', ['vite', '--port', String(opts.port)], {
      cwd: opts.cwd, stdio: 'inherit', shell: true,
    });
    return {
      url: `http://localhost:${opts.port}`,
      stop: () => new Promise<void>((resolve) => {
        proc.on('close', () => resolve());
        proc.kill('SIGTERM');
      }),
    };
  }

  async buildProduction(_manifest: unknown, opts: { cwd: string; outputDir: string }): Promise<BuildResult> {
    const start = Date.now();
    try {
      execSync('npx vite build', { cwd: opts.cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      return { success: true, artifacts: [opts.outputDir], duration_ms: Date.now() - start, warnings: [], errors: [] };
    } catch (err: unknown) {
      return {
        success: false, artifacts: [], duration_ms: Date.now() - start, warnings: [],
        errors: [{ message: (err as { stderr?: string }).stderr ?? String(err), category: 'unknown' }],
      };
    }
  }

  getDockerStrategy(_manifest: unknown): DockerStrategy {
    return {
      builderImage: 'node:20-slim',
      runtimeImage: 'nginx:alpine',
      buildCommands: ['npm ci', 'npm run build'],
      artifactPaths: ['dist/'],
      cmd: ['nginx', '-g', 'daemon off;'],
      needsCliBuilder: true,
      healthcheck: 'wget -qO- http://127.0.0.1:80/ || exit 1',
    };
  }
}

export const frameworkPlugin = new VueVitePlugin();
```

---

## Package structure

```
@seans-mfe/framework-vue/
├── src/
│   ├── plugin.ts          # VueVitePlugin class + frameworkPlugin export
│   └── index.ts           # re-exports plugin.ts
├── src/codegen/templates/
│   └── base-mfe-vue/      # EJS templates (rspack.config.js.ejs, package.json.ejs, …)
├── package.json
└── tsconfig.json
```

**`package.json` required fields:**

```json
{
  "name": "@seans-mfe/framework-vue",
  "main": "./dist/index.js",
  "exports": {
    ".": { "require": "./dist/index.js", "import": "./dist/index.mjs" }
  },
  "peerDependencies": {
    "@seans-mfe/contracts": ">=0.1.0"
  }
}
```

**`index.ts`:**

```ts
export { VueVitePlugin, frameworkPlugin } from './plugin';
```

The `frameworkPlugin` named export is **required** — `loadFrameworkPlugin()` reads `mod.frameworkPlugin`.

---

## Template directory

`getTemplateDir()` must return an absolute path to a directory of EJS templates. The built-in templates at `src/codegen/templates/base-mfe/` (React) and `src/codegen/templates/base-mfe-angular/` (Angular) are good references.

Minimum template files for a remote MFE:

```
base-mfe-vue/
├── package.json.ejs       # project dependencies
├── vite.config.js.ejs     # bundler + Module Federation config
├── mfe.ts.ejs             # BaseMFE subclass
├── mfe.test.ts.ejs        # unit test stub
└── features/
    ├── index.ts.ejs
    └── remote.vue.ejs     # exposed component
```

Available template variables (always present):

| Variable | Source |
|---|---|
| `name` | MFE name |
| `port` | resolved port |
| `framework` | `plugin.framework` |
| `bundler` | `plugin.bundler` |
| `templateVariant` | `plugin.id` |
| `...getTemplateVars(manifest)` | your plugin |

---

## Publishing

1. Build the package: `tsc`
2. `npm publish --access public`
3. Users install: `npm install @seans-mfe/framework-vue`
4. Users run: `seans-mfe-tool remote:init my-mfe --framework vue`

`loadFrameworkPlugin('vue')` will resolve `@seans-mfe/framework-vue` automatically.

---

## Reference

- **ADR-071** — `docs/architecture-decisions/ADR-071-*.md`
- **Type definitions** — `packages/contracts/src/framework-plugin.ts`
- **React reference impl** — `packages/framework-react/src/plugin.ts`
- **Angular reference impl** — `packages/framework-angular/src/plugin.ts`
- **Plugin loader** — `src/framework/loader.ts`
