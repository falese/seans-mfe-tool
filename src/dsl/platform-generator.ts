/**
 * Platform File Generator
 * Generates BaseMFE, types, tests, and BFF files from manifest using EJS templates
 * Implements REQ-REMOTE-003, ADR-048
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import ejs from 'ejs';
import type { DSLManifest } from './schema';

export interface PlatformFile {
  path: string;
  content: string;
  overwrite: boolean;
}

/**
 * Render an EJS template file with variables
 */
async function renderTemplate(templatePath: string, vars: Record<string, any>): Promise<string> {
  const template = await fs.readFile(templatePath, 'utf8');
  return ejs.render(template, vars);
}

/**
 * Generate all platform files (BaseMFE, types, tests, BFF) for a remote
 */
export async function generatePlatformFiles(manifest: DSLManifest, basePath: string): Promise<PlatformFile[]> {
  const files: PlatformFile[] = [];
  const platformDir = path.join(basePath, 'src', 'platform', 'base-mfe');
  const bffDir = path.join(basePath, 'src', 'platform', 'bff');

  // Prepare template paths
  const mfeTemplate = path.resolve(__dirname, '../templates/base-mfe/mfe.ts.ejs');
  const mfeTestTemplate = path.resolve(__dirname, '../templates/base-mfe/mfe.test.ts.ejs');
  const typesTemplate = path.resolve(__dirname, '../templates/base-mfe/types.ts.ejs');
  const bffTemplate = path.resolve(__dirname, '../templates/bff/bff.ts.ejs');
  const bffTestTemplate = path.resolve(__dirname, '../templates/bff/bff.test.ts.ejs');
  const meshrcTemplate = path.resolve(__dirname, '../templates/bff/meshrc.yaml.ejs');
  // Render .meshrc.yaml from manifest.data
  if (manifest.data) {
    // Convert manifest.data to YAML string
    const yaml = require('js-yaml');
    const meshConfigYaml = yaml.dump(manifest.data, { noRefs: true });
    files.push({
      path: path.join(basePath, '.meshrc.yaml'),
      content: await renderTemplate(meshrcTemplate, { meshConfigYaml }),
      overwrite: true
    });
  }

  // Prepare variables
  const className = manifest.name.replace(/[^a-zA-Z0-9]/g, '') + 'MFE';
  const inputTypeName = className + 'Inputs';
  const outputTypeName = className + 'Outputs';

  // Aggregate capabilities and lifecycle hooks from all CapabilityEntry objects
  const capabilities: Array<{ method: string; config: any; returnTypeBase: string }> = [];
  const lifecycleHookNames = new Set<string>();
  const lifecycleHooks: Array<{ name: string }> = [];
  let inputs: any[] = [];
  let outputs: any[] = [];

  // Platform capability mapping: name → { method, returnType }
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


  // Render BaseMFE class
  files.push({
    path: path.join(platformDir, 'mfe.ts'),
    content: await renderTemplate(mfeTemplate, {
      className,
      manifest,
      capabilities,
      lifecycleHooks,
      description: manifest.description
    }),
    overwrite: true
  });

  // Render BaseMFE test
  files.push({
    path: path.join(platformDir, 'mfe.test.ts'),
    content: await renderTemplate(mfeTestTemplate, {
      className,
      manifest,
      capabilities,
      lifecycleHooks,
      description: manifest.description
    }),
    overwrite: true
  });

  // Debug: log context for types template
  const typesContext = {
    capabilities,
    description: manifest.description
  };
  // eslint-disable-next-line no-console
  console.log('[DEBUG] types.ts.ejs context:', JSON.stringify(typesContext, null, 2));
  files.push({
    path: path.join(platformDir, 'types.ts'),
    content: await renderTemplate(typesTemplate, typesContext),
    overwrite: true
  });

  // Render BFF
  files.push({
    path: path.join(bffDir, 'bff.ts'),
    content: await renderTemplate(bffTemplate, {
      bffClassName: className + 'BFF',
      manifest,
      description: manifest.description
    }),
    overwrite: true
  });

  // Render BFF test
  files.push({
    path: path.join(bffDir, 'bff.test.ts'),
    content: await renderTemplate(bffTestTemplate, {
      bffClassName: className + 'BFF',
      manifest,
      description: manifest.description
    }),
    overwrite: true
  });

  return files;
}
