const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { NameGenerator } = require('../../generators/NameGenerator');

class MigrationGenerator {
  constructor(spec) {
    this.spec = spec;
  }

  async generateMigrations(outputDir) {
    if (!this.spec.components?.schemas) {
      console.log(chalk.yellow('No schemas found to generate migrations'));
      return;
    }

    const migrationsDir = path.join(outputDir, 'src', 'database', 'migrations');
    await fs.ensureDir(migrationsDir);

    // Generate initial migration for all schemas
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const migrationPath = path.join(migrationsDir, `${timestamp}-create-initial-tables.js`);
    
    const migrationContent = this.generateInitialMigration();
    await fs.writeFile(migrationPath, migrationContent);
    console.log(chalk.green('✓ Generated initial migration file'));

    // Generate config file for sequelize-cli
    await this.generateSequelizeConfig(outputDir);
    console.log(chalk.green('✓ Generated sequelize configuration'));
  }

  generateInitialMigration() {
    const schemas = Object.entries(this.spec.components.schemas);
    const tables = schemas.map(([schemaName, schema]) => {
      const tableName = `${NameGenerator.toModelName(schemaName)}s`;
      return this.generateTableDefinition(tableName, schema);
    });

    const foreignKeys = schemas.map(([schemaName, schema]) => {
      const tableName = `${NameGenerator.toModelName(schemaName)}s`;
      return this.generateForeignKeys(tableName, schema);
    }).filter(fk => fk);

    return `'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Create tables
      ${tables.join('\n\n      ')}

      // Add foreign key constraints
      ${foreignKeys.join('\n\n      ')}

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop tables in reverse order
      const tables = [
        ${schemas.map(([schemaName]) => 
          `'${NameGenerator.toModelName(schemaName)}s'`
        ).reverse().join(',\n        ')}
      ];

      for (const table of tables) {
        await queryInterface.dropTable(table, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};`;
  }

  generateTableDefinition(tableName, schema) {
    const columns = this.generateColumns(schema);
    
    return `await queryInterface.createTable('${tableName}', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        ${columns},
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      }, { transaction });`;
  }

  generateColumns(schema) {
    return Object.entries(schema.properties)
      .filter(([prop]) => prop !== 'id')
      .map(([prop, config]) => {
        const columnDef = this.getColumnDefinition(prop, config, schema.required?.includes(prop));
        return `${this.toSnakeCase(prop)}: ${columnDef}`;
      })
      .join(',\n        ');
  }

  getColumnDefinition(propName, property, required = false) {
    const definition = {
      type: this.getSequelizeColumnType(property),
      allowNull: !required
    };

    if (property.default !== undefined) {
      definition.defaultValue = property.default;
    }

    if (property.enum) {
      definition.type = `Sequelize.ENUM('${property.enum.join("', '")}')`; 
    }

    if (property.description) {
      definition.comment = property.description;
    }

    return JSON.stringify(definition, null, 2)
      .replace(/"Sequelize\.([^"]+)"/g, 'Sequelize.$1')
      .split('\n')
      .join('\n          ');
  }

  getSequelizeColumnType(property) {
    switch (property.type?.toLowerCase()) {
      case 'string':
        if (property.format === 'date' || property.format === 'date-time') {
          return 'Sequelize.DATE';
        }
        if (property.maxLength) {
          return `Sequelize.STRING(${property.maxLength})`;
        }
        return 'Sequelize.TEXT';
      case 'number':
        return property.format === 'float' ? 
          'Sequelize.FLOAT' : 
          'Sequelize.DECIMAL(10, 2)';
      case 'integer':
        return 'Sequelize.INTEGER';
      case 'boolean':
        return 'Sequelize.BOOLEAN';
      case 'array':
      case 'object':
        return 'Sequelize.JSON';
      default:
        return 'Sequelize.STRING';
    }
  }

  generateForeignKeys(tableName, schema) {
    const foreignKeys = [];

    for (const [prop, config] of Object.entries(schema.properties)) {
      if (config['x-ref']) {
        const refTable = `${NameGenerator.toModelName(config['x-ref'])}s`;
        const columnName = this.toSnakeCase(`${prop}_id`);
        
        foreignKeys.push(
          `await queryInterface.addConstraint('${tableName}', {
            fields: ['${columnName}'],
            type: 'foreign key',
            name: '${tableName}_${columnName}_fk',
            references: {
              table: '${refTable}',
              field: 'id'
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
            transaction
          });`
        );
      }
    }

    return foreignKeys.join('\n\n      ');
  }

  async generateSequelizeConfig(outputDir) {
    const configDir = path.join(outputDir, 'src', 'config');
    await fs.ensureDir(configDir);

    const configPath = path.join(configDir, 'database.js');
    const configContent = `module.exports = {
  development: {
    dialect: 'sqlite',
    storage: './src/database/development.sqlite',
    logging: console.log
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  },
  production: {
    dialect: 'sqlite',
    storage: './src/database/production.sqlite',
    logging: false
  }
};`;

    await fs.writeFile(configPath, configContent);

    // Generate sequelize CLI config file
    const cliConfigPath = path.join(outputDir, '.sequelizerc');
    const cliConfigContent = `const path = require('path');

module.exports = {
  'config': path.resolve('src', 'config', 'database.js'),
  'models-path': path.resolve('src', 'models'),
  'seeders-path': path.resolve('src', 'database', 'seeders'),
  'migrations-path': path.resolve('src', 'database', 'migrations')
};`;

    await fs.writeFile(cliConfigPath, cliConfigContent);
  }

  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

module.exports = { MigrationGenerator };