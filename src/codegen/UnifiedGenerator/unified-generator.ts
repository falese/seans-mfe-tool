/**
 * Unified MFE Codegen Generator
 * Consolidates feature/component and platform/BFF codegen
 * Implements ADR-048, REQ-REMOTE-003, ADR-062
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import ejs from 'ejs';
import type { DSLManifest, CapabilityConfig, CapabilityEntry } from '../../dsl/schema';

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
    utils: '^10.5.7',
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
    namingConvention: '^0.105.19',
    rateLimit: '^0.105.19',
    filterSchema: '^0.105.19',
    resolversComposition: '^0.105.19',
    cache: '^0.105.19',
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
    invalidate: { ttl: 0 },
  },
  
  // Production observability (standard tier)
  prometheus: {
    enabled: true,
    port: 9090,
    endpoint: '/metrics',
  },
  
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
    typeNames: 'PascalCase',
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
  const remotes = manifest.dependencies?.mfes || {};
  
  // Extract performance/observability config from manifest (ADR-062)
  const performanceConfig = (manifest as any).performance || {};
  const observabilityConfig = performanceConfig.observability || {};
  
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
      if (safeConfig.lifecycle) {
        for (const phase of ['before', 'main', 'after', 'error']) {
          if (safeConfig.lifecycle[phase]) {
            for (const hookEntry of safeConfig.lifecycle[phase]) {
              for (const hookName of Object.keys(hookEntry)) {
                if (!lifecycleHookNames.has(hookName)) {
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
  for (const entry of manifest.capabilities) {
    for (const [name, config] of Object.entries(entry)) {
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
  // Generate BaseMFE, types, tests, BFF, .meshrc.yaml
  // .meshrc.yaml from manifest.data
  if (manifest.data) {
    const yaml = require('js-yaml');
    const meshConfigYaml = yaml.dump(manifest.data, { noRefs: true });
    files.push({
      path: path.join(basePath, '.meshrc.yaml'),
      content: await renderTemplate(path.join(bffTemplateDir, 'meshrc.yaml.ejs'), { ...vars, meshConfigYaml }),
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
  const bffPort = vars.port || 4000;
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
