/**
 * Unified MFE Codegen Generator
 * Consolidates feature/component and platform/BFF codegen
 * Implements ADR-048, REQ-REMOTE-003, ADR-062
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import ejs from 'ejs';
import type { DSLManifest, CapabilityConfig, CapabilityEntry } from '@seans-mfe-tool/dsl';

export interface GeneratedFile {
  path: string;
  content: string;
  overwrite: boolean;
}

// =============================================================================
// Dependency Version Constants (ADR-062)
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
  meshTransforms: {
    namingConvention: '0.105.19',
    rateLimit: '^1.0.0',
    filterSchema: '^1.0.0',
    resolversComposition: '^1.0.0',
    cache: '^1.0.0',
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
  
  // Module Federation
  moduleFederation: {
    enhancedRspack: '^0.1.1',
  },
  
  // Build Tools
  buildTools: {
    rspackCli: '^0.5.0',
    rspackCore: '^0.5.0',
    typescript: '^5.3.3',
    tsNode: '^10.9.1',
    concurrently: '^8.2.0',
    serve: '^14.2.1',
  },
  
  // Browser Polyfills (for rspack)
  polyfills: {
    buffer: '^6.0.3',
    cryptoBrowserify: '^3.12.0',
    streamBrowserify: '^3.0.0',
    streamHttp: '^3.2.0',
    httpsBrowserify: '^1.0.0',
    pathBrowserify: '^1.0.1',
    osBrowserify: '^0.3.0',
    assert: '^2.1.0',
    process: '^0.11.10',
    events: '^3.3.0',
    url: '^0.11.3',
    util: '^0.12.5',
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
// Validation Layer (ADR-062)
// =============================================================================

/**
 * NOTE: These validation constants are duplicated in src/utils/manifestValidator.js
 * for CLI pre-generation checks. Keep both in sync until TypeScript migration completes.
 * See ADR-048 for migration strategy.
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
    ? manifestPlugins.map(p => typeof p === 'string' ? p : Object.keys(p)[0])
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
    ? manifestTransforms.map(t => typeof t === 'string' ? t : Object.keys(t)[0])
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
    allWarnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  // Throw on errors (fatal - prevent bad generation)
  if (allErrors.length > 0) {
    console.error('\n❌ Manifest Configuration Errors:');
    allErrors.forEach(error => console.error(`  - ${error}`));
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
  const muiVersion = manifest.dependencies?.['design-system']?.['@mui/material'] || DEPENDENCY_VERSIONS.mui.material;
  
  // Filter out empty/invalid remote entries from YAML parsing issues
  const rawRemotes = manifest.dependencies?.mfes || {};
  const remotes: Record<string, any> = {};
  for (const [name, config] of Object.entries(rawRemotes)) {
    if (name && name.trim() && config && typeof config === 'object') {
      remotes[name] = config;
    }
  }
  
  // Extract performance/observability config from manifest (ADR-062)
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
    
    // NEW: Dependency versions for templates (ADR-062)
    dependencyVersions: DEPENDENCY_VERSIONS,
    
    // NEW: Track which plugins/transforms are needed (ADR-062)
    neededPlugins: Array.from(neededPlugins),
    neededTransforms: Array.from(neededTransforms),
    
    // NEW: Plugin/transform configs (ADR-062)
    meshPlugins: {
      responseCache: performanceConfig.caching?.enabled !== false ? DEFAULT_MESH_PLUGINS.responseCache : null,
      prometheus: observabilityConfig.prometheus?.enabled !== false ? {
        ...DEFAULT_MESH_PLUGINS.prometheus,
        ...observabilityConfig.prometheus,
      } : null,
      opentelemetry: observabilityConfig.opentelemetry?.enabled ? {
        ...DEFAULT_MESH_PLUGINS.opentelemetry,
        ...observabilityConfig.opentelemetry,
      } : null,
    },
    
    meshTransforms: {
      namingConvention: DEFAULT_MESH_TRANSFORMS.namingConvention,
      rateLimit: performanceConfig.rateLimit?.enabled ? performanceConfig.rateLimit : null,
      filterSchema: performanceConfig.filterSchema?.enabled ? performanceConfig.filterSchema : null,
      customTransforms: (manifest as any).transforms || [],
    },
  };
}

/**
 * Render an EJS template file with variables
 */
