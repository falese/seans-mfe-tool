const fs = require('fs');
const path = require('path');
const SchemaVersion = require('../models/schemaVersion.model');

class SchemaManager {
  static async initialize() {
    try {
      // Get current schema version
      const currentVersion = await SchemaVersion.getCurrentVersion();
      console.log('Current schema version:', currentVersion);

      // Get all migration files
      const migrationsDir = path.join(__dirname, '../database/migrations');
      const migrations = this.getMigrationFiles(migrationsDir);

      // Apply any pending migrations
      await this.applyPendingMigrations(currentVersion, migrations);

    } catch (error) {
      console.error('Failed to initialize schema:', error);
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
    for (const { file, migration } of migrations) {
      if (migration.version > currentVersion) {
        console.log(`Applying migration ${migration.version}: ${migration.description}`);
        
        try {
          await migration.up();
          console.log(`✓ Migration ${migration.version} applied successfully`);
        } catch (error) {
          console.error(`Failed to apply migration ${migration.version}:`, error);
          // Attempt rollback
          try {
            await migration.down();
            console.log(`✓ Rolled back migration ${migration.version}`);
          } catch (rollbackError) {
            console.error(`Failed to rollback migration ${migration.version}:`, rollbackError);
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
    const fileName = `${timestamp}-${description.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.js`;
    
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const filePath = path.join(migrationsDir, fileName);

    const template = `const mongoose = require('mongoose');
const Models = require('../../models');
const SchemaVersion = require('../../models/schemaVersion.model');

async function up() {
  // Add your migration logic here
  await SchemaVersion.recordVersion(${newVersion}, '${description}', [
    // List affected models and their versions
    // { name: 'ModelName', version: 1 }
  ]);
}

async function down() {
  // Add your rollback logic here
  await SchemaVersion.deleteOne({ version: ${newVersion} });
}

module.exports = {
  version: ${newVersion},
  description: '${description}',
  up,
  down
};`;

    fs.writeFileSync(filePath, template);
    console.log(`✓ Created new migration: ${fileName}`);
  }
}

module.exports = SchemaManager;