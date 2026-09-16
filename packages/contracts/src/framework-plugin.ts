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
  /**
   * Compiler diagnostic code where the toolchain emits one (`TS2339`). Lets an
   * agent look the failure up or match on it without parsing the message.
   */
  code?: string;
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

  /**
   * Which build this plugin produces for a manifest (ADR-097).
   *
   * `'web'` — the default — is the primary build, selected by the manifest's
   * `framework` field. Any other value names a key under `targets:`, a build
   * produced ALONGSIDE the primary one from the same capabilities (ADR-095).
   *
   * Concrete, not abstract, so a plugin written before secondary targets
   * existed keeps working unchanged.
   */
  readonly targetId: string = 'web';

  // ── Scaffold ────────────────────────────────────────────────────────

  /**
   * Default dev-server port.
   *
   * Optional since ADR-097: a target that is not served over HTTP has no port.
   * The web lane declares one; the Swift lane does not. Declared rather than
   * abstract: an optional abstract member still demands an implementation.
   */
  readonly defaultPort?: number;

  /** Directories to create on `remote:init`. */
  abstract readonly directoryStructure: string[];

  // ── Codegen ─────────────────────────────────────────────────────────

  /**
   * Register this plugin's contribution to code generation (ADR-097).
   *
   * ADR-092 §5 removed six scalar codegen getters from this class —
   * `getTemplateDir`, `getTemplateVars`, `getRuntimeImport`,
   * `getRuntimeClassName`, `getSourceExtension`, `getRuntimeDependencies` —
   * because every one was abstract, implemented twice, and called by nothing.
   * `getTemplateDir()` had rotted to a directory deleted in ADR-061 and its
   * test still passed, because it asserted the STRING and never that the
   * directory existed.
   *
   * It also said what the replacement would have to look like:
   *
   *   > the real extension point needs a template directory AND a file plan
   *   > together, not six scalar getters
   *
   * This is that member, and the generator is now able to receive it: ADR-093
   * made what is emitted a list of `FileSpec`s, and ADR-094 gave the generator
   * `FileContributor` — a template root the contributor owns plus the specs to
   * resolve against it. So one method with a real caller replaces six without
   * one.
   *
   * Implementations call `registerVariant()` (a primary build) or
   * `registerFileContributor()` (a secondary target) from `@seans-mfe/codegen`.
   * Typed as an optional no-arg method rather than returning a codegen type,
   * because `contracts` imports nothing first-party (ADR-061) and must not
   * learn codegen's vocabulary to declare this.
   *
   * Idempotent: both registries key by id, so calling it once per manifest in
   * a loop over a fleet is safe and is what the drift gate does.
   */
  registerCodegen?(): void;

  /** Test file extension, e.g. `'.test.tsx'`. */
  abstract getTestExtension(): string;

  /** Shared dependencies for Module Federation. Empty for non-MF targets. */
  abstract getSharedDependencies(manifest: unknown): SharedDep[];

  // ── Build ───────────────────────────────────────────────────────────

  /** Validate that the local environment has the required tools. */
  abstract checkEnvironment(): Promise<EnvCheckResult[]>;

  /**
   * Start the dev server.
   *
   * Optional since ADR-097 — meaningless for a target with no HTTP surface.
   * Absent rather than throwing, so a caller can tell from the type.
   */
  startDevServer?(
    manifest: unknown,
    opts: { port: number; cwd: string },
  ): Promise<DevServerHandle>;

  /** Run a production build with structured error output. */
  abstract buildProduction(
    manifest: unknown,
    opts: { cwd: string; outputDir: string },
  ): Promise<BuildResult>;

  // ── Docker ──────────────────────────────────────────────────────────

  /**
   * Return the Docker build strategy for this target.
   *
   * Optional since ADR-097. The shipped strategies serve a built bundle from
   * nginx, which a natively-linked target has no use for.
   */
  getDockerStrategy?(manifest: unknown): DockerStrategy;
}