export async function renderTemplate(templatePath: string, vars: Record<string, any>): Promise<string> {
  const template = await fs.readFile(templatePath, 'utf8');
  return ejs.render(template, vars);
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
// Unified Generator Entrypoint
// =============================

/**
 * Generate all files (features, platform, BFF, configs) for a manifest
 */
export async function generateAllFiles(
  manifest: DSLManifest,
  basePath: string,
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<GeneratedFile[]> {
  // === Validation Layer (ADR-062) ===
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
    Emit: { method: 'emit', returnTypeBase: 'EmitResult' }
  };

  const capabilities: Array<{ method: string; config: any; returnTypeBase: string }> = [];
  const lifecycleHookNames = new Set<string>();
  const lifecycleHooks: Array<{ name: string }> = [];
  let inputs: any[] = [];
  let outputs: any[] = [];

  for (const entry of manifest.capabilities) {
    for (const [method, config] of Object.entries(entry)) {
      // Ensure inputs/outputs are always arrays
      const safeConfig = {
        ...config,
        inputs: Array.isArray(config.inputs) ? config.inputs : [],
        outputs: Array.isArray(config.outputs) ? config.outputs : []
      };
      if (platformCapabilities[method]) {
        capabilities.push({
          method: platformCapabilities[method].method,
          config: safeConfig,
          returnTypeBase: platformCapabilities[method].returnTypeBase
        });
      } else {
        capabilities.push({
          method,
          config: safeConfig,
          returnTypeBase: method + 'Outputs'
        });
      }
      // Collect lifecycle hooks from capability config, deduplicated
      // Filter out base capability names to prevent conflicts
      const baseCapabilityNames = Object.values(platformCapabilities).map(c => c.method);
      if (safeConfig.lifecycle) {
        for (const phase of ['before', 'main', 'after', 'error']) {
          if (safeConfig.lifecycle[phase]) {
            for (const hookEntry of safeConfig.lifecycle[phase]) {
              for (const hookName of Object.keys(hookEntry)) {
                // Skip if it's a base capability name OR already added
                if (!baseCapabilityNames.includes(hookName) && !lifecycleHookNames.has(hookName)) {
                  lifecycleHookNames.add(hookName);
                  lifecycleHooks.push({ name: hookName });
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

  // Standardized template directory
  const templateDir = path.resolve(__dirname, '../templates/base-mfe');
  const featureTplDir = path.join(templateDir, 'features');
  const featuresDir = path.join(basePath, 'src', 'features');
  // Platform/BFF directories and template paths
  const platformDir = path.join(basePath, 'src', 'platform', 'base-mfe');
  const bffDir = path.join(basePath, 'src', 'platform', 'bff');
  const bffTemplateDir = path.resolve(__dirname, '../templates/bff');

  // --- Feature/component generation ---
  // For each domain capability, generate feature, index, test
  const domainCapabilities: string[] = [];
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
      // Feature component
      files.push({
        path: path.join(featurePath, `${name}.tsx`),
        content: await renderTemplate(path.join(featureTplDir, 'feature.tsx.ejs'), { name, description: config.description || `${name} feature component` }),
        overwrite: false
      });
      // Feature index
      files.push({
        path: path.join(featurePath, 'index.ts'),
        content: await renderTemplate(path.join(featureTplDir, 'index.ts.ejs'), { name }),
        overwrite: false
      });
      // Feature test
      files.push({
        path: path.join(featurePath, `${name}.test.tsx`),
        content: await renderTemplate(path.join(featureTplDir, 'feature.test.tsx.ejs'), { name }),
        overwrite: false
      });
    }
  }
  // Remote entrypoint exports all domain capabilities
  files.push({
    path: path.join(basePath, 'src', 'remote.tsx'),
    content: await renderTemplate(path.join(featureTplDir, 'remote.tsx.ejs'), { capabilities: domainCapabilities }),
    overwrite: true
  });

  // --- Platform/BFF generation ---
  // Generate BaseMFE, types, tests, BFF, mesh.config.ts
  // mesh.config.ts from manifest.data (TypeScript-based configuration)
  if (manifest.data) {
    // Filter out empty/invalid sources from YAML parsing issues
    const validSources = (manifest.data.sources || []).filter(source => 
      source && 
      typeof source === 'object' && 
      source.name && 
      source.name.trim() &&
      source.handler
    );
    
    // Build mesh config object for TypeScript template
    const meshConfig: any = {
      sources: validSources,
      transforms: manifest.data.transforms || [],
      plugins: manifest.data.plugins || []
    };
    
    // Generate mesh.config.ts (TypeScript programmatic config)
    files.push({
      path: path.join(basePath, 'mesh.config.ts'),
      content: await renderTemplate(path.join(bffTemplateDir, 'mesh.config.ts.ejs'), { ...vars, meshConfig }),
      overwrite: true
    });
  }

  // BaseMFE class
  files.push({
    path: path.join(platformDir, 'mfe.ts'),
    content: await renderTemplate(path.join(templateDir, 'mfe.ts.ejs'), vars),
    overwrite: true
  });
  // BaseMFE test
  files.push({
    path: path.join(platformDir, 'mfe.test.ts'),
    content: await renderTemplate(path.join(templateDir, 'mfe.test.ts.ejs'), vars),
    overwrite: true
  });
  // types.ts
  files.push({
    path: path.join(platformDir, 'types.ts'),
    content: await renderTemplate(path.join(templateDir, 'types.ts.ejs'), vars),
    overwrite: true
  });

  // BFF stub files
  files.push({
    path: path.join(bffDir, 'bff.ts'),
    content: await renderTemplate(path.join(bffTemplateDir, 'bff.ts.ejs'), { ...vars, bffClassName: vars.className + 'BFF' }),
    overwrite: true
  });
  files.push({
    path: path.join(bffDir, 'bff.test.ts'),
    content: await renderTemplate(path.join(bffTemplateDir, 'bff.test.ts.ejs'), { ...vars, bffClassName: vars.className + 'BFF' }),
    overwrite: true
  });

  // BFF main server and config files
  const bffTemplates = [
    { tpl: 'server.ts.ejs', out: 'server.ts' },
    { tpl: 'package.json.ejs', out: 'package.json' },
    { tpl: 'tsconfig.json', out: 'tsconfig.json' },
    { tpl: 'Dockerfile.ejs', out: 'Dockerfile' },
    { tpl: 'docker-compose.yaml.ejs', out: 'docker-compose.yaml' },
    { tpl: 'README.md.ejs', out: 'README.md' }
  ];
  // BFF port = MFE port + 1000 (e.g., 3002 → 4002, following e2e2 pattern)
  const mfePort = vars.port || 3000;
  const bffPort = mfePort + 1000;
  const includeStatic = true;
  for (const { tpl, out } of bffTemplates) {
    const templatePath = path.join(bffTemplateDir, tpl);
    if (await fs.pathExists(templatePath)) {
      const content = await renderTemplate(templatePath, { ...vars, port: bffPort, includeStatic });
      files.push({
        path: path.join(basePath, out),
        content,
        overwrite: true
      });
    }
  }

  // --- Root/config files ---
  // Always use EJS templates for package.json, rspack.config.js, etc.
  const rootTemplates = [
    { name: 'package.json', ejs: 'package.json.ejs' },
    { name: 'rspack.config.js', ejs: 'rspack.config.js.ejs' }
  ];
  for (const tpl of rootTemplates) {
    const templatePath = path.join(templateDir, tpl.ejs);
    if (await fs.pathExists(templatePath)) {
      const renderedContent = await renderTemplate(templatePath, vars);
      files.push({
        path: path.join(basePath, tpl.name),
        content: renderedContent,
        overwrite: true
      });
    } else {
      // Diagnostic: warn if template missing
      // eslint-disable-next-line no-console
      console.warn(`[unified-generator] WARNING: Missing template for ${tpl.name}: ${templatePath}`);
    }
  }

  // --- Entry files ---
  // Generate src/App.tsx from EJS template
  const appTemplatePath = path.join(templateDir, 'App.tsx.ejs');
  const appOutPath = path.join(basePath, 'src', 'App.tsx');
  if (await fs.pathExists(appTemplatePath)) {
    const appContent = await renderTemplate(appTemplatePath, vars);
    files.push({
      path: appOutPath,
      content: appContent,
      overwrite: true
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
    const capabilityMetadata = domainCapabilities.map(name => {
      // Find the capability config to get icon/displayName
      const capEntry = manifest.capabilities.find(c => Object.keys(c).includes(name));
      const capConfig = capEntry?.[name];
      return {
        className: name,
        displayName: (capConfig as any)?.displayName || name,
        icon: (capConfig as any)?.icon || '📦'
      };
    });
    
    const indexContent = await renderTemplate(indexTemplatePath, { ...vars, capabilities: capabilityMetadata });
    files.push({
      path: indexOutPath,
      content: indexContent,
      overwrite: true
    });
  } else {
    // Diagnostic: warn if index.tsx template missing
    // eslint-disable-next-line no-console
    console.warn(`[unified-generator] WARNING: Missing template for index.tsx: ${indexTemplatePath}`);
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
      overwrite: true
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[unified-generator] WARNING: Missing template for public/index.html: ${indexHtmlTemplatePath}`);
  }
  
  // Generate public/demo.html (runtime demonstration page)
  const demoHtmlTemplatePath = path.join(templateDir, 'public', 'demo.html.ejs');
  if (await fs.pathExists(demoHtmlTemplatePath)) {
    const demoHtmlContent = await renderTemplate(demoHtmlTemplatePath, { ...vars, capabilities: domainCapabilities });
    files.push({
      path: path.join(publicDir, 'demo.html'),
      content: demoHtmlContent,
      overwrite: true
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[unified-generator] WARNING: Missing template for public/demo.html: ${demoHtmlTemplatePath}`);
  }
  
  if (await fs.pathExists(faviconTemplatePath)) {
    const faviconContent = await renderTemplate(faviconTemplatePath, vars);
    files.push({
      path: path.join(publicDir, 'favicon.ico'),
      content: faviconContent,
      overwrite: true
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[unified-generator] WARNING: Missing template for public/favicon.ico: ${faviconTemplatePath}`);
  }

  return files;
}
