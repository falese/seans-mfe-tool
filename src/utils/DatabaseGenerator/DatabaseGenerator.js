const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { MongoDBGenerator } = require('./generators/MongoDBGenerator');
const { SQLiteGenerator } = require('./generators/SQLiteGenerator');
const { SeedGenerator } = require('./generators/SeedGenerator');
const { MigrationGenerator } = require('./generators/MigrationGenerator');
const { MongoSchemaManager } = require('./generators/MongoSchemaManager');

class DatabaseGenerator {
  static async generate(dbType, outputDir, spec) {
    if (!dbType) {
      throw new Error('Database type is required');
    }

    console.log(chalk.blue('\nGenerating database components...'));
    
    // Get the appropriate generator
    const generator = this.getGenerator(dbType);
    const seedGenerator = new SeedGenerator(spec);
    
    try {
      // Generate components in parallel
      await Promise.all([
        // Generate models
        generator.generateModels(outputDir, spec),
        
        // Generate seed data based on example values in spec
        seedGenerator.generateSeedData(outputDir, dbType),
        
        // Generate appropriate schema management system
        dbType.toLowerCase().includes('sql') ? 
          new MigrationGenerator(spec).generateMigrations(outputDir) :
          new MongoSchemaManager(spec).generateSchemaManagement(outputDir)
      ]);

      console.log(chalk.green('✓ Generated database components successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to generate database components:'));
      console.error(error);
      throw error;
    }
  }

  static getGenerator(dbType) {
    switch (dbType.toLowerCase()) {
      case 'mongodb':
      case 'mongo':
        return new MongoDBGenerator();
      case 'sqlite':
      case 'sql':
        return new SQLiteGenerator();
      default:
        throw new Error(`Unsupported database type: ${dbType}. Supported types are: mongodb, sqlite`);
    }
  }
}

module.exports = { DatabaseGenerator };