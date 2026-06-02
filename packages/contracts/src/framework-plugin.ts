/**
 * BaseFrameworkPlugin — abstract base for framework/bundler plugins (ADR-036).
 *
 * Mirrors the BaseMFE pattern: core owns the shape (abstract methods),
 * concrete plugins implement framework-specific behaviour.
 *
 * ```
 * BaseFrameworkPlugin (abstract)
 *   └── ReactRspackPlugin        (packages/framework-react)
 *   └── AngularWebpackPlugin     (packages/framework-angular)
 * ```
 */

// ── Supporting types ────────────────────────────────────────────────────

/** Result of a single environment check (tool presence + version). */
export interface EnvCheckResult {
  tool: string;
  required: string;
  found: string | null;
  ok: boolean;
  fix?: string;
}

/** Shared dependency declaration for Module Federation (or equivalent). */
export interface SharedDep {
  name: string;
  singleton: boolean;
  requiredVersion: string;
  eager?: boolean;
  strictVersion?: boolean;
}

/**
 * A file copied into the runtime stage of a generated Dockerfile.
 * `from` selects the COPY source: the build context, or the
 * `seans-mfe-tool-cli` builder image (which bundles the codegen templates).
 */
export interface DockerConfigFile {
  from: 'context' | 'cli-builder';
  src: string;
  dest: string;
}

/** Docker multi-stage build strategy. */
export interface DockerStrategy {
  builderImage: string;
  runtimeImage: string;
  buildCommands: string[];
  artifactPaths: string[];
  cmd: string[];
  needsCliBuilder: boolean;
  healthcheck?: string;
  /** Config files copied into the runtime stage (e.g. the nginx server block). */
  configFiles?: DockerConfigFile[];
  /** RUN commands executed in the runtime stage (e.g. non-root user setup). */
  runtimeSetup?: string[];
  /** Non-root user the runtime stage drops to via the USER directive. */
  user?: string;
  /** Port the runtime stage advertises via EXPOSE. */
  expose?: number;
}

/** Structured production build result. */
export interface BuildResult {
  success: boolean;
  artifacts: string[];
  duration_ms: number;
  warnings: string[];
  errors: BuildError[];
}

/** Classified build error with optional source location. */
export interface BuildError {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  category: 'syntax' | 'type' | 'dependency' | 'config' | 'runtime' | 'unknown';
  suggestion?: string;
}

/** Handle returned by startDevServer() for lifecycle control. */
export interface DevServerHandle {
  stop: () => Promise<void>;
  url: string;
}

// ── Abstract base ───────────────────────────────────────────────────────

/**
 * Abstract base class every framework plugin must extend.
 *
 * Core commands (`build:check`, `build:dev`, `build:prod`, `build:docker`)
 * call these methods polymorphically — same pattern as BaseMFE.load()
 * orchestrating this.doLoad().
 */
export abstract class BaseFrameworkPlugin {
  /**
   * Brand tag for cross-module instanceof checks.
   * When the same class is loaded from different physical paths
   * (e.g. npm link), `instanceof` fails because they are different
   * class objects.  This string brand lets us duck-type safely.
   */
  readonly __frameworkPluginBrand = '__BaseFrameworkPlugin__' as const;

  // ── Identity ────────────────────────────────────────────────────────

  /** Unique id, e.g. `'react-rspack'`, `'angular-webpack'`. */
  abstract readonly id: string;

  /** Human-readable name for CLI output. */
  abstract readonly displayName: string;

  /** Framework name matching the manifest `framework` field. */
  abstract readonly framework: string;

  /** Bundler name matching the manifest `bundler` field. */
  abstract readonly bundler: string;

  // ── Scaffold ────────────────────────────────────────────────────────

  /** Default port for dev server. */
  abstract readonly defaultPort: number;

  /** Directories to create on `remote:init`. */
  abstract readonly directoryStructure: string[];

  /** Runtime dependencies seeded into the manifest on init. */
  abstract getRuntimeDependencies(): Record<string, string>;

  // ── Codegen ─────────────────────────────────────────────────────────

  /** Absolute path to the EJS template directory. */
  abstract getTemplateDir(): string;

  /** Framework-specific template variables, merged with base vars. */
  abstract getTemplateVars(manifest: unknown): Record<string, unknown>;

  /** Runtime package import path for generated MFE code. */
  abstract getRuntimeImport(): string;

  /** Runtime class name for generated MFE code. */
  abstract getRuntimeClassName(): string;

  /** Source file extension, e.g. `'.tsx'`. */
  abstract getSourceExtension(): string;

  /** Test file extension, e.g. `'.test.tsx'`. */
  abstract getTestExtension(): string;

  /** Shared dependencies for Module Federation. Empty for non-MF targets. */
  abstract getSharedDependencies(manifest: unknown): SharedDep[];

  // ── Build ───────────────────────────────────────────────────────────

  /** Validate that the local environment has the required tools. */
  abstract checkEnvironment(): Promise<EnvCheckResult[]>;

  /** Start the dev server. */
  abstract startDevServer(
    manifest: unknown,
    opts: { port: number; cwd: string },
  ): Promise<DevServerHandle>;

  /** Run a production build with structured error output. */
  abstract buildProduction(
    manifest: unknown,
    opts: { cwd: string; outputDir: string },
  ): Promise<BuildResult>;

  // ── Docker ──────────────────────────────────────────────────────────

  /** Return the Docker build strategy for this framework. */
  abstract getDockerStrategy(manifest: unknown): DockerStrategy;
}
