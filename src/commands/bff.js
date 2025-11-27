/**
 * BFF Commands - GraphQL Mesh CLI Integration
 * Following ADR-046: GraphQL Mesh with DSL-embedded configuration
 * Implements REQ-BFF-001 through REQ-BFF-008
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const yaml = require('js-yaml');
const { execSync, spawn } = require('child_process');
const { processTemplates } = require('../utils/templateProcessor');

/**
 * Extract Mesh configuration from DSL data: section
 * REQ-BFF-001: DSL Data Section as Mesh Configuration
 * 
 * @param {string} manifestPath - Path to mfe-manifest.yaml
 * @returns {object} Extracted Mesh configuration
 */
async function extractMeshConfig(manifestPath) {
  const absolutePath = path.resolve(process.cwd(), manifestPath);
  
  if (!await fs.pathExists(absolutePath)) {
    throw new Error(`Manifest not found: ${absolutePath}`);
  }

  const manifestContent = await fs.readFile(absolutePath, 'utf8');
  const manifest = yaml.load(manifestContent);

  if (!manifest.data) {
    throw new Error('No "data:" section found in manifest. BFF requires data configuration.');
  }

  if (!manifest.data.sources || manifest.data.sources.length === 0) {
    throw new Error('No sources defined in data: section. At least one OpenAPI source is required.');
  }

  // Extract Mesh-compatible config from data: section
  const meshConfig = {
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
 * @param {object} meshConfig - Mesh configuration object
 * @param {string} targetDir - Directory to write .meshrc.yaml
 */
async function writeMeshConfig(meshConfig, targetDir) {
  const meshrcPath = path.join(targetDir, '.meshrc.yaml');
  const meshrcContent = yaml.dump(meshConfig, { 
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });

  await fs.writeFile(meshrcPath, meshrcContent, 'utf8');
  console.log(chalk.green(`✓ Generated .meshrc.yaml`));
  
  return meshrcPath;
}

/**
 * Validate Mesh configuration syntax
 * REQ-BFF-005: mfe bff:validate - Validates Mesh config syntax
 * 
 * @param {object} options - Command options
 */
async function bffValidateCommand(options = {}) {
  try {
    console.log(chalk.blue('Validating BFF configuration...'));

    const manifestPath = options.manifest || 'mfe-manifest.yaml';
    const { meshConfig, manifest } = await extractMeshConfig(manifestPath);

    // Validate sources
    console.log(chalk.blue('\nValidating sources...'));
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
          console.log(chalk.yellow(`⚠ OpenAPI spec not found: ${specPath}`));
        } else {
          console.log(chalk.green(`✓ Source "${source.name}": ${specPath}`));
        }
      } else {
        console.log(chalk.green(`✓ Source "${source.name}": ${specPath} (remote)`));
      }
    }

    // Validate transforms if present
    if (meshConfig.transforms) {
      console.log(chalk.blue('\nValidating transforms...'));
      const validTransforms = ['prefix', 'rename', 'filterSchema', 'encapsulate', 'namingConvention'];
      for (const transform of meshConfig.transforms) {
        const transformType = Object.keys(transform)[0];
        if (!validTransforms.includes(transformType)) {
          console.log(chalk.yellow(`⚠ Unknown transform type: ${transformType}`));
        } else {
          console.log(chalk.green(`✓ Transform: ${transformType}`));
        }
      }
    }

    // Validate plugins if present
    if (meshConfig.plugins) {
      console.log(chalk.blue('\nValidating plugins...'));
      const knownPlugins = ['responseCache', 'rateLimit', 'prometheus', 'depthLimit', 'csrf'];
      for (const plugin of meshConfig.plugins) {
        const pluginName = Object.keys(plugin)[0];
        if (!knownPlugins.includes(pluginName)) {
          console.log(chalk.yellow(`⚠ Unknown plugin: ${pluginName} (may require additional package)`));
        } else {
          console.log(chalk.green(`✓ Plugin: ${pluginName}`));
        }
      }
    }

    console.log(chalk.green('\n✓ BFF configuration is valid'));
    
    return { valid: true, meshConfig, manifest };

  } catch (error) {
    console.error(chalk.red('\n✗ Validation failed:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Build BFF artifacts
 * REQ-BFF-005: mfe bff:build - Extracts DSL → .meshrc.yaml → mesh build
 * 
 * @param {object} options - Command options
 */
async function bffBuildCommand(options = {}) {
  try {
    console.log(chalk.blue('Building BFF...'));

    // First validate
    const { meshConfig } = await bffValidateCommand(options);

    const targetDir = options.cwd || process.cwd();

    // Write .meshrc.yaml
    console.log(chalk.blue('\nExtracting Mesh configuration...'));
    await writeMeshConfig(meshConfig, targetDir);

    // Check if mesh CLI is available
    const meshrcPath = path.join(targetDir, '.meshrc.yaml');
    
    console.log(chalk.blue('\nRunning mesh build...'));
    
    try {
      execSync('npx mesh build', {
        cwd: targetDir,
        stdio: 'inherit',
        env: { ...process.env }
      });
    } catch (meshError) {
      // Check if it's a missing dependency issue
      if (meshError.message.includes('mesh') || meshError.status === 127) {
        console.log(chalk.yellow('\nGraphQL Mesh CLI not found. Installing...'));
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

    console.log(chalk.green('\n✓ BFF build complete'));
    console.log(chalk.blue('\nGenerated artifacts:'));
    console.log('  .meshrc.yaml    - Mesh configuration');
    console.log('  .mesh/          - Generated Mesh runtime');

  } catch (error) {
    console.error(chalk.red('\n✗ BFF build failed:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Start BFF development server
 * REQ-BFF-005: mfe bff:dev - Development mode with hot reload
 * 
 * @param {object} options - Command options
 */
async function bffDevCommand(options = {}) {
  try {
    console.log(chalk.blue('Starting BFF development server...'));

    // Validate and extract config first
    const { meshConfig } = await bffValidateCommand(options);
    const targetDir = options.cwd || process.cwd();

    // Write .meshrc.yaml
    await writeMeshConfig(meshConfig, targetDir);

    console.log(chalk.blue('\nStarting mesh dev...'));
    
    // Use spawn for interactive process
    const meshDev = spawn('npx', ['mesh', 'dev'], {
      cwd: targetDir,
      stdio: 'inherit',
      shell: true
    });

    meshDev.on('error', (error) => {
      console.error(chalk.red('Failed to start mesh dev:'), error.message);
    });

    meshDev.on('close', (code) => {
      if (code !== 0) {
        console.log(chalk.yellow(`mesh dev exited with code ${code}`));
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      meshDev.kill('SIGINT');
    });

  } catch (error) {
    console.error(chalk.red('\n✗ BFF dev failed:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Initialize a new BFF project
 * REQ-BFF-005: mfe bff:init - Standalone BFF project or add to existing
 * 
 * @param {string} name - Project name
 * @param {object} options - Command options
 */
async function bffInitCommand(name, options = {}) {
  try {
    const isAddToExisting = !name;
    const targetDir = isAddToExisting 
      ? process.cwd() 
      : path.resolve(process.cwd(), name);

    if (isAddToExisting) {
      console.log(chalk.blue('Adding BFF to existing project...'));
      
      // Check if manifest exists
      const manifestPath = path.join(targetDir, 'mfe-manifest.yaml');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No mfe-manifest.yaml found. Run this command in an MFE project directory or provide a name for a new project.');
      }
    } else {
      console.log(chalk.blue(`Creating BFF project "${name}"...`));
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
    const sources = specs.length > 0 
      ? specs.map((spec, index) => ({
          name: path.basename(spec, path.extname(spec)).replace(/[^a-zA-Z0-9]/g, '') + 'API',
          spec: spec
        }))
      : [{ name: 'DefaultAPI', spec: './specs/api.yaml' }];

    const templateVars = {
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
    console.log(chalk.blue('\nGenerating BFF files...'));

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
      console.log(chalk.blue('\nInstalling dependencies...'));
      execSync('npm install', {
        cwd: targetDir,
        stdio: 'inherit',
        env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
      });
    }

    console.log(chalk.green('\n✓ BFF initialized successfully!'));
    
    console.log('\nGenerated files:');
    console.log('  server.ts           - Express + Mesh server');
    console.log('  Dockerfile          - Production container');
    console.log('  docker-compose.yaml - Local development');
    if (!isAddToExisting) {
      console.log('  mfe-manifest.yaml   - DSL configuration');
      console.log('  package.json        - Dependencies');
    }
    console.log('  specs/              - OpenAPI specifications');

    console.log('\nNext steps:');
    if (!isAddToExisting) {
      console.log(chalk.blue(`1. cd ${name}`));
      console.log(chalk.blue('2. Add your OpenAPI spec(s) to specs/ directory'));
    } else {
      console.log(chalk.blue('1. Add your OpenAPI spec(s) to specs/ directory'));
    }
    console.log(chalk.blue(`${isAddToExisting ? '2' : '3'}. Update data: section in mfe-manifest.yaml`));
    console.log(chalk.blue(`${isAddToExisting ? '3' : '4'}. Run: npm run dev`));
    console.log(`\nGraphQL endpoint will be at: http://localhost:${port}/graphql`);

  } catch (error) {
    console.error(chalk.red('\n✗ BFF init failed:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

/**
 * Add Mesh dependencies to existing package.json
 */
async function addMeshDependencies(targetDir) {
  const pkgPath = path.join(targetDir, 'package.json');
  
  if (!await fs.pathExists(pkgPath)) {
    console.log(chalk.yellow('No package.json found, skipping dependency update'));
    return;
  }

  const pkg = await fs.readJson(pkgPath);
  
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
  console.log(chalk.green('✓ Updated package.json with Mesh dependencies'));
}

module.exports = {
  bffBuildCommand,
  bffDevCommand,
  bffValidateCommand,
  bffInitCommand,
  extractMeshConfig,
  writeMeshConfig,
  addMeshDependencies
};
