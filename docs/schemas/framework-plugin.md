# Framework Plugin Interface

Source of truth: `packages/contracts/src/framework-plugin.ts`.

Refs: ADR-036 (open-string framework/bundler), ADR-034 (framework-agnostic codegen).

---

## Purpose

Every framework/bundler combination is delivered as a plugin that extends
`BaseFrameworkPlugin`. Core commands (`build:check`, `build:dev`, `build:prod`,
`build:docker`) call these abstract methods polymorphically — the same pattern as
`BaseMFE.load()` orchestrating `this.doLoad()`.

Adding support for a new framework means publishing a package (e.g.
`@seans-mfe/framework-vue`) that extends `BaseFrameworkPlugin`. No core code changes
are required.

**Concrete implementations:**

| Plugin | Package | `framework` | `bundler` |
|---|---|---|---|
| `ReactRspackPlugin` | `packages/framework-react` | `'react'` | `'rspack'` |
| `AngularWebpackPlugin` | `packages/framework-angular` | `'angular'` | `'webpack'` |

---

## BaseFrameworkPlugin

```typescript
abstract class BaseFrameworkPlugin {
  readonly __frameworkPluginBrand = '__BaseFrameworkPlugin__' as const;

  // Identity
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly framework: string;
  abstract readonly bundler: string;

  // Scaffold
  abstract readonly defaultPort: number;
  abstract readonly directoryStructure: string[];
  abstract getRuntimeDependencies(): Record<string, string>;

  // Codegen
  abstract getTemplateDir(): string;
  abstract getTemplateVars(manifest: unknown): Record<string, unknown>;
  abstract getRuntimeImport(): string;
  abstract getRuntimeClassName(): string;
  abstract getSourceExtension(): string;
  abstract getTestExtension(): string;
  abstract getSharedDependencies(manifest: unknown): SharedDep[];

  // Build
  abstract checkEnvironment(): Promise<EnvCheckResult[]>;
  abstract startDevServer(manifest: unknown, opts: { port: number; cwd: string }): Promise<DevServerHandle>;
  abstract buildProduction(manifest: unknown, opts: { cwd: string; outputDir: string }): Promise<BuildResult>;

  // Docker
  abstract getDockerStrategy(manifest: unknown): DockerStrategy;
}
```

### Identity properties

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique plugin id, e.g. `'react-rspack'`. Used as the registry key. |
| `displayName` | `string` | Human-readable name for CLI output. |
| `framework` | `string` | Framework name — must match the manifest `framework` field. |
| `bundler` | `string` | Bundler name — must match the manifest `bundler` field. |

### Scaffold properties and methods

| Member | Type | Description |
|---|---|---|
| `defaultPort` | `number` | Default dev server port (e.g. `3000` for React, `4200` for Angular). |
| `directoryStructure` | `string[]` | Directories to create on `remote:init` (relative to MFE root). |
| `getRuntimeDependencies()` | `Record<string, string>` | npm packages seeded into the MFE `package.json` on init. |

### Codegen methods

| Method | Return type | Description |
|---|---|---|
| `getTemplateDir()` | `string` | Absolute path to the EJS template directory for this plugin. |
| `getTemplateVars(manifest)` | `Record<string, unknown>` | Framework-specific template variables merged with base codegen vars. |
| `getRuntimeImport()` | `string` | Import path for the runtime class in generated MFE code (e.g. `'@seans-mfe/runtime/react'`). |
| `getRuntimeClassName()` | `string` | Class name for the generated MFE (e.g. `'RemoteMFE'`). |
| `getSourceExtension()` | `string` | Source file extension (e.g. `'.tsx'`, `'.ts'`). |
| `getTestExtension()` | `string` | Test file extension (e.g. `'.test.tsx'`). |
| `getSharedDependencies(manifest)` | `SharedDep[]` | Module Federation shared dependencies. Return `[]` for non-MF targets. |

### Build methods

| Method | Signature | Description |
|---|---|---|
| `checkEnvironment()` | `Promise<EnvCheckResult[]>` | Validate that required build tools are installed and meet version requirements. |
| `startDevServer(manifest, opts)` | `Promise<DevServerHandle>` | Start the dev server and return a handle for lifecycle control. |
| `buildProduction(manifest, opts)` | `Promise<BuildResult>` | Run a production build. Returns structured output including errors. |

### Docker method

| Method | Return type | Description |
|---|---|---|
| `getDockerStrategy(manifest)` | `DockerStrategy` | Return the multi-stage Docker build strategy for this framework. |

---

## Supporting types

### EnvCheckResult

Result of a single environment check (tool presence and version).

```typescript
interface EnvCheckResult {
  tool: string;         // tool name, e.g. 'node', 'rspack'
  required: string;     // required version or range
  found: string | null; // installed version, or null if not found
  ok: boolean;          // true when found meets required
  fix?: string;         // installation hint when ok is false
}
```

### SharedDep

Module Federation shared dependency declaration.

```typescript
interface SharedDep {
  name: string;
  singleton: boolean;
  requiredVersion: string;
  eager?: boolean;
  strictVersion?: boolean;
}
```

### DevServerHandle

Returned by `startDevServer()` for lifecycle control.

```typescript
interface DevServerHandle {
  stop: () => Promise<void>;
  url: string;
}
```

### BuildResult

Structured production build result.

```typescript
interface BuildResult {
  success: boolean;
  artifacts: string[];    // paths to generated output files
  duration_ms: number;
  warnings: string[];
  errors: BuildError[];
}
```

### BuildError

Classified build error with optional source location.

```typescript
interface BuildError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  category: 'syntax' | 'type' | 'dependency' | 'config' | 'runtime' | 'unknown';
  suggestion?: string;
}
```

### DockerStrategy

Multi-stage Docker build strategy returned by `getDockerStrategy()`.

```typescript
interface DockerStrategy {
  builderImage: string;          // Docker image for the build stage
  runtimeImage: string;          // Docker image for the runtime stage
  buildCommands: string[];       // RUN commands in the build stage
  artifactPaths: string[];       // paths COPY'd from build → runtime stage
  cmd: string[];                 // CMD directive for the runtime stage
  needsCliBuilder: boolean;      // true when codegen templates are needed from the CLI image
  healthcheck?: string;          // HEALTHCHECK instruction
  configFiles?: DockerConfigFile[];   // files copied into the runtime stage
  runtimeSetup?: string[];       // RUN commands in the runtime stage
  user?: string;                 // non-root USER directive
  expose?: number;               // EXPOSE port
}
```

### DockerConfigFile

A file copied into the runtime stage of the generated Dockerfile.

```typescript
interface DockerConfigFile {
  from: 'context' | 'cli-builder';   // copy source
  src: string;                        // source path
  dest: string;                       // destination path in the image
}
```

`from: 'cli-builder'` selects the `seans-mfe-tool-cli` builder image, which bundles
the codegen templates needed for runtime configuration files (e.g. nginx server blocks).

---

## Brand check

The `__frameworkPluginBrand` readonly property enables duck-type safety across module
boundaries. When the same class is loaded from different physical paths (e.g. via
`npm link`), `instanceof` fails because they are different class objects. Use this
string brand to identify framework plugins:

```typescript
function isFrameworkPlugin(value: unknown): value is BaseFrameworkPlugin {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__frameworkPluginBrand === '__BaseFrameworkPlugin__'
  );
}
```

---

## Authoring a new plugin

See `docs/framework-plugin-authoring.md` for the step-by-step guide to publishing a
`@seans-mfe/framework-<name>` package.
