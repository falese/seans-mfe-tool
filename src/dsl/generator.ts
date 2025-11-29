/**
 * Capability Generator
 * Following ADR-048: Incremental TypeScript migration
 * Implements REQ-REMOTE-003: Capability → File Structure
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { 
  DSLManifest, 
  CapabilityConfig, 
  CapabilityEntry,
  GeneratedFile,
  GenerationResult 
} from './schema';

// =============================================================================
// Template Generators
// =============================================================================

/**
 * Generate a feature component file
 */
function generateFeatureComponent(name: string, config: CapabilityConfig): string {
  const description = config.description || `${name} feature component`;
  
  return `/**
 * ${name} Feature Component
 * ${description}
 * 
 * Generated from mfe-manifest.yaml capability definition
 */

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export interface ${name}Props {
  // TODO: Define props based on capability inputs
}

/**
 * ${name} - ${description}
 */
export const ${name}: React.FC<${name}Props> = (props) => {
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        ${name}
      </Typography>
      <Box>
        {/* TODO: Implement ${name} */}
        <Typography variant="body2" color="text.secondary">
          ${description}
        </Typography>
      </Box>
    </Paper>
  );
};

export default ${name};
`;
}

/**
 * Generate a feature index file (barrel export)
 */
function generateFeatureIndex(name: string): string {
  return `/**
 * ${name} Feature - Public API
 */

export { ${name}, default } from './${name}';
export type { ${name}Props } from './${name}';
`;
}

/**
 * Generate a feature test file
 */
function generateFeatureTest(name: string): string {
  return `/**
 * ${name} Feature Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ${name} } from './${name}';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('${name}', () => {
  it('renders without crashing', () => {
    renderWithTheme(<${name} />);
    expect(screen.getByText('${name}')).toBeInTheDocument();
  });

  // TODO: Add more tests based on capability inputs/outputs
});
`;
}

/**
 * Generate remote.tsx that exports all capabilities
 */
function generateRemoteExports(capabilities: CapabilityEntry[]): string {
  const domainCapabilities = capabilities.flatMap(entry => 
    Object.entries(entry)
      .filter(([_, config]) => config.type === 'domain')
      .map(([name]) => name)
  );

  if (domainCapabilities.length === 0) {
    return `/**
 * Remote Entry Point
 * No domain capabilities defined yet.
 * 
 * Add capabilities to mfe-manifest.yaml and run 'mfe remote:generate'
 */

export {};
`;
  }
  
const imports = domainCapabilities
    .map(name => `import { ${name} } from './features/${name}';`)
    .join('\n');
  
  const exports = domainCapabilities
    .map(name => `export { ${name} };`)
    .join('\n');

  return `/**
 * Remote Entry Point
 * Exports all domain capabilities for Module Federation
 * 
 * Generated from mfe-manifest.yaml
 */

import React from 'react';

// Feature imports
${imports}

// Re-export features for Module Federation consumption
${exports}

// Default export for standalone rendering
export { default } from './App';
`;
}

/**
 * Generate rspack.config.js exposes section
 */
function generateModuleFederationExposes(
  capabilities: CapabilityEntry[],
  manifestName: string
): Record<string, string> {
  const exposes: Record<string, string> = {
    './App': './src/App'
  };

  for (const entry of capabilities) {
    for (const [name, config] of Object.entries(entry)) {
      if (config.type === 'domain') {
        exposes[`./${name}`] = `./src/features/${name}`;
      }
    }
  }

  return exposes;
}

// =============================================================================
// File Generation
// =============================================================================

/**
 * Generate files for a single capability
 */
export function generateCapabilityFiles(
  name: string,
  config: CapabilityConfig,
  basePath: string
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const featurePath = path.join(basePath, 'src', 'features', name);

  // Only generate for domain capabilities
  if (config.type !== 'domain') {
    return files;
  }

  // Feature component
  files.push({
    path: path.join(featurePath, `${name}.tsx`),
    content: generateFeatureComponent(name, config),
    overwrite: false  // Don't overwrite existing user code
  });

  // Feature index
  files.push({
    path: path.join(featurePath, 'index.ts'),
    content: generateFeatureIndex(name),
    overwrite: false
  });

  // Feature test
  files.push({
    path: path.join(featurePath, `${name}.test.tsx`),
    content: generateFeatureTest(name),
    overwrite: false
  });

  return files;
}

