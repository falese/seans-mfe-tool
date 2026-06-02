/**
 * Unified MFE Codegen Generator
 * Consolidates feature/component and platform/BFF codegen
 * Implements ADR-014, REQ-REMOTE-003, ADR-027
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import ejs from 'ejs';
import type { DSLManifest, CapabilityConfig, CapabilityEntry } from '../../dsl/schema';
import { loadFrameworkPlugin } from '../../framework/loader';

export interface GeneratedFile {
  path: string;
  content: string;
  overwrite: boolean;
}

// =============================================================================
// Dependency Version Constants (ADR-027)
// =============================================================================

/**
 * Centralized dependency versions for template generation
 * Following e2e2 dependency resolution (2025-12-06)
 * Based on GraphQL Mesh v0.100.x stable releases
 */
export const DEPENDENCY_VERSIONS = {
  // GraphQL Mesh (BFF Layer)
  graphqlMesh: {
    cli: '^0.100.21',
    openapi: '^0.109.26',
    serveRuntime: '^1.2.4',
  },

  // GraphQL Tools (Peer Dependencies)
  graphqlTools: {
    delegate: '^10.2.4',
    utils: '^9.2.1',
    wrap: '^10.0.5',
  },

  // Mesh Plugins (Production Features)
  meshPlugins: {
    responseCache: '^0.104.20',
    prometheus: '^2.1.8',
    opentelemetry: '^1.3.67',
  },

  // Mesh Transforms (Schema Manipulation)
  // NOTE: these track the Mesh v0.10x line — NOT ^1.0.0. A legacy 1.0.0 is
  // published for several of these but predates and is incompatible with
  // @graphql-mesh/cli@0.100.x (verified in the demo-mode trial, ADR-052).
  meshTransforms: {
    namingConvention: '^0.105.19',
    rateLimit: '^0.105.38',
    filterSchema: '^0.104.37',
    resolversComposition: '^0.104.36',
    cache: '^0.105.37',
  },

  // Core Dependencies
  core: {
    graphql: '^16.8.1',
    express: '^4.18.2',
    cors: '^2.8.5',
    helmet: '^8.1.0',
    tslib: '^2.6.0',
  },

  // React (Module Federation - Singleton)
  react: {
    react: '~18.2.0',
    reactDom: '~18.2.0',
  },

  // MUI (Design System)
  mui: {
    material: '^5.14.0',
    system: '^5.14.0',
    emotionReact: '^11.11.1',
    emotionStyled: '^11.11.0',
  },

  // Build Tools
  buildTools: {
    rspackCli: '^1.7.0',
    rspackCore: '^1.7.0',
    typescript: '^5.3.3',
    tsNode: '^10.9.1',
    concurrently: '^8.2.0',
    serve: '^14.2.1',
    tsJest: '^29.2.0',
    jestEnvJsdom: '^29.7.0',
    typesJest: '^29.5.0',
    jest: '^29.7.0',
    eslint: '^8.55.0',
    supertest: '^6.3.3',
  },

  // Type definitions (shared across React and Angular templates)
  types: {
    cors: '^2.8.17',
    express: '^4.17.21',
    node: '^20.10.0',
    react: '^18.0.28',
    reactDom: '^18.0.11',
  },

  // React Testing Library
  testingLibrary: {
    react: '^14.0.0',
    jestDom: '^6.4.0',
    userEvent: '^14.5.0',
  },

  // Angular 19+ (Module Federation - Singleton + strictVersion)
  // Upgraded from ^17.0.0 to ^19.2.16 to resolve five HIGH severity XSS CVEs:
  //   GHSA-58c5-g7wp-6w37, GHSA-v4hv-rgfq-gp49, GHSA-g93w-mfhg-p222,
  //   GHSA-prjf-86w9-mfqv (all @angular/common, fixed in 19.2.16+)
  //   GHSA-jrmj-c5cx-3cw6 (@angular/core + @angular/compiler, fixed in 18.2.15+)
  // See ADR-051.
  angular: {
    core: '^19.2.16',
    common: '^19.2.16',
    compiler: '^19.2.16',
    compilerCli: '^19.2.16',
    platformBrowser: '^19.2.16',
    forms: '^19.2.16',
    rxjs: '^7.8.0',
    zoneJs: '~0.14.0',
  },

  // Angular CLI builder toolchain (angular-webpack variant).
  // Versions track Angular major: @angular-builders/custom-webpack@19.0.1 and
  // @angular-architects/module-federation@19.0.3 for Angular 19 compatibility.
  // TypeScript bumped from ~5.2.0 to ~5.7.0 — Angular 19 requires >=5.5 <5.9.
  angularBuild: {
    cli: '^19.2.16',
    buildAngular: '^19.2.16',
    customWebpack: '^19.0.1',
    moduleFederation: '^19.0.3',
    typescript: '~5.7.0',
  },

  // Jest preset (standalone webpack removed — use Angular's bundled copy).
  webpackTools: {
    jestPresetAngular: '^14.0.0',
    typesJest: '^29.5.0',
  },

  // npm overrides — force safe versions of packages with known vulnerabilities.
  // Applied selectively: BFF projects get fast-uri; non-BFF projects get uuid.
  //
  // fast-uri: GHSA-q3j6-qgpj-74h6 + GHSA-v39h-62p7-jpjc (high, BFF chain)
  //   graphql-jit → fast-json-stringify → fast-uri@^2; both fjs@5 and @6 pin ^2.
  //
  // uuid: GHSA-w5hq-g745-h8pq (moderate, dev-only React chain)
  //   @rspack/cli → @rspack/dev-server → webpack-dev-server → sockjs → uuid@<11.1.1
  // npm overrides — force safe versions of transitively-pulled packages with
  // known CVEs. These are deliberate and minimal; `npm audit fix --force` is
  // prohibited (it downgrades and introduces its own regression surface).
  overrides: {
    // fast-uri: GHSA-q3j6-qgpj-74h6 + GHSA-v39h-62p7-jpjc (high) — BFF Mesh chain.
    fastUri: '^3.1.2',
    // uuid: GHSA-w5hq-g745-h8pq (moderate) — rspack/webpack-dev-server → sockjs → uuid.
    uuid: '^11.1.1',
    // tar: node-tar CVEs (GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-qj8w-gfj5-8c6v)
    // — @angular/cli → node-gyp → tar in the Angular build toolchain.
    tar: '^7.5.11',
    // serialize-javascript: GHSA-5c6j-r48x-rmvq (high RCE) + GHSA-qj8w-gfj5-8c6v (DoS)
    // — terser-webpack-plugin → serialize-javascript in the Angular build toolchain.
    serializeJavascript: '^7.0.5',
    // webpack-dev-server: GHSA-79cf-xcqc-c78w (moderate, cross-origin source exposure)
    // — Angular dev-server uses wds 5.x; 5.2.4 is the patched release.
    webpackDevServer: '^5.2.4',
  },
};

