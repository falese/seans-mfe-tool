const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { execSync } = require('child_process');
const { DatabaseGenerator } = require('../utils/databaseGenerator');
const { ControllerGenerator } = require('../utils/controllerGenerator');
const { generateRoutes } = require('../utils/routeGenerator');

async function createApiCommand(name, options) {
  try {
    console.log(chalk.blue(`Creating API "${name}"...`));
    
    const projectRoot = path.resolve(__dirname, '..', '..');
    const baseTemplateDir = path.join(projectRoot, 'src/templates/api/base');
    const targetDir = path.resolve(process.cwd(), name);
    
    // Get database type from options, default to sqlite
    const dbType = options.database?.toLowerCase() || 'sqlite';
    
    // Parse OAS spec
    const spec = await loadOASSpec(options.spec);
    
    // Create project structure from base template
    await fs.ensureDir(targetDir);
    await fs.copy(baseTemplateDir, targetDir);
    
    // Copy database-specific templates
    const dbTemplateDir = path.join(projectRoot, `src/templates/api/${dbType}`);
    if (await fs.pathExists(dbTemplateDir)) {
      await fs.copy(dbTemplateDir, targetDir, { overwrite: true });
    }
    
    // Generate API components
    const routesDir = path.join(targetDir, 'src', 'routes');
    const controllersDir = path.join(targetDir, 'src', 'controllers');
    const modelsDir = path.join(targetDir, 'src', 'models');

    // Ensure directories exist
    await Promise.all([
      fs.ensureDir(routesDir),
      fs.ensureDir(controllersDir),
      fs.ensureDir(modelsDir)
    ]);

    console.log(chalk.blue(`\nGenerating API with ${dbType} database...`));

    // Generate components
    await DatabaseGenerator.generate(dbType, targetDir, spec);
    await ControllerGenerator.generate(dbType, controllersDir, spec);
    await generateRoutes(routesDir, spec);
    
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

    console.log(chalk.green('\n✓ API created successfully!'));
    console.log(chalk.blue(`\nAPI Structure generated from ${options.spec}:`));
    console.log(`Database: ${dbType}`);
    console.log(`Routes: ${Object.keys(spec.paths).length}`);
    console.log(`Models: ${Object.keys(spec.components?.schemas || {}).length}`);
    
    console.log('\nNext steps:');
    console.log(chalk.blue(`1. cd ${name}`));
    if (dbType === 'mongodb') {
      console.log(chalk.blue('2. Configure MongoDB connection in .env file'));
    } else if (dbType === 'sqlite') {
      console.log(chalk.blue('2. Run npm run db:migrate to initialize the database'));
    }
    console.log(chalk.blue('3. npm run dev'));

  } catch (error) {
    console.error(chalk.red('\nFailed to create API:'));
    console.error(error.message);
    process.exit(1);
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

async function processTemplates(targetDir, vars) {
  // Process package.json
  await mergePackageJson(targetDir, vars.database, vars);
  
  // Process other template files
  const files = [
    'src/config.js',
    '.env.example'
  ];

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    if (await fs.pathExists(filePath)) {
      let content = await fs.readFile(filePath, 'utf8');
      content = content
        .replace(/__PROJECT_NAME__/g, vars.name)
        .replace(/__PORT__/g, vars.port)
        .replace(/__VERSION__/g, vars.version)
        .replace(/__DATABASE__/g, vars.database);
      await fs.writeFile(filePath, content);
    }
  }
}

async function mergePackageJson(targetDir, dbType, vars) {
    try {
      // Get paths
      const basePkgPath = path.join(targetDir, 'package.json');
      const dbPkgPath = path.join(targetDir, `package.json.addon`);
      
      // Read base package.json
      let basePkg = await fs.readJson(basePkgPath);
      
      // Replace template variables in base package.json
      basePkg.name = vars.name;
      basePkg.version = vars.version;
  
      // Read database-specific package.json if it exists
      if (await fs.pathExists(dbPkgPath)) {
        const dbPkg = await fs.readJson(dbPkgPath);
        
        // Deep merge the packages
        basePkg = {
          ...basePkg,
          scripts: {
            ...basePkg.scripts,
            ...dbPkg.scripts
          },
          dependencies: {
            ...basePkg.dependencies,
            ...dbPkg.dependencies
          },
          devDependencies: {
            ...basePkg.devDependencies,
            ...dbPkg.devDependencies
          }
        };
  
        // Clean up addon file
        await fs.remove(dbPkgPath);
      }
  
      // Ensure scripts section exists and has required scripts
      basePkg.scripts = {
        "start": "node src/index.js",
        "dev": "nodemon src/index.js --watch src",
        "test": "jest",
        "lint": "eslint .",
        ...basePkg.scripts
      };
  
      // Add any database-specific scripts
      if (dbType === 'mongodb') {
        basePkg.scripts = {
          ...basePkg.scripts,
          "db:seed": "node src/database/seed.js",
          "db:reset": "node src/database/reset.js"
        };
      } else if (dbType === 'sqlite') {
        basePkg.scripts = {
          ...basePkg.scripts,
          "db:migrate": "sequelize-cli db:migrate",
          "db:migrate:undo": "sequelize-cli db:migrate:undo",
          "db:seed": "sequelize-cli db:seed:all",
          "db:reset": "node src/database/reset.js"
        };
      }
  
      // Add database-specific dependencies
      if (dbType === 'mongodb') {
        basePkg.dependencies = {
          ...basePkg.dependencies,
          "mongoose": "^8.1.1",
          "mongodb-memory-server": "^9.1.6"
        };
      } else if (dbType === 'sqlite') {
        basePkg.dependencies = {
          ...basePkg.dependencies,
          "sequelize": "^6.35.2",
          "sqlite3": "^5.1.7"
        };
        basePkg.devDependencies = {
          ...basePkg.devDependencies,
          "sequelize-cli": "^6.6.2"
        };
      }
  
      // Ensure core dependencies
      basePkg.dependencies = {
        ...basePkg.dependencies,
        "compression": "^1.7.4",
        "cors": "^2.8.5",
        "dotenv": "^16.0.3",
        "express": "^4.18.2",
        "helmet": "^7.0.0",
        "joi": "^17.9.2",
        "jsonwebtoken": "9.0.2",
        "nanoid": "^3.3.6",
        "winston": "^3.8.2",
        "@apidevtools/swagger-parser": "^10.1.0",
        "js-yaml": "^4.1.0"
      };
  
      // Ensure dev dependencies
      basePkg.devDependencies = {
        ...basePkg.devDependencies,
        "eslint": "^8.40.0",
        "jest": "^29.5.0",
        "nodemon": "^2.0.22",
        "supertest": "^6.3.3"
      };
  
      // Sort dependencies alphabetically
      basePkg.dependencies = Object.fromEntries(
        Object.entries(basePkg.dependencies).sort(([a], [b]) => a.localeCompare(b))
      );
      basePkg.devDependencies = Object.fromEntries(
        Object.entries(basePkg.devDependencies).sort(([a], [b]) => a.localeCompare(b))
      );
  
      // Write the merged package.json with proper formatting
      await fs.writeJson(basePkgPath, basePkg, { spaces: 2 });
      
      console.log(chalk.green('✓ Generated package.json'));
    } catch (error) {
      console.error(chalk.red('Error merging package.json:'), error);
      throw error;
    }
  }

module.exports = {
  createApiCommand
};