/**
 * Generate files for all capabilities in a manifest
 */
export async function generateAllCapabilityFiles(
  manifest: DSLManifest,
  basePath: string
): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  // Ensure src/index.tsx and src/App.tsx are generated for entry points
  const srcDir = path.join(basePath, 'src');
  const indexTsxPath = path.join(srcDir, 'index.tsx');
  const appTsxPath = path.join(srcDir, 'App.tsx');

  if (!await fs.pathExists(indexTsxPath)) {
    const indexTsxContent = `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\n\nconst root = createRoot(document.getElementById('root')!);\nroot.render(<App />);\n`;
    files.push({
      path: indexTsxPath,
      content: indexTsxContent,
      overwrite: false
    });
  }

  if (!await fs.pathExists(appTsxPath)) {
    const appTsxContent = `import React from 'react';\n\nconst App: React.FC = () => {\n  return (\n    <main>\n      <h1>${manifest.name}</h1>\n      <p>Welcome to your generated MFE!</p>\n    </main>\n  );\n};\n\nexport default App;\n`;
    files.push({
      path: appTsxPath,
      content: appTsxContent,
      overwrite: false
    });
  }

  // Ensure public/index.html is generated for dev server
  const publicDir = path.join(basePath, 'public');
  const indexHtmlPath = path.join(publicDir, 'index.html');
  if (!await fs.pathExists(indexHtmlPath)) {
    const defaultHtml = `<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>${manifest.name}</title>\n</head>\n<body>\n  <div id=\"root\"></div>\n</body>\n</html>\n`;
    files.push({
      path: indexHtmlPath,
      content: defaultHtml,
      overwrite: false
    });
  }

  for (const entry of manifest.capabilities) {
    for (const [name, config] of Object.entries(entry)) {
      files.push(...generateCapabilityFiles(name, config, basePath));
    }
  }

  // Generate remote.tsx exports
  files.push({
    path: path.join(basePath, 'src', 'remote.tsx'),
    content: generateRemoteExports(manifest.capabilities),
    overwrite: true  // Always regenerate exports
  });

  // Process root-level EJS templates (package.json, rspack.config.js)
  // These templates are in src/templates/react/remote/
  const templateDir = path.resolve(__dirname, '../templates/react/remote');
  const rootTemplates = [
    { name: 'package.json', ejs: 'package.json' },
    { name: 'rspack.config.js', ejs: 'rspack.config.js' }
  ];

  for (const tpl of rootTemplates) {
    const templatePath = path.join(templateDir, tpl.ejs);
    if (await fs.pathExists(templatePath)) {
      const templateContent = await fs.readFile(templatePath, 'utf8');
      // Prepare manifest variables for EJS
      const vars = {
        name: manifest.name,
        version: manifest.version,
        port: manifest.endpoint ? Number(manifest.endpoint.split(':').pop()) : 3001,
        muiVersion: manifest.dependencies?.['design-system']?.['@mui/material'] || '^5.15.0',
        remotes: manifest.dependencies?.mfes || {}
      };
      const renderedContent = require('ejs').render(templateContent, vars);
      files.push({
        path: path.join(basePath, tpl.name),
        content: renderedContent,
        overwrite: true
      });
    }
  }

  return files;
}

/**
 * Write generated files to disk
 * 
 * @param files - Files to write
 * @param options - Generation options
 * @returns Generation result
 */