/**
 * Plugin configuration defaults
 */
export const DEFAULT_MESH_PLUGINS = {
  // Always include (performance critical)
  responseCache: {
    ttl: 300000, // 5 minutes
  },

  // Production observability (standard tier)
  prometheus: {},

  // Optional (advanced tier)
  opentelemetry: {
    enabled: false,
    sampling: { probability: 0.1 },
  },
};

/**
 * Transform configuration defaults
 */
export const DEFAULT_MESH_TRANSFORMS = {
  // Always include (API consistency)
  namingConvention: {
    typeNames: 'pascalCase',
    fieldNames: 'camelCase',
  },

  // Optional (advanced tier)
  rateLimit: {
    enabled: false,
  },

  filterSchema: {
    enabled: false,
  },
};

// =============================================================================
// Validation Layer (ADR-027)
// =============================================================================

/**
 * NOTE: These validation constants are duplicated in src/utils/manifestValidator.js
 * for CLI pre-generation checks. Keep both in sync until TypeScript migration completes.
 * See ADR-014 for migration strategy.
 */

/**
 * Known GraphQL Mesh plugins (production-ready)
 * Source: @graphql-mesh/plugin-* packages
 * Used to validate manifest plugin configurations and prevent misclassification
 */
export const KNOWN_MESH_PLUGINS = new Set([
  'responseCache',
  'prometheus',
  'opentelemetry',
  'newrelic',
  'statsd',
  'liveQuery',
  'defer-stream',
  'meshHttp',
  'snapshot',
  'mock',
  'operationFieldPermissions',
  'jwtAuth',
  'hmac',
]);

/**
 * Known GraphQL Mesh transforms
 * Source: @graphql-mesh/transform-* packages
 * Used to validate manifest transform configurations and prevent misclassification
 */
export const KNOWN_MESH_TRANSFORMS = new Set([
  'namingConvention',
  'rateLimit',
  'filterSchema',
  'resolversComposition',
  'cache',
  'prefix',
  'rename',
  'encapsulate',
  'federation',
  'extend',
  'replace',
  'typeMerging',
  'mock',
  'bare',
  'type-merging',
]);

/**
 * Validation result for plugin/transform classification
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  classification: {
    plugins: string[];
    transforms: string[];
    unknown: string[];
  };
}

/**
 * Validate and classify plugins from manifest
 * Enforces separation between plugins and transforms
 * Supports both object format {pluginName: config} and array format [{pluginName: config}]
 */
export function validateManifestPlugins(manifest: DSLManifest): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    classification: {
      plugins: [],
      transforms: [],
      unknown: [],
    },
  };

  // Check if manifest has plugins section (can be array or object)
  const manifestPlugins = (manifest as any).plugins;
  if (!manifestPlugins) return result;

  // Handle both array and object formats
  const pluginEntries = Array.isArray(manifestPlugins)
    ? manifestPlugins.map((p) => (typeof p === 'string' ? p : Object.keys(p)[0]))
    : Object.keys(manifestPlugins);

  for (const pluginName of pluginEntries) {
    if (KNOWN_MESH_PLUGINS.has(pluginName)) {
      result.classification.plugins.push(pluginName);
    } else if (KNOWN_MESH_TRANSFORMS.has(pluginName)) {
      // This is a transform, not a plugin!
      result.errors.push(
        `"${pluginName}" is a transform, not a plugin. Move it to the "transforms" section.`
      );
      result.classification.transforms.push(pluginName);
      result.valid = false;
    } else {
      result.warnings.push(
        `Unknown plugin "${pluginName}". Ensure it's a valid @graphql-mesh/plugin-* package.`
      );
      result.classification.unknown.push(pluginName);
    }
  }

  return result;
}

/**
 * Validate and classify transforms from manifest
 * Supports both object format {transformName: config} and array format [{transformName: config}]
 */
