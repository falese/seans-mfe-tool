/**
 * BFF Commands - GraphQL Mesh CLI Integration
 * Following ADR-046: GraphQL Mesh with DSL-embedded configuration
 * Following ADR-048: Incremental TypeScript migration
 * Implements REQ-BFF-001 through REQ-BFF-008
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import * as yaml from 'js-yaml';
import { execSync, spawn, ChildProcess } from 'child_process';
import { processTemplates } from '../utils/templateProcessor';
import { createLogger } from '@seans-mfe-tool/logger';

// ============================================================================
// Type Definitions
// ============================================================================

/** OpenAPI source handler configuration */
interface OpenAPIHandler {
  source: string;
  operationHeaders?: Record<string, string>;
}

/** Mesh source configuration */
interface MeshSource {
  name: string;
  handler: {
    openapi: OpenAPIHandler;
  };
  transforms?: MeshTransform[];
}

/** Mesh transform configuration */
interface MeshTransform {
  prefix?: { value: string; includeRootOperations?: boolean };
  rename?: Record<string, string>;
  filterSchema?: { filters: string[] };
  encapsulate?: { applyTo: { query: boolean; mutation: boolean } };
  namingConvention?: { typeNames: string; fieldNames: string };
  [key: string]: unknown;
}

/** Mesh plugin configuration */
interface MeshPlugin {
  responseCache?: { ttl: number };
  rateLimit?: { config: Array<{ type: string; field: string; max: number; window: string }> };
  prometheus?: Record<string, unknown>;
  depthLimit?: { maxDepth: number };
  csrf?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Mesh serve configuration */
interface MeshServe {
  endpoint: string;
  playground: boolean;
}

/** DSL data section - maps to Mesh configuration */
interface DSLDataSection {
  sources: MeshSource[];
  transforms?: MeshTransform[];
  plugins?: MeshPlugin[];
  serve?: MeshServe;
}

/** MFE Manifest structure */
interface MFEManifest {
  name: string;
  version?: string;
  type?: string;
  data?: DSLDataSection;
  [key: string]: unknown;
}

/** Extracted Mesh configuration */
interface MeshConfig {
  sources: MeshSource[];
  transforms?: MeshTransform[];
  plugins?: MeshPlugin[];
  serve: MeshServe;
}

/** Result of extractMeshConfig */
interface ExtractMeshConfigResult {
  meshConfig: MeshConfig;
  manifest: MFEManifest;
  manifestPath: string;
}

/** BFF command options */
interface BFFCommandOptions {
  manifest?: string;
  cwd?: string;
  port?: number;
  specs?: string[];
  static?: boolean;
  version?: string;
}

/** Validation result */
interface ValidationResult {
  valid: boolean;
  meshConfig: MeshConfig;
  manifest: MFEManifest;
}

/** Template source for bff:init */
interface TemplateSource {
  name: string;
  spec: string;
}

/** Template variables for EJS processing */
interface TemplateVars {
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
// Logger Configuration
// ============================================================================

const logger = createLogger({ context: 'bff' });

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extract Mesh configuration from DSL data: section
 * REQ-BFF-001: DSL Data Section as Mesh Configuration
 * 
 * @param manifestPath - Path to mfe-manifest.yaml
 * @returns Extracted Mesh configuration
 */
async function extractMeshConfig(manifestPath: string): Promise<ExtractMeshConfigResult> {
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

  // Extract Mesh-compatible config from data: section
  const meshConfig: MeshConfig = {
    sources: manifest.data.sources,
    ...(manifest.data.transforms && { transforms: manifest.data.transforms }),
    ...(manifest.data.plugins && { plugins: manifest.data.plugins }),
    serve: manifest.data.serve || { endpoint: '/graphql', playground: true }
  };

  return {
    meshConfig,
    manifest,
    manifestPath: absolutePath
  };
}

/**
 * Write Mesh configuration to .meshrc.yaml
 * REQ-BFF-001: CLI extracts data: section and writes to .meshrc.yaml
 * 
 * @param meshConfig - Mesh configuration object
 * @param targetDir - Directory to write .meshrc.yaml
 * @returns Path to written file
 */
async function writeMeshConfig(meshConfig: MeshConfig, targetDir: string): Promise<string> {
  const meshrcPath = path.join(targetDir, '.meshrc.yaml');
  const meshrcContent = yaml.dump(meshConfig, { 
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });

  await fs.writeFile(meshrcPath, meshrcContent, 'utf8');
  logger.success('Generated .meshrc.yaml');

  return meshrcPath;
}

/**
 * Validate Mesh configuration syntax
 * REQ-BFF-005: mfe bff:validate - Validates Mesh config syntax
 * 
 * @param options - Command options
 * @returns Validation result
 */
async function bffValidateCommand(options: BFFCommandOptions = {}): Promise<ValidationResult> {
  try {
    logger.info('Validating BFF configuration...');

    const manifestPath = options.manifest || 'mfe-manifest.yaml';
    const { meshConfig, manifest } = await extractMeshConfig(manifestPath);

    // Validate sources
    logger.info('\nValidating sources...');
    for (const source of meshConfig.sources) {
      if (!source.name) {
        throw new Error('Each source must have a "name" property');
      }
      if (!source.handler?.openapi?.source) {
        throw new Error(`Source "${source.name}" is missing handler.openapi.source`);
      }

      const specPath = source.handler.openapi.source;
      if (!specPath.startsWith('http')) {
        const absoluteSpecPath = path.resolve(process.cwd(), specPath);
        if (!await fs.pathExists(absoluteSpecPath)) {
          logger.warn(`OpenAPI spec not found: ${specPath}`);
        } else {
          logger.success(`Source "${source.name}": ${specPath}`);
        }
      } else {
        logger.success(`Source "${source.name}": ${specPath} (remote)`);
      }
    }

    // Validate transforms if present
    if (meshConfig.transforms) {
      logger.info('\nValidating transforms...');
      const validTransforms = ['prefix', 'rename', 'filterSchema', 'encapsulate', 'namingConvention'];
      for (const transform of meshConfig.transforms) {
        const transformType = Object.keys(transform)[0];
        if (!validTransforms.includes(transformType)) {
          logger.warn(`Unknown transform type: ${transformType}`);
        } else {
          logger.success(`Transform: ${transformType}`);
        }
      }
    }

    // Validate plugins if present
    if (meshConfig.plugins) {
      logger.info('\nValidating plugins...');
      const knownPlugins = ['responseCache', 'rateLimit', 'prometheus', 'depthLimit', 'csrf'];
      for (const plugin of meshConfig.plugins) {
        const pluginName = Object.keys(plugin)[0];
        if (!knownPlugins.includes(pluginName)) {
          logger.warn(`Unknown plugin: ${pluginName} (may require additional package)`);
        } else {
          logger.success(`Plugin: ${pluginName}`);
        }
      }
    }

    logger.success('\nBFF configuration is valid');

    return { valid: true, meshConfig, manifest };

  } catch (error) {
    logger.error('\nValidation failed:');
    logger.error((error as Error).message);
    throw error;
  }
}

/**
 * Build BFF artifacts
 * REQ-BFF-005: mfe bff:build - Extracts DSL → .meshrc.yaml → mesh build
 * 
 * @param options - Command options
 */
async function bffBuildCommand(options: BFFCommandOptions = {}): Promise<void> {
  try {
    logger.info('Building BFF...');

    // First validate
    const { meshConfig } = await bffValidateCommand(options);

    const targetDir = options.cwd || process.cwd();

    // Write .meshrc.yaml
    logger.info('\nExtracting Mesh configuration...');
    await writeMeshConfig(meshConfig, targetDir);

    // Check if mesh CLI is available
    const meshrcPath = path.join(targetDir, '.meshrc.yaml');
    
    logger.info('\nRunning mesh build...');
    
    try {
      execSync('npx mesh build', {
        cwd: targetDir,
        stdio: 'inherit',
        env: { ...process.env }
      });
    } catch (meshError) {
      // Check if it's a missing dependency issue
      if ((meshError as Error).message.includes('mesh') || (meshError as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info(chalk.yellow('\nGraphQL Mesh CLI not found. Installing...'));
        execSync('npm install @graphql-mesh/cli @graphql-mesh/openapi', {
          cwd: targetDir,
          stdio: 'inherit'
        });
        // Retry build
        execSync('npx mesh build', {
          cwd: targetDir,
          stdio: 'inherit'
        });
      } else {
        throw meshError;
      }
    }

    logger.info(chalk.green('\n✓ BFF build complete'));
    logger.info('\nGenerated artifacts:');
    logger.info('  .meshrc.yaml    - Mesh configuration');
    logger.info('  .mesh/          - Generated Mesh runtime');

  } catch (error) {
    logger.error('\nBFF build failed:');
    logger.error((error as Error).message);
    throw error;
  }
}

/**
 * Start BFF development server
 * REQ-BFF-005: mfe bff:dev - Development mode with hot reload
 * 
 * @param options - Command options
 */
async function bffDevCommand(options: BFFCommandOptions = {}): Promise<void> {
  try {
    logger.info('Starting BFF development server...');

    // Validate and extract config first
    const { meshConfig } = await bffValidateCommand(options);
    const targetDir = options.cwd || process.cwd();

    // Write .meshrc.yaml
    await writeMeshConfig(meshConfig, targetDir);

    logger.info('\nStarting mesh dev...');
    
    // Use spawn for interactive process
    const meshDev: ChildProcess = spawn('npx', ['mesh', 'dev'], {
      cwd: targetDir,
      stdio: 'inherit',
      shell: true
    });

    meshDev.on('error', (error: Error) => {
      logger.error('Failed to start mesh dev:', { error: error.message });
    });

    meshDev.on('close', (code: number | null) => {
      if (code !== 0) {
        logger.warn(`mesh dev exited with code ${code}`);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      meshDev.kill('SIGINT');
    });

  } catch (error) {
    logger.error('\nBFF dev failed:');
    logger.error((error as Error).message);
    throw error;
  }
}

/**
 * Initialize a new BFF project
 * REQ-BFF-005: mfe bff:init - Standalone BFF project or add to existing
 * 
 * @param name - Project name
 * @param options - Command options
 */
async function bffInitCommand(name: string | undefined, options: BFFCommandOptions = {}): Promise<void> {
  try {
    const isAddToExisting = !name;
    const targetDir = isAddToExisting 
      ? process.cwd() 
      : path.resolve(process.cwd(), name);

    if (isAddToExisting) {
      logger.info('Adding BFF to existing project...');
      
      // Check if manifest exists
      const manifestPath = path.join(targetDir, 'mfe-manifest.yaml');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No mfe-manifest.yaml found. Run this command in an MFE project directory or provide a name for a new project.');
      }
    } else {
      logger.info(`Creating BFF project "${name}"...`);
    }

    const templateDir = path.resolve(__dirname, '..', 'templates', 'bff');

    // Verify template directory exists
    if (!await fs.pathExists(templateDir)) {
      throw new Error(`BFF template directory not found: ${templateDir}`);
    }

    // Create target directory if new project
    if (!isAddToExisting) {
      await fs.ensureDir(targetDir);
    }

    // Determine template variables
    const port = options.port || 3000;
    const specs = options.specs || [];
    const includeStatic = options.static !== false && !isAddToExisting;

    // Build sources array from specs
    const sources: TemplateSource[] = specs.length > 0 
      ? specs.map((spec) => ({
          name: path.basename(spec, path.extname(spec)).replace(/[^a-zA-Z0-9]/g, '') + 'API',
          spec: spec
        }))
      : [{ name: 'DefaultAPI', spec: './specs/api.yaml' }];

    const templateVars: TemplateVars = {
      name: name || path.basename(targetDir),
      version: options.version || '1.0.0',
      port,
      type: isAddToExisting ? 'feature' : 'bff',
      includeStatic,
      sources,
      transforms: [],
      plugins: [],
      playground: true
    };

    // Copy and process templates
    logger.info('\nGenerating BFF files...');

    // Files to copy based on context
    const filesToCopy = [
      'server.ts.ejs',
      'Dockerfile.ejs',
      'docker-compose.yaml.ejs',
      'README.md.ejs',
      '.gitignore'
    ];

    // For new projects, also copy package.json and tsconfig
    if (!isAddToExisting) {
      filesToCopy.push('package.json.ejs', 'tsconfig.json', 'mfe-manifest.yaml.ejs');
    }

    for (const file of filesToCopy) {
      const srcPath = path.join(templateDir, file);
      if (await fs.pathExists(srcPath)) {
        // Keep .ejs extension so processTemplates can find and render them
        const destPath = path.join(targetDir, file);
        await fs.copy(srcPath, destPath);
      }
    }

    // Create specs directory
    const specsDir = path.join(targetDir, 'specs');
    await fs.ensureDir(specsDir);

    // Process EJS templates
    await processTemplates(targetDir, templateVars);

    // For existing projects, update package.json with mesh dependencies
    if (isAddToExisting) {
      await addMeshDependencies(targetDir);
    }

    // Install dependencies for new projects
    if (!isAddToExisting) {
      logger.info('\nInstalling dependencies...');
      execSync('npm install', {
        cwd: targetDir,
        stdio: 'inherit',
        env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
      });
    }

    logger.info(chalk.green('\n✓ BFF initialized successfully!'));
    
    logger.info('\nGenerated files:');
    logger.info('  server.ts           - Express + Mesh server');
    logger.info('  Dockerfile          - Production container');
    logger.info('  docker-compose.yaml - Local development');
    if (!isAddToExisting) {
      logger.info('  mfe-manifest.yaml   - DSL configuration');
      logger.info('  package.json        - Dependencies');
    }
    logger.info('  specs/              - OpenAPI specifications');

    logger.info('\nNext steps:');
    if (!isAddToExisting) {
      logger.info(`1. cd ${name}`);
      logger.info(chalk.blue('2. Add your OpenAPI spec(s) to specs/ directory'));
    } else {
      logger.info(chalk.blue('1. Add your OpenAPI spec(s) to specs/ directory'));
    }
    logger.info(`${isAddToExisting ? '2' : '3'}. Update data: section in mfe-manifest.yaml`);
    logger.info(`${isAddToExisting ? '3' : '4'}. Run: npm run dev`);
    logger.info(`\nGraphQL endpoint will be at: http://localhost:${port}/graphql`);

  } catch (error) {
    logger.error('\nBFF init failed:');
    logger.error((error as Error).message);
    throw error;
  }
}

/**
 * Add Mesh dependencies to existing package.json
 * @param targetDir - Directory containing package.json
 */
async function addMeshDependencies(targetDir: string): Promise<void> {
  const pkgPath = path.join(targetDir, 'package.json');
  
  if (!await fs.pathExists(pkgPath)) {
    logger.info(chalk.yellow('No package.json found, skipping dependency update'));
    return;
  }

  interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  }

  const pkg: PackageJson = await fs.readJson(pkgPath);
  
  // Add mesh dependencies
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies['@graphql-mesh/cli'] = '^0.100.0';
  pkg.dependencies['@graphql-mesh/openapi'] = '^1.0.0';
  pkg.dependencies['@graphql-mesh/plugin-response-cache'] = '^0.104.0';
  pkg.dependencies['graphql'] = '^16.8.1';
  pkg.dependencies['cors'] = pkg.dependencies['cors'] || '^2.8.5';
  pkg.dependencies['helmet'] = pkg.dependencies['helmet'] || '^7.1.0';

  // Add mesh scripts
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['mesh:build'] = 'mesh build';
  pkg.scripts['mesh:dev'] = 'mesh dev';
  pkg.scripts['mesh:validate'] = 'mesh validate';
  pkg.scripts['bff:dev'] = 'concurrently "npm run mesh:dev" "tsx watch server.ts"';

  // Add dev dependencies
  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies['concurrently'] = '^8.2.2';
  pkg.devDependencies['tsx'] = '^4.6.2';

  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  logger.success('Updated package.json with Mesh dependencies');
}

// ============================================================================
// Exports
// ============================================================================

export {
  bffBuildCommand,
  bffDevCommand,
  bffValidateCommand,
  bffInitCommand,
  extractMeshConfig,
  writeMeshConfig,
  addMeshDependencies
};

// Also export types for consumers
export type {
  MeshConfig,
  MeshSource,
  MeshTransform,
  MeshPlugin,
  MeshServe,
  MFEManifest,
  DSLDataSection,
  BFFCommandOptions,
  ValidationResult,
  ExtractMeshConfigResult
};
