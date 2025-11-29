/**
 * Unified MFE Codegen Generator
 * Consolidates feature/component and platform/BFF codegen
 * Implements ADR-048, REQ-REMOTE-003
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import ejs from 'ejs';
import type { DSLManifest, CapabilityConfig, CapabilityEntry } from './schema';

export interface GeneratedFile {
  path: string;
  content: string;
  overwrite: boolean;
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
  const muiVersion = manifest.dependencies?.['design-system']?.['@mui/material'] || '^5.15.0';
  const remotes = manifest.dependencies?.mfes || {};
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
    manifest
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
      content: await renderTemplate(path.join(bffTemplateDir, 'meshrc.yaml.ejs'), { meshConfigYaml }),
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
    }
  }

  // TODO: Add additional config/template processing as needed

  return files;
}