export function validateManifestTransforms(manifest: DSLManifest): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    classification: {
      plugins: [],
      transforms: [],
      unknown: [],
    },
  };

  // Check if manifest has transforms section (can be array or object)
  const manifestTransforms = (manifest as any).transforms;
  if (!manifestTransforms) return result;

  // Handle both array and object formats
  const transformEntries = Array.isArray(manifestTransforms)
    ? manifestTransforms.map((t) => (typeof t === 'string' ? t : Object.keys(t)[0]))
    : Object.keys(manifestTransforms);

  for (const transformName of transformEntries) {
    if (KNOWN_MESH_TRANSFORMS.has(transformName)) {
      result.classification.transforms.push(transformName);
    } else if (KNOWN_MESH_PLUGINS.has(transformName)) {
      // This is a plugin, not a transform!
      result.errors.push(
        `"${transformName}" is a plugin, not a transform. Move it to the "plugins" section.`
      );
      result.classification.plugins.push(transformName);
      result.valid = false;
    } else {
      result.warnings.push(
        `Unknown transform "${transformName}". Ensure it's a valid @graphql-mesh/transform-* package.`
      );
      result.classification.unknown.push(transformName);
    }
  }

  return result;
}

/**
 * Comprehensive validation of manifest plugin/transform configuration
 * Throws error if validation fails (protect code generation)
 */
export function validateManifestConfiguration(manifest: DSLManifest): void {
  const pluginValidation = validateManifestPlugins(manifest);
  const transformValidation = validateManifestTransforms(manifest);

  const allErrors = [...pluginValidation.errors, ...transformValidation.errors];
  const allWarnings = [...pluginValidation.warnings, ...transformValidation.warnings];

  // Log warnings (non-fatal)
  if (allWarnings.length > 0) {
    console.warn('\n⚠️  Manifest Configuration Warnings:');
    allWarnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  // Throw on errors (fatal - prevent bad generation)
  if (allErrors.length > 0) {
    console.error('\n❌ Manifest Configuration Errors:');
    allErrors.forEach((error) => console.error(`  - ${error}`));
    throw new Error(
      `Manifest validation failed with ${allErrors.length} error(s). ` +
        `Please correct the plugin/transform configuration in your mfe-manifest.yaml.`
    );
  }

  // Log success for visibility
  const totalPlugins = pluginValidation.classification.plugins.length;
  const totalTransforms = transformValidation.classification.transforms.length;
  console.log(
    `✅ Manifest validation passed: ${totalPlugins} plugin(s), ${totalTransforms} transform(s)`
  );
}

// =============================
// Shared Utilities
// =============================

/**
 * Extract manifest variables for template rendering
 */
export function extractManifestVars(manifest: DSLManifest) {
  const className = manifest.name.replace(/[^a-zA-Z0-9]/g, '') + 'MFE';
  const inputTypeName = className + 'Inputs';
  const outputTypeName = className + 'Outputs';
  const port = manifest.endpoint ? Number(manifest.endpoint.split(':').pop()) : 3001;
  const muiVersion =
    manifest.dependencies?.['design-system']?.['@mui/material'] || DEPENDENCY_VERSIONS.mui.material;

  // Filter out empty/invalid remote entries from YAML parsing issues
  const rawRemotes = manifest.dependencies?.mfes || {};
  const remotes: Record<string, any> = {};
  for (const [name, config] of Object.entries(rawRemotes)) {
    if (name && name.trim() && config && typeof config === 'object') {
      remotes[name] = config;
    }
  }

  // Extract performance/observability config from manifest (ADR-027)
  const performanceConfig = (manifest as any).performance || {};
  const observabilityConfig = performanceConfig.observability || {};

  // Determine which plugins are needed based on manifest config
  const neededPlugins = new Set<string>();
  if (performanceConfig.caching?.enabled !== false) {
    neededPlugins.add('responseCache');
  }
  if (observabilityConfig.prometheus?.enabled !== false) {
    neededPlugins.add('prometheus');
  }
  if (observabilityConfig.opentelemetry?.enabled) {
    neededPlugins.add('opentelemetry');
  }

  // Determine which transforms are needed
  const neededTransforms = new Set<string>();
  neededTransforms.add('namingConvention'); // Always include
  if (performanceConfig.rateLimit?.enabled) {
    neededTransforms.add('rateLimit');
  }
  if (performanceConfig.filterSchema?.enabled) {
    neededTransforms.add('filterSchema');
  }
  if ((manifest as any).transforms && (manifest as any).transforms.length > 0) {
    neededTransforms.add('resolversComposition');
  }
  // Demo-mode mock switch (ADR-052) is implemented as a resolversComposition transform.
  const mockSwitchEnabled = !!(manifest as any).data?.mockSwitch?.enabled;
  if (mockSwitchEnabled) {
    neededTransforms.add('resolversComposition');
  }

  // Variant selection via plugin (ADR-036, #176).
  // bundler:'webpack' alone still resolves to angular so the trio stays consistent.
  const frameworkName = manifest.framework ?? (manifest.bundler === 'webpack' ? 'angular' : 'react');
  const fwPlugin = loadFrameworkPlugin(frameworkName);

  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    port,
    muiVersion,
    remotes,
    className,
    inputTypeName,
    outputTypeName,
    manifest,
    capabilities: [], // will be overwritten in generateAllFiles
    lifecycleHooks: [], // will be overwritten in generateAllFiles
    handlerSources: [], // ADR-040 — overwritten in generateAllFiles

    // Codegen variant selection — driven by plugin (ADR-036).
    // Exposed to templates and read back by generateAllFiles.
    framework: fwPlugin.framework as 'react' | 'angular',
    bundler: fwPlugin.bundler as 'rspack' | 'webpack',
    templateVariant: fwPlugin.id as 'react-rspack' | 'angular-webpack',

    // NEW: Dependency versions for templates (ADR-027)
    dependencyVersions: DEPENDENCY_VERSIONS,

    // NEW: Track which plugins/transforms are needed (ADR-027)
    neededPlugins: Array.from(neededPlugins),
    neededTransforms: Array.from(neededTransforms),

    // NEW: Plugin/transform configs (ADR-027)
    meshPlugins: {
      responseCache:
        performanceConfig.caching?.enabled !== false ? DEFAULT_MESH_PLUGINS.responseCache : null,
      prometheus:
        observabilityConfig.prometheus?.enabled !== false
          ? {
              ...DEFAULT_MESH_PLUGINS.prometheus,
              ...observabilityConfig.prometheus,
            }
          : null,
      opentelemetry: observabilityConfig.opentelemetry?.enabled
        ? {
            ...DEFAULT_MESH_PLUGINS.opentelemetry,
            ...observabilityConfig.opentelemetry,
          }
        : null,
    },

    meshTransforms: {
      namingConvention: DEFAULT_MESH_TRANSFORMS.namingConvention,
      rateLimit: performanceConfig.rateLimit?.enabled ? performanceConfig.rateLimit : null,
      filterSchema: performanceConfig.filterSchema?.enabled ? performanceConfig.filterSchema : null,
      // Demo-mode mock switch (ADR-052) — emits a resolversComposition over Query.*
      mockSwitch: mockSwitchEnabled,
      customTransforms: (manifest as any).transforms || [],
    },

    // BFF endpoint for the client-side connector template (bff.ts.ejs)
    bffEndpoint: (manifest as any).data?.serve?.endpoint ?? '/graphql',

    // True when the manifest declares a data: section — gates doQuery() generation
    // and the bff.ts / server.ts / .meshrc.yaml artifacts in both mfe.ts.ejs templates
    hasBff: !!((manifest as any).data),
  };
}

