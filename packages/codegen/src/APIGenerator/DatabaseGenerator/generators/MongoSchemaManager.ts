// @ts-nocheck - Migrated from JS, types need cleanup
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { NameGenerator  } from '../../utils/NameGenerator';
import { createLogger  } from '@seans-mfe-tool/logger';

const logger = createLogger({ context: 'codegen:mongo-schema', silent: process.env.NODE_ENV === 'test' });

class MongoSchemaManager {
    constructor(spec) {
        this.spec = spec;
    }
    async generateSchemaManagement(outputDir) {
        if (!this.spec.components?.schemas) {
            logger.info(chalk.yellow('No schemas found to generate schema management'));
            return;
        }
        const migrationsDir = path.join(outputDir, 'src', 'database', 'migrations');
        await fs.ensureDir(migrationsDir);
        // Generate schema version tracking model
        await this.generateVersionModel(outputDir);
        // Generate initial schema version
        await this.generateInitialVersion(migrationsDir);
        // Generate schema management utilities
        await this.generateSchemaUtils(outputDir);
        logger.info(chalk.green('✓ Generated MongoDB schema management files'));
    }
    async generateVersionModel(outputDir) {
        const modelPath = path.join(outputDir, 'src', 'models', 'schemaVersion.model.js');
        const content = `const mongoose = require('mongoose');
const { Schema } = mongoose;

const schemaVersionSchema = new Schema({
  version: {
    type: Number,
    required: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  models: [{
    name: String,
    version: Number
  }]
}, {
  timestamps: true,
  collection: 'schema_versions'
});

// Add methods for version management
schemaVersionSchema.statics.getCurrentVersion = async function() {
  const latest = await this.findOne().sort({ version: -1 });
  return latest ? latest.version : 0;
};

schemaVersionSchema.statics.recordVersion = async function(version, description, models) {
  return this.create({
    version,
    description,
    models
  });
};

const SchemaVersion = mongoose.model('SchemaVersion', schemaVersionSchema);

module.exports = SchemaVersion;`;
        await fs.writeFile(modelPath, content, 'utf8');
        logger.info('Generated schema version model');
    }
    async generateInitialVersion(migrationsDir) {
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const migrationPath = path.join(migrationsDir, `${timestamp}-initial-schema.js`);
        const content = `const mongoose = require('mongoose');
const Models = require('../../models');
const SchemaVersion = require('../../models/schemaVersion.model');
const { createLogger } = require('@seans-mfe-tool/logger');

const logger = createLogger({ context: 'migration' });

// Define the models and their initial versions
const initialSchemas = ${JSON.stringify(this.generateInitialSchemas(), null, 2)};

async function up() {
  logger.info('Applying initial schema version...');

  // Record the initial schema version
  await SchemaVersion.recordVersion(1, 'Initial schema creation',
    Object.keys(initialSchemas).map(model => ({
      name: model,
      version: 1
    }))
  );

  logger.info('Initial schema version applied');
}

async function down() {
  logger.info('Rolling back initial schema version...');

  // Drop all collections except schema versions
  const collections = Object.keys(initialSchemas);
  for (const collection of collections) {
    await mongoose.connection.collection(collection).drop();
  }

  // Remove version record
  await SchemaVersion.deleteOne({ version: 1 });

  logger.info('Initial schema version rolled back');
}

module.exports = {
  version: 1,
  description: 'Initial schema creation',
  up,
  down
};`;
        await fs.writeFile(migrationPath, content, 'utf8');
        logger.info(chalk.green('✓ Generated initial schema version'));
    }
    async generateSchemaUtils(outputDir) {
        const utilsPath = path.join(outputDir, 'src', 'utils', 'schemaManager.js');
        const content = `const fs = require('fs');
const path = require('path');
const SchemaVersion = require('../models/schemaVersion.model');
const { createLogger } = require('@seans-mfe-tool/logger');

const logger = createLogger({ context: 'schema-manager' });

class SchemaManager {
  static async initialize() {
    try {
      const currentVersion = await SchemaVersion.getCurrentVersion();
      logger.info('Current schema version:', currentVersion);

      const migrationsDir = path.join(__dirname, '../database/migrations');
      const migrations = this.getMigrationFiles(migrationsDir);

      await this.applyPendingMigrations(currentVersion, migrations);

    } catch (error) {
      logger.error('Failed to initialize schema:', error);
      throw error;
    }
  }

  static getMigrationFiles(migrationsDir) {
    return fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .map(file => ({
        file,
        migration: require(path.join(migrationsDir, file))
      }))
      .sort((a, b) => a.migration.version - b.migration.version);
  }

  static async applyPendingMigrations(currentVersion, migrations) {
    for (const { migration } of migrations) {
      if (migration.version > currentVersion) {
        logger.info(\`Applying migration ${'${migration.version}'}: ${'${migration.description}'}\`);
        try {
          await migration.up();
          logger.info(\`✓ Migration ${'${migration.version}'} applied successfully\`);
        } catch (error) {
          logger.error(\`Failed to apply migration ${'${migration.version}'}:\`, error);
          try {
            await migration.down();
            logger.info(\`✓ Rolled back migration ${'${migration.version}'}\`);
          } catch (rollbackError) {
            logger.error(\`Failed to rollback migration ${'${migration.version}'}:\`, rollbackError);
          }
          throw error;
        }
      }
    }
  }

  static async createMigration(description) {
    const currentVersion = await SchemaVersion.getCurrentVersion();
    const newVersion = currentVersion + 1;
    
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const fileName = \`${'${timestamp}'}-${'${description.toLowerCase().replace(/[^a-z0-9]+/g, "-")}'}.js\`;
    
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const filePath = path.join(migrationsDir, fileName);

    const template = \`import mongoose from 'mongoose';
import Models from '../../models';
import SchemaVersion from '../../models/schemaVersion.model';
import { createLogger  } from '@seans-mfe-tool/logger';

async function up() {
  await SchemaVersion.recordVersion(${'${newVersion}'}, '${'${description}'}', [
    // { name: 'ModelName', version: 1 }
  ]);
}

async function down() {
  await SchemaVersion.deleteOne({ version: ${'${newVersion}'} });
}

export {
  version: ${'${newVersion}'},
  description: '${'${description}'}',
  up,
  down
};\`;

    fs.writeFileSync(filePath, template);
    logger.info(\`✓ Created new migration: ${'${fileName}'}\`);
  }
}

module.exports = SchemaManager;
`;
        await fs.writeFile(utilsPath, content, 'utf8');
        logger.info('Generated schema management utilities');
    }
    generateInitialSchemas() {
        const schemas = {};
        for (const [schemaName, schema] of Object.entries(this.spec.components.schemas)) {
            const modelName = NameGenerator.toModelName(schemaName);
            const properties = schema && schema.properties ? Object.keys(schema.properties) : [];
            schemas[modelName] = {
                fields: properties,
                version: 1
            };
        }
        return schemas;
    }
}
export { MongoSchemaManager };
