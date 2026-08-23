/**
 * Shared BFF helpers — underscore prefix makes oclif skip this file.
 * Following ADR-012: GraphQL Mesh with DSL-embedded configuration.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import * as yaml from 'js-yaml';
import { ValidationError, SystemError } from '@seans-mfe/contracts';

// ============================================================================
// Type Definitions
// ============================================================================

export interface OpenAPIHandler {
  source: string;
  operationHeaders?: Record<string, string>;
}

export interface MeshSource {
  name: string;
  handler: { openapi: OpenAPIHandler };
  transforms?: MeshTransform[];
}

export interface MeshTransform {
  prefix?: { value: string; includeRootOperations?: boolean };
  rename?: Record<string, string>;
  filterSchema?: { filters: string[] };
  encapsulate?: { applyTo: { query: boolean; mutation: boolean } };
  namingConvention?: { typeNames: string; fieldNames: string };
  /** How the demo-mode mock switch is expressed to Mesh (ADR-052). */
  resolversComposition?: {
    mode: string;
    compositions: Array<{ resolver: string; composer: string }>;
  };
  [key: string]: unknown;
}

export interface MeshPlugin {
  /**
   * `if` is a Mesh cache predicate. Demo mode sets it so a response cached from
   * a live request is never served to a mock request, or vice versa (ADR-052).
   */
  responseCache?: { ttl: number; if?: string };
  rateLimit?: { config: Array<{ type: string; field: string; max: number; window: string }> };
  prometheus?: Record<string, unknown>;
  depthLimit?: { maxDepth: number };
  csrf?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MeshServe {
  endpoint: string;
  playground: boolean;
}

/**
 * The plugin's copy of the manifest's `data:` block. It fell behind the
 * canonical `DataConfigSchema` in `@seans-mfe/dsl`: `mockSwitch` (ADR-052) and
 * `generatedFrom` (ADR-011) were added there and never mirrored here, so
 * `bff:validate` returned a manifest its own published schema rejected.
 *
 * Kept in sync by hand for now because the plugin is deliberately
 * self-contained; the output-schema conformance test is what catches the drift.
 */
export interface DSLDataSection {
  sources: MeshSource[];
  transforms?: MeshTransform[];
  plugins?: MeshPlugin[];
  serve?: MeshServe;
  /** Demo-mode live/mock switch (ADR-052). */
  mockSwitch?: { enabled: boolean };
  /** Provenance of a generated `data:` block (ADR-011). */
  generatedFrom?: Array<{ openapi?: string; service?: string; version?: string }>;
}

export interface MFEManifest {
  name: string;
  version?: string;
  type?: string;
  data?: DSLDataSection;
  [key: string]: unknown;
}

export interface MeshConfig {
  sources: MeshSource[];
  transforms?: MeshTransform[];
  plugins?: MeshPlugin[];
  serve: MeshServe;
}

export interface ExtractMeshConfigResult {
  meshConfig: MeshConfig;
  manifest: MFEManifest;
  manifestPath: string;
}

export interface BFFCommandOptions {
  manifest?: string;
  cwd?: string;
  port?: number;
  specs?: string[];
  static?: boolean;
  version?: string;
}

export interface ValidationResult {
  valid: boolean;
  meshConfig: MeshConfig;
  manifest: MFEManifest;
}

export interface TemplateSource {
  name: string;
  spec: string;
}

export interface TemplateVars {
  name: string;
  version: string;
  port: number;
  type: string;
  includeStatic: boolean;
  sources: TemplateSource[];
  transforms: MeshTransform[];
  plugins: MeshPlugin[];
  playground: boolean;
  bffEndpoint: string;
  /** Passed to package.json.ejs for versioned dependency strings (from DEPENDENCY_VERSIONS) */
  dependencyVersions: Record<string, unknown>;
  /** Passed to package.json.ejs / meshrc.yaml.ejs for plugin config */
  meshPlugins: Record<string, unknown>;
  /** Passed to package.json.ejs / meshrc.yaml.ejs for transform config */
  meshTransforms: Record<string, unknown>;
}

// ============================================================================
// Core Helpers
// ============================================================================

/**
 * Extract Mesh configuration from DSL data: section.
 * REQ-BFF-001: DSL Data Section as Mesh Configuration
 */
export async function extractMeshConfig(manifestPath: string): Promise<ExtractMeshConfigResult> {
  const absolutePath = path.resolve(process.cwd(), manifestPath);

  if (!await fs.pathExists(absolutePath)) {
    throw new SystemError(`Manifest not found: ${absolutePath}`);
  }

  const manifestContent = await fs.readFile(absolutePath, 'utf8');
  const manifest = yaml.load(manifestContent) as MFEManifest;

  if (!manifest.data) {
    throw new ValidationError(
      'No "data:" section found in manifest. BFF requires data configuration.',
      'data',
      'required',
    );
  }

  if (!manifest.data.sources || manifest.data.sources.length === 0) {
    throw new ValidationError(
      'No sources defined in data: section. At least one OpenAPI source is required.',
      'data.sources',
      'required',
    );
  }

  const meshConfig: MeshConfig = {
    sources: manifest.data.sources,
    ...(manifest.data.transforms && { transforms: manifest.data.transforms }),
    ...(manifest.data.plugins && { plugins: manifest.data.plugins }),
    serve: manifest.data.serve || { endpoint: '/graphql', playground: true }
  };

  applyMockSwitch(meshConfig, manifest.data);

  return { meshConfig, manifest, manifestPath: absolutePath };
}

/**
 * Where the composer lives relative to `.meshrc.yaml` on the standalone path.
 *
 * The `remote:generate` path nests the BFF under `src/platform/bff/`, so
 * `meshrc.yaml.ejs` names `./src/platform/bff/mock-switch#mockSwitch`. A
 * standalone BFF has no such nesting — `.meshrc.yaml`, the composer and the
 * fixtures are siblings at the project root. Same decision, different layout.
 */
const MOCK_SWITCH_COMPOSER = './mock-switch#mockSwitch';

/** The cache guard from ADR-052, kept identical to the one in `meshrc.yaml.ejs`. */
const MOCK_SWITCH_CACHE_GUARD = "context.headers?.get?.('x-bff-mode') == null";

/**
 * Project the manifest's `mockSwitch` flag onto the Mesh config (ADR-052).
 *
 * `mockSwitch` is a DSL field, not a Mesh one: it expands into a
 * `resolversComposition` transform over `Query.*` plus a guard on the response
 * cache. Doing it here rather than in the caller means every route that reaches
 * `.meshrc.yaml` through `extractMeshConfig` — `bff:validate`, `bff:build`,
 * `bff:dev` — agrees on the expansion, and the raw flag never leaks into a file
 * Mesh has to parse.
 */
export function applyMockSwitch(meshConfig: MeshConfig, data: DSLDataSection): void {
  if (!data.mockSwitch?.enabled) return;

  const transforms = meshConfig.transforms ? [...meshConfig.transforms] : [];
  const alreadyDeclared = transforms.some((t) => 'resolversComposition' in t);

  // A hand-authored composition wins: the manifest is the source of truth
  // (ADR-012), and silently prepending a second one would give Mesh two
  // wrappers over the same resolvers.
  if (!alreadyDeclared) {
    transforms.unshift({
      resolversComposition: {
        mode: 'bare',
        compositions: [{ resolver: 'Query.*', composer: MOCK_SWITCH_COMPOSER }],
      },
    });
  }
  meshConfig.transforms = transforms;

  // Without this, a response cached from a live request is served to a mock
  // request and vice versa — the switch appears to not work at all.
  meshConfig.plugins = meshConfig.plugins?.map((plugin) =>
    plugin.responseCache
      ? { ...plugin, responseCache: { ...plugin.responseCache, if: MOCK_SWITCH_CACHE_GUARD } }
      : plugin,
  );
}

/**
 * Emit the two files the composer reference resolves to (ADR-052).
 *
 * `mock-switch.js` is generated and always refreshed; `mocks.json` is
 * developer-owned and never overwritten — the fixtures are the whole point of
 * demo mode, and clobbering them on every build would make the feature unusable.
 *
 * Returns the files it wrote, for the caller's `generatedFiles` list.
 */
export async function ensureMockSwitchFiles(targetDir: string): Promise<string[]> {
  const templateDir = path.resolve(__dirname, '..', 'templates');
  const written: string[] = [];

  const composerTemplate = path.join(templateDir, 'mock-switch.js.ejs');
  if (!await fs.pathExists(composerTemplate)) {
    throw new SystemError(`Demo-mode template not found: ${composerTemplate}`);
  }
  await fs.writeFile(
    path.join(targetDir, 'mock-switch.js'),
    await fs.readFile(composerTemplate, 'utf8'),
    'utf8',
  );
  written.push('mock-switch.js');

  const fixturesPath = path.join(targetDir, 'mocks.json');
  if (!await fs.pathExists(fixturesPath)) {
    await fs.writeFile(
      fixturesPath,
      await fs.readFile(path.join(templateDir, 'mocks.json.ejs'), 'utf8'),
      'utf8',
    );
    written.push('mocks.json');
  }

  console.log(chalk.green('✓ Generated demo-mode mock switch (ADR-052)'));
  return written;
}

/**
 * Write Mesh configuration to .meshrc.yaml.
 * REQ-BFF-001: CLI extracts data: section and writes to .meshrc.yaml
 */
export async function writeMeshConfig(meshConfig: MeshConfig, targetDir: string): Promise<string> {
  const meshrcPath = path.join(targetDir, '.meshrc.yaml');
  const meshrcContent = yaml.dump(meshConfig, { indent: 2, lineWidth: 120, noRefs: true });
  await fs.writeFile(meshrcPath, meshrcContent, 'utf8');
  console.log(chalk.green('✓ Generated .meshrc.yaml'));
  return meshrcPath;
}

/**
 * Add Mesh dependencies to an existing package.json.
 */
export async function addMeshDependencies(targetDir: string): Promise<void> {
  const pkgPath = path.join(targetDir, 'package.json');

  if (!await fs.pathExists(pkgPath)) {
    console.log(chalk.yellow('No package.json found, skipping dependency update'));
    return;
  }

  interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  }