/**
 * Render an EJS template file with variables
 */
export async function renderTemplate(
  templatePath: string,
  vars: Record<string, any>
): Promise<string> {
  const template = await fs.readFile(templatePath, 'utf8');
  return ejs.render(template, vars);
}

/**
 * Detect whether a domain capability is already realized in code.
 *
 * `remote:generate` should scaffold a capability's feature stub only when it
 * has not been implemented yet, and otherwise leave the file untouched. The
 * signal is the presence of an exported symbol matching the capability name in
 * its own feature file:
 *   - React:   `export const <Name>` / `function` / `class` / `default <Name>`
 *   - Angular: `export class <Name>Component`
 *
 * Note: the generated stub already exports `<Name>`, so a capability counts as
 * "implemented" from the moment its file exists — which is the intended
 * hands-off behavior (features are user-owned once created). A missing file
 * means the capability has not been generated yet → returns false.
 */
export async function capabilityImplemented(
  componentFilePath: string,
  name: string,
  variant: 'react-rspack' | 'angular-webpack',
): Promise<boolean> {
  if (!(await fs.pathExists(componentFilePath))) return false;
  const content = await fs.readFile(componentFilePath, 'utf8');
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns =
    variant === 'angular-webpack'
      ? [new RegExp(`export\\s+(?:default\\s+)?class\\s+${esc}(?:Component)?\\b`)]
      : [
          // export const/let/var/function/class/default <Name>
          new RegExp(`export\\s+(?:default\\s+)?(?:const|let|var|function|class)\\s+${esc}\\b`),
          // export default <Name>
          new RegExp(`export\\s+default\\s+${esc}\\b`),
          // export { ... <Name> ... }
          new RegExp(`export\\s*\\{[^}]*\\b${esc}\\b[^}]*\\}`),
        ];
  return patterns.some((re) => re.test(content));
}

/**
 * Write generated files to disk
 */
export async function writeGeneratedFiles(
  files: GeneratedFile[],
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<{ files: GeneratedFile[]; skipped: string[]; errors: string[] }> {
  const result = { files: [], skipped: [], errors: [] };
  for (const file of files) {
    try {
      const exists = await fs.pathExists(file.path);
      if (exists && !file.overwrite && !options.force) {
        result.skipped.push(file.path);
        continue;
      }
      if (options.dryRun) {
        result.files.push(file);
        continue;
      }
      await fs.ensureDir(path.dirname(file.path));
      await fs.writeFile(file.path, file.content, 'utf8');
      result.files.push(file);
    } catch (error) {
      result.errors.push(`Failed to write ${file.path}: ${(error as Error).message}`);
    }
  }
  return result;
}

// =============================
// Handler source parsing (ADR-040)
// =============================

/**
 * Parse a DSL `source:` specifier into a static import descriptor.
 *
 * Grammar:
 *   "./rel/path"               → named import `{ <hookName> } from './rel/path'`
 *   "@org/pkg"                 → default import `<hookName> from '@org/pkg'`
 *   "@org/pkg#namedExport"     → named import `{ namedExport as <hookName> } from '@org/pkg'`
 *
 * Returning `null` means the source is malformed (empty / only whitespace);
 * the caller logs and falls back to stub generation so codegen never crashes
 * on a typo.
 */
export function parseHandlerSource(
  source: string,
  hookName: string,
): { module: string; exportName: string } | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx >= 0) {
    const module = trimmed.slice(0, hashIdx).trim();
    const exportName = trimmed.slice(hashIdx + 1).trim();
    if (!module || !exportName) return null;
    return { module, exportName };
  }
  // No '#': relative paths use a named import matching the hook name (the
  // common case for project-local handler files); bare module specifiers use
  // the default export.
  const isRelative = trimmed.startsWith('./') || trimmed.startsWith('../');
  return {
    module: trimmed,
    exportName: isRelative ? hookName : 'default',
  };
}

