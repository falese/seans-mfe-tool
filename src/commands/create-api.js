const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { execSync } = require('child_process');
const { DatabaseGenerator } = require('../utils/DatabaseGenerator');
const { ControllerGenerator } = require('../utils/ControllerGenerator');
const { generateRoutes } = require('../utils/RouteGenerator');

function validateDatabaseType(dbType) {
  const validDatabases = ['mongodb', 'mongo', 'sqlite', 'sql'];
  if (!validDatabases.includes(dbType.toLowerCase())) {
    throw new Error(`Unsupported database type: ${dbType}. Valid options are: ${validDatabases.join(', ')}`);
  }
  return true;
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

async function ensureMiddleware(middlewareDir) {
  const middleware = {
    'auth.js': `const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');

function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Authorization token required');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid authorization token'));
  }
}

module.exports = { auth };`,

    'validator.js': `const createError = require('http-errors');
const { ValidationError } = require('../utils/errors');

function validateSchema(property, schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      next(new ValidationError('Validation Error', errors));
      return;
    }
    next();
  };
}

module.exports = { validateSchema };`,

    'error-handler.js': `const logger = require('../utils/logger');
const { BaseError, ValidationError, UnauthorizedError } = require('../utils/errors');

function errorHandler(err, req, res, next) {
  // Log error details
  logger.error('Request failed:', {
    requestId: req.id,
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack
  });

  // Handle known errors
  if (err instanceof BaseError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details && { details: err.details })
      }
    });
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

module.exports = errorHandler;`,

    'request-id.js': `const { nanoid } = require('nanoid');

function requestId(req, res, next) {
  req.id = nanoid();
  res.setHeader('X-Request-ID', req.id);
  next();
}

module.exports = requestId;`
  };

  for (const [file, content] of Object.entries(middleware)) {
    const filePath = path.join(middlewareDir, file);
    await fs.writeFile(filePath, content);
    console.log(chalk.green(`✓ Generated middleware: ${file}`));
  }
}

async function ensureUtils(utilsDir) {
  const utils = {
    'logger.js': `const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;`,

    'errors.js': `class BaseError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends BaseError {
  constructor(message, details) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends BaseError {
  constructor(message) {
    super(message, 401);
  }
}

class NotFoundError extends BaseError {
  constructor(message) {
    super(message, 404);
  }
}

class ConflictError extends BaseError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = {
  BaseError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError
};`,

    'response.js': `function success(res, data = null, message = 'Success') {
  return res.json({
    success: true,
    message,
    ...(data && { data })
  });
}

function paginate(res, { items, total, page, limit }) {
  return res.json({
    success: true,
    data: items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
}

module.exports = {
  success,
  paginate
};`
  };

  for (const [file, content] of Object.entries(utils)) {
    const filePath = path.join(utilsDir, file);
    await fs.writeFile(filePath, content);
    console.log(chalk.green(`✓ Generated utility: ${file}`));
  }
}

async function processTemplates(targetDir, vars) {
  try {
    await mergePackageJson(targetDir, vars.database, vars);
    await processConfigFiles(targetDir, vars);
    await generateEnvironmentFiles(targetDir, vars);
  } catch (error) {
    throw new Error(`Failed to process templates: ${error.message}`);
  }
}

async function mergePackageJson(targetDir, dbType, vars) {
  try {
    const basePkgPath = path.join(targetDir, 'package.json');
    const dbPkgPath = path.join(targetDir, `package.json.addon`);
    
    let basePkg = await fs.readJson(basePkgPath);
    basePkg.name = vars.name;
    basePkg.version = vars.version;

    if (await fs.pathExists(dbPkgPath)) {
      const dbPkg = await fs.readJson(dbPkgPath);
      basePkg = {
        ...basePkg,
        scripts: { ...basePkg.scripts, ...dbPkg.scripts },
        dependencies: { ...basePkg.dependencies, ...dbPkg.dependencies },
        devDependencies: { ...basePkg.devDependencies, ...dbPkg.devDependencies }
      };
      await fs.remove(dbPkgPath);
    }

    // Ensure core scripts and dependencies
    basePkg.scripts = {
      "start": "node src/index.js",
      "dev": "nodemon src/index.js",
      "test": "jest",
      "lint": "eslint .",
      ...basePkg.scripts
    };

    // Add database-specific scripts
    if (dbType.includes('mongo')) {
      basePkg.scripts["db:seed"] = "node src/database/seed.js";
      basePkg.scripts["db:reset"] = "node src/database/reset.js";
    } else {
      basePkg.scripts["db:migrate"] = "sequelize-cli db:migrate";
      basePkg.scripts["db:migrate:undo"] = "sequelize-cli db:migrate:undo";
      basePkg.scripts["db:seed"] = "sequelize-cli db:seed:all";
      basePkg.scripts["db:reset"] = "node src/database/reset.js";
    }

    // Core dependencies
    basePkg.dependencies = {
      "@apidevtools/swagger-parser": "^10.1.0",
      "compression": "^1.7.4",
      "cors": "^2.8.5",
      "dotenv": "^16.0.3",
      "express": "^4.18.2",
      "helmet": "^7.0.0",
      "http-errors": "^2.0.0",
      "joi": "^17.9.2",
      "jsonwebtoken": "^9.0.2",
      "winston": "^3.8.2",
      ...basePkg.dependencies
    };

    // Database-specific dependencies
    if (dbType.includes('mongo')) {
      basePkg.dependencies = {
        ...basePkg.dependencies,
        "mongoose": "^8.1.1",
        "mongodb-memory-server": "^9.1.6"
      };
    } else {
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

    // Dev dependencies
    basePkg.devDependencies = {
      "eslint": "^8.40.0",
      "jest": "^29.5.0",
      "nodemon": "^2.0.22",
      "supertest": "^6.3.3",
      ...basePkg.devDependencies
    };

    // Sort dependencies
    basePkg.dependencies = Object.fromEntries(
      Object.entries(basePkg.dependencies).sort()
    );
    basePkg.devDependencies = Object.fromEntries(
      Object.entries(basePkg.devDependencies).sort()
    );

    await fs.writeJson(basePkgPath, basePkg, { spaces: 2 });
    console.log(chalk.green('✓ Generated package.json'));
  } catch (error) {
    throw new Error(`Failed to process package.json: ${error.message}`);
  }
}

async function processConfigFiles(targetDir, vars) {
  const configFiles = [
    'src/config.js',
    'src/config/database.js',
    'src/index.js'
  ];

  for (const file of configFiles) {
    const filePath = path.join(targetDir, file);
    if (await fs.pathExists(filePath)) {
      let content = await fs.readFile(filePath, 'utf8');
      content = content
        .replace(/__PROJECT_NAME__/g, vars.name)
        .replace(/__PORT__/g, vars.port)
        .replace(/__VERSION__/g, vars.version)
        .replace(/__DATABASE__/g, vars.database);
      await fs.writeFile(filePath, content);
      console.log(chalk.green(`✓ Processed ${file}`));
    }
  }
}

async function generateEnvironmentFiles(targetDir, vars) {
  const envContent = `# Server Configuration
NODE_ENV=development
PORT=${vars.port}
API_VERSION=${vars.version}

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1d

# Database Configuration
${vars.database.includes('mongo') ? 
  'MONGODB_URI=mongodb://localhost:27017/' + vars.name.toLowerCase() :
  'DB_PATH=./src/database/development.sqlite'}

# Logging
LOG_LEVEL=debug

# CORS
CORS_ORIGIN=*`;

  const envPath = path.join(targetDir, '.env');
  const envExamplePath = path.join(targetDir, '.env.example');

  await fs.writeFile(envPath, envContent);
  await fs.writeFile(envExamplePath, envContent);
  
  console.log(chalk.green('✓ Generated environment files'));
}

async function generateDatabaseInit(targetDir, dbType) {
  const initPath = path.join(targetDir, 'src', 'database', 'init.js');
  const content = dbType.toLowerCase().includes('mongo') ? 
    generateMongoInitContent() : 
    generateSqliteInitContent();

  await fs.writeFile(initPath, content);
  console.log(chalk.green('✓ Generated database initialization script'));
}

function generateMongoInitContent() {
  return `const mongoose = require('mongoose');
const { SchemaManager } = require('../utils/schemaManager');

async function initializeDatabase() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/your_database';
    
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('MongoDB connected successfully');

    // Initialize schema management
    await SchemaManager.initialize();
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

module.exports = initializeDatabase;`;
}

function generateSqliteInitContent() {
  return `const { sequelize } = require('../models');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    // Test connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Run migrations if in development
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Development database synchronized');
    }

    logger.info('Database initialization complete');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

module.exports = initializeDatabase;`;
}



async function createApiCommand(name, options) {
  let tmpSpec = null;
  try {
    console.log(chalk.blue(`Creating API "${name}"...`));
    
    const projectRoot = path.resolve(__dirname, '..');
    const baseTemplateDir = path.join(projectRoot, 'templates/api/base');
    const targetDir = path.resolve(process.cwd(), name);
    
    const dbType = options.database?.toLowerCase() || 'sqlite';
    validateDatabaseType(dbType);
    
    console.log(chalk.blue('\nParsing OpenAPI specification...'));
    tmpSpec = await loadOASSpec(options.spec);
    const spec = await SwaggerParser.dereference(tmpSpec);
    
    await fs.ensureDir(targetDir);
    await fs.copy(baseTemplateDir, targetDir);
    
    const dbTemplateDir = path.join(projectRoot, `templates/api/${dbType}`);
    if (await fs.pathExists(dbTemplateDir)) {
      await fs.copy(dbTemplateDir, targetDir, { overwrite: true });
    }
    
    const dirs = {
      routes: path.join(targetDir, 'src', 'routes'),
      controllers: path.join(targetDir, 'src', 'controllers'),
      models: path.join(targetDir, 'src', 'models'),
      middleware: path.join(targetDir, 'src', 'middleware'),
      utils: path.join(targetDir, 'src', 'utils'),
      database: path.join(targetDir, 'src', 'database'),
      config: path.join(targetDir, 'src', 'config')
    };

    // Ensure all directories exist
    await Promise.all(Object.values(dirs).map(dir => fs.ensureDir(dir)));

    console.log(chalk.blue('\nGenerating project structure...'));
    await ensureMiddleware(dirs.middleware);
    await ensureUtils(dirs.utils);

    console.log(chalk.blue(`\nGenerating API with ${dbType} database...`));

    try {
      // Generate all components in parallel
      await Promise.all([
        DatabaseGenerator.generate(dbType, targetDir, spec),
        ControllerGenerator.generate(dbType, dirs.controllers, spec),
        generateRoutes(dirs.routes, spec)
      ]);

      console.log(chalk.green('✓ Generated API components successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to generate API components:'));
      console.error(error);
      throw error;
    }
    
    // Process templates and configurations
    await processTemplates(targetDir, {
      name,
      version: spec.info.version || '1.0.0',
      database: dbType,
      port: options.port || 3001
    });

    // Generate database initialization
    await generateDatabaseInit(targetDir, dbType);

    // Install dependencies
    console.log(chalk.blue('\nInstalling dependencies...'));
    execSync('npm install', { 
      cwd: targetDir, 
      stdio: 'inherit',
      env: { 
        ...process.env, 
        ADBLOCK: '1',
        DISABLE_OPENCOLLECTIVE: '1',
        NO_UPDATE_NOTIFIER: '1'
      }
    });

    // Success output
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

function logSuccessInfo(name, dbType, spec, options) {
  console.log(chalk.green('\n✓ API created successfully!'));
  
  console.log(chalk.blue(`\nAPI Structure generated from ${options.spec}:`));
  console.log(`Database: ${dbType}`);
  console.log(`Routes: ${Object.keys(spec.paths).length}`);
  console.log(`Models: ${Object.keys(spec.components?.schemas || {}).length}`);
  console.log(`Port: ${options.port || 3001}`);
  
  console.log('\nProject Structure:');
  console.log('src/');
  console.log('  ├── config/         # Configuration files');
  console.log('  ├── controllers/    # Route handlers');
  console.log('  ├── database/       # Database related files');
  console.log('  ├── middleware/     # Express middleware');
  console.log('  ├── models/         # Database models');
  console.log('  ├── routes/         # API routes');
  console.log('  └── utils/          # Utility functions');
  
  console.log('\nAvailable Scripts:');
  console.log('  npm start          # Start the production server');
  console.log('  npm run dev        # Start development server with hot reload');
  console.log('  npm test           # Run tests');
  console.log('  npm run lint       # Run linter');
  
  if (dbType.includes('mongo')) {
    console.log('  npm run db:seed    # Seed the database with sample data');
    console.log('  npm run db:reset   # Reset database to initial state');
  } else {
    console.log('  npm run db:migrate # Run database migrations');
    console.log('  npm run db:seed    # Seed the database with sample data');
  }
  
  console.log('\nNext steps:');
  console.log(chalk.blue(`1. cd ${name}`));
  
  if (dbType.includes('mongo')) {
    console.log(chalk.blue('2. Configure MongoDB connection in .env file'));
    console.log(chalk.blue('3. Run npm run db:seed to initialize the database'));
  } else {
    console.log(chalk.blue('2. Run npm run db:migrate to create database tables'));
    console.log(chalk.blue('3. Run npm run db:seed to add sample data'));
  }
  
  console.log(chalk.blue('4. npm run dev'));
  
  console.log('\nAPI Documentation:');
  console.log(chalk.blue(`http://localhost:${options.port || 3001}/api-docs`));
}

module.exports = {
  createApiCommand,
  // Export other functions for testing
  validateDatabaseType,
  ensureMiddleware,
  ensureUtils,
  processTemplates,
  generateDatabaseInit,
  logSuccessInfo
};