export async function writeGeneratedFiles(
  files: GeneratedFile[],
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<GenerationResult> {
  const result: GenerationResult = {
    files: [],
    skipped: [],
    errors: []
  };

  for (const file of files) {
    try {
      const exists = await fs.pathExists(file.path);

      // Skip existing files unless force or overwrite flag
      if (exists && !file.overwrite && !options.force) {
        result.skipped.push(file.path);
        continue;
      }

      if (options.dryRun) {
        result.files.push(file);
        continue;
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(file.path));
      
      // Write file
      await fs.writeFile(file.path, file.content, 'utf8');
      result.files.push(file);

    } catch (error) {
      result.errors.push(`Failed to write ${file.path}: ${(error as Error).message}`);
    }
  }

  return result;
}

// =============================================================================
// Comparison Utilities
// =============================================================================

/**
 * Get capabilities that need to be generated (new since last generation)
 */
export async function getNewCapabilities(
  manifest: DSLManifest,
  basePath: string
): Promise<string[]> {
  const newCapabilities: string[] = [];

  for (const entry of manifest.capabilities) {
    for (const [name, config] of Object.entries(entry)) {
      if (config.type !== 'domain') continue;

      const featurePath = path.join(basePath, 'src', 'features', name, `${name}.tsx`);
      if (!await fs.pathExists(featurePath)) {
        newCapabilities.push(name);
      }
    }
  }

  return newCapabilities;
}

/**
 * Get capabilities that were removed from manifest but still have files
 */
export async function getRemovedCapabilities(
  manifest: DSLManifest,
  basePath: string
): Promise<string[]> {
  const removedCapabilities: string[] = [];
  const featuresPath = path.join(basePath, 'src', 'features');

  if (!await fs.pathExists(featuresPath)) {
    return removedCapabilities;
  }

  const currentCapabilities = new Set(
    manifest.capabilities.flatMap(entry => 
      Object.entries(entry)
        .filter(([_, config]) => config.type === 'domain')
        .map(([name]) => name)
    )
  );

  const existingDirs = await fs.readdir(featuresPath);
  
  for (const dir of existingDirs) {
    const stat = await fs.stat(path.join(featuresPath, dir));
    if (stat.isDirectory() && !currentCapabilities.has(dir)) {
      removedCapabilities.push(dir);
    }
  }

  return removedCapabilities;
}

// =============================================================================
// Module Federation Config Generation
// =============================================================================
/**
 * Generate Module Federation shared config from dependencies
 */
export function generateSharedConfig(manifest: DSLManifest): Record<string, object> {
  const shared: Record<string, object> = {};

  // Runtime dependencies become shared modules
  if (manifest.dependencies?.runtime) {
    for (const [pkg, version] of Object.entries(manifest.dependencies.runtime)) {
      shared[pkg] = {
        singleton: true,
        requiredVersion: version
      };
    }
  }

  // Design system dependencies
  if (manifest.dependencies?.['design-system']) {
    for (const [pkg, version] of Object.entries(manifest.dependencies['design-system'])) {
      shared[pkg] = {
        singleton: true,
        requiredVersion: version
      };
    }
  }

  return shared;
}

/**
 * Generate full rspack.config.js content
 */
export function generateRspackConfig(manifest: DSLManifest, port: number): string {
  const exposes = generateModuleFederationExposes(manifest.capabilities, manifest.name);
  const shared = generateSharedConfig(manifest);

  const exposesJson = JSON.stringify(exposes, null, 6).replace(/"/g, "'");
  const sharedJson = JSON.stringify(shared, null, 6).replace(/"/g, "'");

  return `const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const { defineConfig } = require('@rspack/cli');
const { HtmlRspackPlugin } = require('@rspack/core');
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');

const isDev = process.env.NODE_ENV === 'development';

module.exports = defineConfig({
  entry: './src/index.tsx',
  mode: isDev ? 'development' : 'production',
  devtool: isDev ? 'eval-source-map' : 'source-map',
  
  devServer: {
    port: ${port},
    hot: true,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },

  module: {
    rules: [
      {
        test: /\\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                  development: isDev,
                  refresh: isDev,
                },
              },
            },
          },
        },
      },
      {
        test: /\\.css$/,
        type: 'css',
      },
    ],
  },

  plugins: [
    new HtmlRspackPlugin({
      template: './public/index.html',
    }),
    isDev && new ReactRefreshPlugin(),
    new ModuleFederationPlugin({
      name: '${manifest.name.replace(/-/g, '_')}',
      filename: 'remoteEntry.js',
      exposes: ${exposesJson},
      shared: ${sharedJson},
    }),
  ].filter(Boolean),
});
`;
}