  const pkg: PackageJson = await fs.readJson(pkgPath);

  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies['@graphql-mesh/serve-runtime'] = '^1.2.4';
  pkg.dependencies['@graphql-tools/delegate'] = '^10.2.4';
  pkg.dependencies['@graphql-tools/utils'] = '^9.2.1';
  pkg.dependencies['@graphql-tools/wrap'] = '^10.0.5';
  pkg.dependencies['@graphql-mesh/plugin-response-cache'] = '^0.104.20';
  pkg.dependencies['graphql'] = '^16.8.1';
  pkg.dependencies['tslib'] = '^2.6.0';
  pkg.dependencies['cors'] = pkg.dependencies['cors'] || '^2.8.5';
  pkg.dependencies['helmet'] = pkg.dependencies['helmet'] || '^8.1.0';

  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies['@graphql-mesh/cli'] = '^0.100.21';
  pkg.devDependencies['@graphql-mesh/openapi'] = '^0.109.26';

  pkg.scripts = pkg.scripts || {};
  pkg.scripts['mesh:build'] = 'mesh build';
  pkg.scripts['mesh:dev'] = 'mesh dev';
  pkg.scripts['mesh:validate'] = 'mesh validate';
  pkg.scripts['bff:dev'] = 'concurrently "npm run mesh:dev" "tsx watch server.ts"';

  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies['concurrently'] = '^8.2.2';
  pkg.devDependencies['tsx'] = '^4.6.2';

  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  console.log(chalk.green('✓ Updated package.json with Mesh dependencies'));
}