// =============================
// Unified Generator Entrypoint
// =============================

/**
 * Generate all files (features, platform, BFF, configs) for a manifest
 */
export interface GenerateAllFilesResult {
  files: GeneratedFile[];
  preservedCapabilities: string[];
}

export async function generateAllFiles(
  manifest: DSLManifest,
  basePath: string,
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<GenerateAllFilesResult> {
  // === Validation Layer (ADR-027) ===
  // Validate manifest configuration before generation
  // Throws if validation fails (prevents bad configurations)
  validateManifestConfiguration(manifest);

  const files: GeneratedFile[] = [];
  const vars = extractManifestVars(manifest);
  // --- Platform contract-driven capability and lifecycle aggregation ---
  const platformCapabilities = {
    Load: { method: 'load', returnTypeBase: 'LoadResult' },
    Render: { method: 'render', returnTypeBase: 'RenderResult' },
    Refresh: { method: 'refresh', returnTypeBase: 'void' },
    AuthorizeAccess: { method: 'authorizeAccess', returnTypeBase: 'boolean' },
    Health: { method: 'health', returnTypeBase: 'HealthResult' },
    Describe: { method: 'describe', returnTypeBase: 'DescribeResult' },
    Schema: { method: 'schema', returnTypeBase: 'SchemaResult' },
    Query: { method: 'query', returnTypeBase: 'QueryResult' },
    Emit: { method: 'emit', returnTypeBase: 'EmitResult' },
  };

  const capabilities: Array<{
    method: string;
    config: any;
    returnTypeBase: string;
    stubBody: string;
  }> = [];
  const lifecycleHookNames = new Set<string>();
  const lifecycleHooks: Array<{ name: string; description: string; phase: string }> = [];
  // ADR-040: handlers that declare a `source` in the DSL manifest are sourced
  // from external modules. They appear in handlerSources (drives the generated
  // handler-registry.ts + import wiring) and are excluded from lifecycleHooks
  // (no stub method is emitted because the implementation lives elsewhere).
  const handlerSources: Array<{ localName: string; module: string; exportName: string }> = [];
  let inputs: any[] = [];
  let outputs: any[] = [];

  for (const entry of manifest.capabilities) {
    for (const [method, config] of Object.entries(entry)) {
      // Ensure inputs/outputs are always arrays
      const safeConfig = {
        ...config,
        inputs: Array.isArray(config.inputs) ? config.inputs : [],
        outputs: Array.isArray(config.outputs) ? config.outputs : [],
      };
      if (platformCapabilities[method]) {
        capabilities.push({
          method: platformCapabilities[method].method,
          config: safeConfig,
          returnTypeBase: platformCapabilities[method].returnTypeBase,
          stubBody: '',
        });
      } else {
        capabilities.push({
          method,
          config: safeConfig,
          returnTypeBase: method + 'Outputs',
          stubBody: '',
        });
      }
      // Collect lifecycle hooks from capability config, deduplicated
      // Filter out base capability names to prevent conflicts
      const baseCapabilityNames = Object.values(platformCapabilities).map((c) => c.method);
      if (safeConfig.lifecycle) {
        for (const phase of ['before', 'main', 'after', 'error']) {
          if (safeConfig.lifecycle[phase]) {
            for (const hookEntry of safeConfig.lifecycle[phase]) {
              for (const [hookName, hookConfig] of Object.entries(hookEntry)) {
                // Skip if it's a base capability name OR already added
                if (!baseCapabilityNames.includes(hookName) && !lifecycleHookNames.has(hookName)) {
                  lifecycleHookNames.add(hookName);
                  const hookDescription = (hookConfig as any)?.description || '';
                  // ADR-040: hooks with a `source` are wired through the
                  // generated handler-registry, not emitted as stubs.
                  const source = (hookConfig as any)?.source as string | undefined;
                  if (typeof source === 'string' && source.length > 0) {
                    const parsed = parseHandlerSource(source, hookName);
                    if (parsed) {
                      handlerSources.push({ localName: hookName, ...parsed });
                      continue;
                    }
                  }
                  lifecycleHooks.push({ name: hookName, description: hookDescription, phase });
                }
              }
            }
          }
        }
      }
      // Collect inputs/outputs from capability config
      if (safeConfig.inputs) inputs = inputs.concat(safeConfig.inputs);
      if (safeConfig.outputs) outputs = outputs.concat(safeConfig.outputs);
    }
  }

  vars.capabilities = capabilities;
  vars.lifecycleHooks = lifecycleHooks;
  vars.handlerSources = handlerSources;

  // Codegen template variant selection (computed in extractManifestVars).
  // Manifest.framework + manifest.bundler pick the directory and per-file
  // extensions. Omitted ⇒ React + rspack (back-compat with all existing MFEs).
  const templateVariant = vars.templateVariant;

  // Standardized template directory
  const templateDir = path.resolve(
    __dirname,
    templateVariant === 'angular-webpack'
      ? '../templates/base-mfe-angular'
      : '../templates/base-mfe'
  );
  const featureTplDir = path.join(templateDir, 'features');
  const featuresDir = path.join(basePath, 'src', 'features');
  // Platform/BFF directories and template paths
  const platformDir = path.join(basePath, 'src', 'platform', 'base-mfe');
  const bffDir = path.join(basePath, 'src', 'platform', 'bff');
  const bffTemplateDir = path.resolve(__dirname, '../../../packages/bff-plugin/templates');

  // --- Feature/component generation ---
  // For each domain capability, generate feature, index, test
  const domainCapabilities: string[] = [];
  // Capabilities already realized in code — their stubs are not re-emitted so
  // user implementations survive a re-run (no --force footgun for features).
  const preservedCapabilities: string[] = [];
  // Ensure capabilities array exists and is iterable
  const capabilitiesArray = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];

  for (const entry of capabilitiesArray) {
    // Skip empty/null entries from YAML parsing issues
    if (!entry || typeof entry !== 'object') continue;

    for (const [name, config] of Object.entries(entry)) {
      // Validate entry has valid name and config
      if (!name || !name.trim()) continue;
      if (!config || typeof config !== 'object') continue;
      if (config.type !== 'domain') continue;

      domainCapabilities.push(name);
      const featurePath = path.join(featuresDir, name);
      const featureSpec =
        templateVariant === 'angular-webpack'
          ? {
              componentFile: `${name}.component.ts`,
              componentTpl: 'feature.component.ts.ejs',
              specFile: `${name}.component.spec.ts`,
              specTpl: 'feature.component.spec.ts.ejs',
            }
          : {
              componentFile: `${name}.tsx`,
              componentTpl: 'feature.tsx.ejs',
              specFile: `${name}.test.tsx`,
              specTpl: 'feature.test.tsx.ejs',
            };

      // If the capability is already implemented in its feature file, leave it
      // (and its index/test) untouched — even under --force, since this is user
      // code, not regenerable scaffolding.
      if (await capabilityImplemented(path.join(featurePath, featureSpec.componentFile), name, templateVariant)) {
        preservedCapabilities.push(name);
        continue;
      }

      // Feature component
      files.push({
        path: path.join(featurePath, featureSpec.componentFile),
        content: await renderTemplate(path.join(featureTplDir, featureSpec.componentTpl), {
          name,
          description: config.description || `${name} feature component`,
        }),
        overwrite: false,
      });
      // Feature index
      files.push({
        path: path.join(featurePath, 'index.ts'),
        content: await renderTemplate(path.join(featureTplDir, 'index.ts.ejs'), { name }),
        overwrite: false,
      });
      // Feature test
      files.push({
        path: path.join(featurePath, featureSpec.specFile),
        content: await renderTemplate(path.join(featureTplDir, featureSpec.specTpl), { name }),
        overwrite: false,
      });
    }
  }
  if (preservedCapabilities.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `Preserved (already implemented): ${preservedCapabilities.join(', ')}`,
    );
  }

  // Remote entrypoint exports all domain capabilities
  const remoteEntry =
    templateVariant === 'angular-webpack'
      ? { file: 'remote.ts', tpl: 'remote.ts.ejs' }
      : { file: 'remote.tsx', tpl: 'remote.tsx.ejs' };
  files.push({
    path: path.join(basePath, 'src', remoteEntry.file),
    content: await renderTemplate(path.join(featureTplDir, remoteEntry.tpl), {
      capabilities: domainCapabilities,
    }),
    overwrite: true,
  });

  // --- Platform/BFF generation ---
  // Generate BaseMFE, types, tests, BFF, .meshrc.yaml
  // .meshrc.yaml from manifest.data
  if (manifest.data) {
    const yaml = require('js-yaml');

    // Build base mesh config (sources, serve, etc.)
    // Filter out empty/invalid sources from YAML parsing issues
    const validSources = (manifest.data.sources || []).filter(
      (source) =>
        source && typeof source === 'object' && source.name && source.name.trim() && source.handler
    );

    const meshBaseConfig: any = {
      sources: validSources,
      serve: manifest.data.serve || { endpoint: '/graphql', playground: true },
    };

    const meshConfigYaml = yaml.dump(meshBaseConfig, { noRefs: true, lineWidth: -1 });

    files.push({
      path: path.join(basePath, '.meshrc.yaml'),
      content: await renderTemplate(path.join(bffTemplateDir, 'meshrc.yaml.ejs'), {
        ...vars,
        meshConfigYaml,
      }),
      overwrite: true,
    });

    // Demo-mode mock switch (ADR-052): emit the composer (generated, overwrite:true)
    // and a developer-owned fixtures stub (overwrite:false) next to .meshrc.yaml so
    // the `./mock-switch#mockSwitch` composer path resolves from the project root.
    if ((manifest.data as any).mockSwitch?.enabled) {
      files.push({
        path: path.join(basePath, 'mock-switch.js'),
        content: await renderTemplate(path.join(bffTemplateDir, 'mock-switch.js.ejs'), vars),
        overwrite: true,
      });
      files.push({
        path: path.join(basePath, 'mocks.json'),
        content: await renderTemplate(path.join(bffTemplateDir, 'mocks.json.ejs'), vars),
        overwrite: false,
      });
    }
  }

  // BaseMFE class
  files.push({
    path: path.join(platformDir, 'mfe.ts'),
    content: await renderTemplate(path.join(templateDir, 'mfe.ts.ejs'), vars),
    overwrite: true,
  });
  // ADR-040: emit the handler registry only when at least one lifecycle hook
  // declared a `source`. Without sources, the registry file is absent and the
  // generated mfe.ts looks identical to today (back-compat).
  if (handlerSources.length > 0) {
    files.push({
      path: path.join(platformDir, 'handler-registry.ts'),
      content: await renderTemplate(
        path.join(templateDir, 'handler-registry.ts.ejs'),
        vars,
      ),
      overwrite: true,
    });
  }
  // Bootstrap — exports mfe instance + mfeReady for imperative shell rendering
  files.push({
    path: path.join(platformDir, 'bootstrap.ts'),
    content: await renderTemplate(path.join(templateDir, 'bootstrap.ts.ejs'), vars),
    // Regenerated on every codegen run so the inline manifest stays in sync
    // with mfe-manifest.yaml. Bootstrap is glue code (instantiate, call load,
    // log result); customization belongs in mfe.ts overrides, lifecycle
    // hooks, or `deps.*` DI — not in this file.
    overwrite: true,
  });
  // BaseMFE test
  files.push({
    path: path.join(platformDir, 'mfe.test.ts'),
    content: await renderTemplate(path.join(templateDir, 'mfe.test.ts.ejs'), vars),
    overwrite: true,
  });
  // types.ts
  files.push({
    path: path.join(platformDir, 'types.ts'),
    content: await renderTemplate(path.join(templateDir, 'types.ts.ejs'), vars),
    overwrite: true,
  });

  if (manifest.data) {
    // BFF stub files — only when manifest declares a data: section
    files.push({
      path: path.join(bffDir, 'bff.ts'),
      content: await renderTemplate(path.join(bffTemplateDir, 'bff.ts.ejs'), {
        ...vars,
        bffClassName: vars.className + 'BFF',
      }),
      overwrite: true,
    });
    files.push({
      path: path.join(bffDir, 'bff.test.ts'),
      content: await renderTemplate(path.join(bffTemplateDir, 'bff.test.ts.ejs'), {
        ...vars,
        bffClassName: vars.className + 'BFF',
      }),
      overwrite: true,
    });

    // BFF main server and root files.
    //
    // Important: `package.json` is intentionally NOT in this list. The MFE root
    // template at `src/codegen/templates/base-mfe/package.json.ejs` is already a
    // hybrid that owns BOTH MFE deps (rspack, react, MUI, etc.) AND BFF deps
    // (mesh, express, helmet, etc.). The BFF template's `package.json.ejs` is a
    // strict subset (no MUI, no MFE-specific scripts) and previously clobbered
    // the hybrid one because it ran first with `overwrite: true`, leaving the
    // generated MFE without MUI deps even though `src/App.tsx` imports them.
    //
    // `server.ts` stays `overwrite: true` because it's pure BFF runtime that the
    // user does not customize. The remaining root files (`tsconfig.json`,
    // `Dockerfile`, `docker-compose.yaml`, `README.md`) flip to `overwrite: false`
    // so user customization survives regeneration, matching the same convention
    // used by other root templates further down (`package.json`, `rspack.config.js`).
    // Angular-webpack emits its own tsconfig.json (with experimentalDecorators,
    // angularCompilerOptions, etc.) in the root templates block below. Skip the
    // BFF tsconfig for that variant so the Angular-specific one wins.
    const bffTemplates: Array<{ tpl: string; out: string; overwrite: boolean }> = [
      { tpl: 'server.ts.ejs', out: 'server.ts', overwrite: true },
      ...(templateVariant !== 'angular-webpack'
        ? [{ tpl: 'tsconfig.json', out: 'tsconfig.json', overwrite: false }]
        : []),
      { tpl: 'Dockerfile.ejs', out: 'Dockerfile', overwrite: false },
      { tpl: 'docker-compose.yaml.ejs', out: 'docker-compose.yaml', overwrite: false },
      { tpl: 'README.md.ejs', out: 'README.md', overwrite: false },
    ];
    // BFF port = MFE port + 1000 (e.g., 3002 → 4002, following e2e2 pattern)
    const mfePort = vars.port || 3000;
    const bffPort = mfePort + 1000;
    const includeStatic = true;
    for (const { tpl, out, overwrite } of bffTemplates) {
      const templatePath = path.join(bffTemplateDir, tpl);
      if (await fs.pathExists(templatePath)) {
        const content = await renderTemplate(templatePath, { ...vars, port: bffPort, includeStatic });
        files.push({
          path: path.join(basePath, out),
          content,
          overwrite,
        });
      }
    }
  }

  // --- Root/config files ---
  // Variant-aware: angular-webpack emits webpack.config.js + tsconfig pair;
  // react-rspack keeps the existing package.json + rspack.config.js shape.
  const rootTemplates =
    templateVariant === 'angular-webpack'
      ? [
          { name: 'package.json', ejs: 'package.json.ejs' },
          { name: 'angular.json', ejs: 'angular.json.ejs' },
          { name: 'webpack.config.js', ejs: 'webpack.config.js.ejs' },
          { name: 'tsconfig.json', ejs: 'tsconfig.json.ejs' },
          { name: 'tsconfig.app.json', ejs: 'tsconfig.app.json.ejs' },
          { name: 'tsconfig.spec.json', ejs: 'tsconfig.spec.json.ejs' },
          { name: 'jest.config.js', ejs: 'jest.config.js.ejs' },
          { name: 'setup.jest.ts', ejs: 'setup.jest.ts.ejs' },
        ]
      : [
          { name: 'package.json', ejs: 'package.json.ejs' },
          { name: 'rspack.config.js', ejs: 'rspack.config.js.ejs' },
        ];
  for (const tpl of rootTemplates) {
    const templatePath = path.join(templateDir, tpl.ejs);
    if (await fs.pathExists(templatePath)) {
      const renderedContent = await renderTemplate(templatePath, vars);
      files.push({
        path: path.join(basePath, tpl.name),
        content: renderedContent,
        overwrite: false, // user-owned: only generate on first init, not on regenerate
      });
    } else {
      // Diagnostic: warn if template missing
      // eslint-disable-next-line no-console
      console.warn(
        `[unified-generator] WARNING: Missing template for ${tpl.name}: ${templatePath}`
      );
    }
  }

  // --- Entry files ---
  // Variant-aware. React: src/App.tsx + src/index.tsx (standalone dev shell).
  // Angular: src/main.ts + src/bootstrap.ts + src/polyfills.ts + src/app/app.component.ts.
  if (templateVariant === 'angular-webpack') {
    const angularEntries: Array<{ tpl: string; out: string; overwrite: boolean }> = [
      { tpl: 'src/main.ts.ejs', out: 'src/main.ts', overwrite: false },
      { tpl: 'src/bootstrap.ts.ejs', out: 'src/bootstrap.ts', overwrite: false },
      { tpl: 'src/app/app.component.ts.ejs', out: 'src/app/app.component.ts', overwrite: false },
    ];
    for (const { tpl, out, overwrite } of angularEntries) {
      const templatePath = path.join(templateDir, tpl);
      if (await fs.pathExists(templatePath)) {
        const content = await renderTemplate(templatePath, vars);
        files.push({
          path: path.join(basePath, out),
          content,
          overwrite,
        });
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[unified-generator] WARNING: Missing template for ${out}: ${templatePath}`);
      }
    }
  } else {
    // Generate src/App.tsx from EJS template
    const appTemplatePath = path.join(templateDir, 'App.tsx.ejs');
    const appOutPath = path.join(basePath, 'src', 'App.tsx');
    if (await fs.pathExists(appTemplatePath)) {
      const appContent = await renderTemplate(appTemplatePath, vars);
      files.push({
        path: appOutPath,
        content: appContent,
        overwrite: false, // user-owned: App.tsx is the game entry point, not regenerated
      });
    } else {
      // Diagnostic: warn if App.tsx template missing
      // eslint-disable-next-line no-console
      console.warn(`[unified-generator] WARNING: Missing template for App.tsx: ${appTemplatePath}`);
    }

    // Generate src/index.tsx (standalone entry point with React bootstrap)
    const indexTemplatePath = path.join(templateDir, 'index.tsx.ejs');
    const indexOutPath = path.join(basePath, 'src', 'index.tsx');
    if (await fs.pathExists(indexTemplatePath)) {
      // Build capability metadata for template
      const capabilityMetadata = domainCapabilities.map((name) => {
        // Find the capability config to get icon/displayName
        const capEntry = manifest.capabilities.find((c) => Object.keys(c).includes(name));
        const capConfig = capEntry?.[name];
        return {
          className: name,
          displayName: (capConfig as any)?.displayName || name,
          icon: (capConfig as any)?.icon || '📦',
        };
      });

      const indexContent = await renderTemplate(indexTemplatePath, {
        ...vars,
        capabilities: capabilityMetadata,
      });
      files.push({
        path: indexOutPath,
        content: indexContent,
        overwrite: false, // user-owned: standalone dev entry, not regenerated
      });
    } else {
      // Diagnostic: warn if index.tsx template missing
      // eslint-disable-next-line no-console
      console.warn(
        `[unified-generator] WARNING: Missing template for index.tsx: ${indexTemplatePath}`
      );
    }
  }

  // --- Public assets ---
  // Generate public/index.html and favicon.ico from EJS templates
  const publicDir = path.join(basePath, 'public');
  const indexHtmlTemplatePath = path.join(templateDir, 'public', 'index.html.ejs');
  const faviconTemplatePath = path.join(templateDir, 'public', 'favicon.ico.ejs');
  if (await fs.pathExists(indexHtmlTemplatePath)) {
    const indexHtmlContent = await renderTemplate(indexHtmlTemplatePath, vars);
    files.push({
      path: path.join(publicDir, 'index.html'),
      content: indexHtmlContent,
      overwrite: true,
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[unified-generator] WARNING: Missing template for public/index.html: ${indexHtmlTemplatePath}`
    );
  }

  // Generate public/demo.html (runtime demonstration page)
  const demoHtmlTemplatePath = path.join(templateDir, 'public', 'demo.html.ejs');
  if (await fs.pathExists(demoHtmlTemplatePath)) {
    const demoHtmlContent = await renderTemplate(demoHtmlTemplatePath, {
      ...vars,
      capabilities: domainCapabilities,
    });
    files.push({
      path: path.join(publicDir, 'demo.html'),
      content: demoHtmlContent,
      overwrite: true,
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[unified-generator] WARNING: Missing template for public/demo.html: ${demoHtmlTemplatePath}`
    );
  }

  if (await fs.pathExists(faviconTemplatePath)) {
    const faviconContent = await renderTemplate(faviconTemplatePath, vars);
    files.push({
      path: path.join(publicDir, 'favicon.ico'),
      content: faviconContent,
      overwrite: true,
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[unified-generator] WARNING: Missing template for public/favicon.ico: ${faviconTemplatePath}`
    );
  }

  // Jest static-asset mock — required by the moduleNameMapper in the generated jest config
  files.push({
    path: path.join(basePath, '__mocks__', 'fileMock.js'),
    content: 'module.exports = "test-file-stub";\n',
    overwrite: false,
  });

  return { files, preservedCapabilities };
}
