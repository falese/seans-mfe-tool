const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { execSync } = require('child_process');
const { DatabaseGenerator } = require('../utils/databaseGenerator');
const { ControllerGenerator } = require('../utils/ControllerGenerator/');
const { generateRoutes } = require('../utils/RouteGenerator');
const { ensureMiddleware, ensureUtils } = require('../utils/ensureFiles');
const { processTemplates } = require('../utils/templateProcessor');

async function createApiCommand(name, options) {
  let tmpSpec = null;
  try {
    console.log(chalk.blue(`Creating API "${name}"...`));
    
    const projectRoot = path.resolve(__dirname, '..', '..');
    const baseTemplateDir = path.join(projectRoot, 'src/templates/api/base');
    const targetDir = path.resolve(process.cwd(), name);
    
    // Get database type from options, default to sqlite
    const dbType = options.database?.toLowerCase() || 'sqlite';
    
    // Validate database option
    validateDatabaseType(dbType);
    
    // Parse and dereference OAS spec
    console.log(chalk.blue('\nParsing OpenAPI specification...'));
    tmpSpec = await loadOASSpec(options.spec);
    const spec = await SwaggerParser.dereference(tmpSpec);
    
    // Create project structure from base template
    await fs.ensureDir(targetDir);
    if (await fs.pathExists(baseTemplateDir)) {
      await fs.copy(baseTemplateDir, targetDir);
    } else {
      throw new Error(`Base template directory not found: ${baseTemplateDir}`);
    }
    
    // Copy database-specific templates
    const dbTemplateDir = path.join(projectRoot, `src/templates/api/${dbType}`);
    if (await fs.pathExists(dbTemplateDir)) {
      await fs.copy(dbTemplateDir, targetDir, { overwrite: true });
    } else {
      throw new Error(`Database template directory not found: ${dbTemplateDir}`);
    }
    
    // Generate API components
    const routesDir = path.join(targetDir, 'src', 'routes');
    const controllersDir = path.join(targetDir, 'src', 'controllers');
    const modelsDir = path.join(targetDir, 'src', 'models');
    const middlewareDir = path.join(targetDir, 'src', 'middleware');
    const utilsDir = path.join(targetDir, 'src', 'utils');

    // Ensure directories exist
    await Promise.all([
      fs.ensureDir(routesDir),
      fs.ensureDir(controllersDir),
      fs.ensureDir(modelsDir),
      fs.ensureDir(middlewareDir),
      fs.ensureDir(utilsDir)
    ]);

    // Ensure middleware and utilities exist
    await ensureMiddleware(middlewareDir);
    await ensureUtils(utilsDir);

    console.log(chalk.blue(`\nGenerating API with ${dbType} database...`));

    // Initialize controller generator with options
    const controllerOptions = {
      dbType,
      logger: true,
      validation: true,
      errorHandling: true
    };

    // Generate components in parallel
    try {
      await Promise.all([
        DatabaseGenerator.generate(dbType, targetDir, spec),
        ControllerGenerator.generate(dbType, controllersDir, spec),
        generateRoutes(routesDir, spec)
      ]);
      console.log(chalk.green('✓ Generated API components successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to generate API components:'));
      console.error(error);
      throw error;
    }
    
    // Process package.json and other templates
    await processTemplates(targetDir, {
      name,
      version: spec.info.version || '1.0.0',
      database: dbType,
      port: options.port || 3001
    });

    // Install dependencies
    console.log(chalk.blue('\nInstalling dependencies...'));
    execSync('npm install', { 
      cwd: targetDir, 
      stdio: 'inherit',
      env: { ...process.env, ADBLOCK: '1' }
    });

    // Log success information
    logSuccessInfo(name, dbType, spec, options);

  } catch (error) {
    console.error(chalk.red('\nFailed to create API:'));
    console.error(error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function validateDatabaseType(dbType) {
  const validDatabases = ['mongodb', 'mongo', 'sqlite', 'sql'];
  if (!validDatabases.includes(dbType)) {
    throw new Error(`Unsupported database type: ${dbType}. Valid options are: ${validDatabases.join(', ')}`);
  }
}

async function loadOASSpec(specPath) {
  try {
    if (specPath.startsWith('http')) {
      return await SwaggerParser.parse(specPath);
    }
    const localPath = path.resolve(process.cwd(), specPath);
    return await SwaggerParser.parse(localPath);
  } catch (error) {
    throw new Error(`Failed to parse OpenAPI spec: ${error.message}`);
  }
}

function logSuccessInfo(name, dbType, spec, options) {
  console.log(chalk.green('\n✓ API created successfully!'));
  console.log(chalk.blue(`\nAPI Structure generated from ${options.spec}:`));
  console.log(`Database: ${dbType}`);
  console.log(`Routes: ${Object.keys(spec.paths).length}`);
  console.log(`Controllers: ${Object.keys(spec.paths).length}`);
  console.log(`Models: ${Object.keys(spec.components?.schemas || {}).length}`);
  
  console.log('\nNext steps:');
  console.log(chalk.blue(`1. cd ${name}`));
  if (dbType === 'mongodb') {
    console.log(chalk.blue('2. Configure MongoDB connection in .env file'));
  } else if (dbType === 'sqlite') {
    console.log(chalk.blue('2. Run npm run db:migrate to initialize the database'));
  }
  console.log(chalk.blue('3. npm run dev'));
}

module.exports = {
  createApiCommand
};
