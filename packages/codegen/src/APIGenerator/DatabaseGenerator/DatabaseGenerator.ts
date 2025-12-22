// @ts-nocheck - Migrated from JS, types need cleanup
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { MongoDBGenerator  } from './generators/MongoDBGenerator';
import { SQLiteGenerator  } from './generators/SQLiteGenerator';
import { SeedGenerator  } from './generators/SeedGenerator';
import { MigrationGenerator  } from './generators/MigrationGenerator';
import { MongoSchemaManager  } from './generators/MongoSchemaManager';
import { createLogger  } from '@seans-mfe-tool/logger';

const logger = createLogger({ context: 'codegen:database', silent: process.env.NODE_ENV === 'test' });

class DatabaseGenerator {
    static async generate(dbType, outputDir, spec) {
        if (!dbType) {
            throw new Error('Database type is required');
        }
        logger.info(chalk.blue('\nGenerating database components...'));
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
            logger.info(chalk.green('✓ Generated database components successfully'));
        }
        catch (error) {
            logger.error(chalk.red('Failed to generate database components:'));
            logger.error(error);
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
export { DatabaseGenerator };
