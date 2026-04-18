/**
 * Shared BFF helpers — underscore prefix makes oclif skip this file.
 * Following ADR-046: GraphQL Mesh with DSL-embedded configuration.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import * as yaml from 'js-yaml';

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
  [key: string]: unknown;
}

export interface MeshPlugin {
  responseCache?: { ttl: number };
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

export interface DSLDataSection {
  sources: MeshSource[];
  transforms?: MeshTransform[];
  plugins?: MeshPlugin[];
  serve?: MeshServe;
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
    throw new Error(`Manifest not found: ${absolutePath}`);
  }

  const manifestContent = await fs.readFile(absolutePath, 'utf8');
  const manifest = yaml.load(manifestContent) as MFEManifest;

  if (!manifest.data) {
    throw new Error('No "data:" section found in manifest. BFF requires data configuration.');
  }

  if (!manifest.data.sources || manifest.data.sources.length === 0) {
    throw new Error('No sources defined in data: section. At least one OpenAPI source is required.');
  }

  const meshConfig: MeshConfig = {
    sources: manifest.data.sources,
    ...(manifest.data.transforms && { transforms: manifest.data.transforms }),
    ...(manifest.data.plugins && { plugins: manifest.data.plugins }),
    serve: manifest.data.serve || { endpoint: '/graphql', playground: true }
  };

  return { meshConfig, manifest, manifestPath: absolutePath };
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
  pkg.dependencies['@graphql-mesh/cli'] = '^0.100.0';
  pkg.dependencies['@graphql-mesh/openapi'] = '^1.0.0';
  pkg.dependencies['@graphql-mesh/plugin-response-cache'] = '^0.104.0';
  pkg.dependencies['graphql'] = '^16.8.1';
  pkg.dependencies['cors'] = pkg.dependencies['cors'] || '^2.8.5';
  pkg.dependencies['helmet'] = pkg.dependencies['helmet'] || '^7.1.0';

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
