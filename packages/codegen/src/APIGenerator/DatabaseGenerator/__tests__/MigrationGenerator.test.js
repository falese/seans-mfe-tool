const { MigrationGenerator } = require('../generators/MigrationGenerator');
const { 
  simpleSchema, 
  relationshipSchema,
  validationSchema,
  multiSchemaSpec
} = require('./fixtures/openapi-schemas');
const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra
jest.mock('fs-extra');

describe('MigrationGenerator', () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should store spec', () => {
      const spec = simpleSchema;
      const gen = new MigrationGenerator(spec);
      
      expect(gen.spec).toBe(spec);
    });
  });

  describe('generateMigrations', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(multiSchemaSpec);
    });

    it('should create migrations directory', async () => {
      await generator.generateMigrations('/output');
      
      expect(fs.ensureDir).toHaveBeenCalledWith(
        path.join('/output', 'src', 'database', 'migrations')
      );
    });

    it('should generate timestamped migration file', async () => {
      await generator.generateMigrations('/output');
      
      const [[filePath]] = fs.writeFile.mock.calls;
      expect(filePath).toMatch(/\/migrations\/\d{14}-create-initial-tables\.js$/);
    });

    it('should write migration content', async () => {
      await generator.generateMigrations('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('module.exports = {');
      expect(content).toContain('async up(queryInterface, Sequelize)');
      expect(content).toContain('async down(queryInterface, Sequelize)');
    });

    it('should generate sequelize config', async () => {
      await generator.generateMigrations('/output');
      
      expect(fs.writeFile).toHaveBeenCalledTimes(3); // migration + config + .sequelizerc
    });

    it('should handle spec without schemas', async () => {
      const emptyGen = new MigrationGenerator({ components: {} });
      
      await emptyGen.generateMigrations('/output');
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle spec without components', async () => {
      const emptyGen = new MigrationGenerator({});
      
      await emptyGen.generateMigrations('/output');
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('generateInitialMigration', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(multiSchemaSpec);
    });

    it('should include migration header', () => {
      const result = generator.generateInitialMigration();
      
      expect(result).toContain("'use strict';");
      expect(result).toContain("/** @type {import('sequelize-cli').Migration} */");
    });

    it('should include up method', () => {
      const result = generator.generateInitialMigration();
      
      expect(result).toContain('async up(queryInterface, Sequelize) {');
    });

    it('should include down method', () => {
      const result = generator.generateInitialMigration();
      
      expect(result).toContain('async down(queryInterface, Sequelize) {');
    });

    it('should use transaction in up', () => {
      const result = generator.generateInitialMigration();
      
      expect(result).toContain('const transaction = await queryInterface.sequelize.transaction();');
      expect(result).toContain('await transaction.commit();');
      expect(result).toContain('await transaction.rollback();');
    });

    it('should use transaction in down', () => {
      const result = generator.generateInitialMigration();
      const downSection = result.split('async down')[1];
      
      expect(downSection).toContain('const transaction = await queryInterface.sequelize.transaction();');
      expect(downSection).toContain('await transaction.commit();');
      expect(downSection).toContain('await transaction.rollback();');
    });

    it('should create tables for all schemas', () => {
      const result = generator.generateInitialMigration();
      
      expect(result).toContain('Categorys');
      expect(result).toContain('Products');
      expect(result).toContain('Orders');
    });

    it('should add foreign key constraints section', () => {
      const result = generator.generateInitialMigration();
      
      expect(result).toContain('// Add foreign key constraints');
    });

    it('should drop tables in reverse order', () => {
      const result = generator.generateInitialMigration();
      const downSection = result.split('async down')[1];
      
      // Should list tables in reverse
      expect(downSection).toContain("'Orders'");
      expect(downSection).toContain("'Products'");
      expect(downSection).toContain("'Categorys'");
      
      // Orders should come before Products (reverse)
      const ordersIdx = downSection.indexOf("'Orders'");
      const productsIdx = downSection.indexOf("'Products'");
      expect(ordersIdx).toBeLessThan(productsIdx);
    });

    it('should include error handling in up', () => {
      const result = generator.generateInitialMigration();
      
      expect(result).toContain('try {');
      expect(result).toContain('} catch (error) {');
      expect(result).toContain('throw error;');
    });

    it('should include error handling in down', () => {
      const result = generator.generateInitialMigration();
      const downSection = result.split('async down')[1];
      
      expect(downSection).toContain('try {');
      expect(downSection).toContain('} catch (error) {');
    });
  });

  describe('generateTableDefinition', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(simpleSchema);
    });

    it('should include createTable call', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateTableDefinition('users', schema);
      
      expect(result).toContain("await queryInterface.createTable('users'");
    });

    it('should include id column', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateTableDefinition('users', schema);
      
      expect(result).toContain('id: {');
      expect(result).toContain('type: Sequelize.INTEGER');
      expect(result).toContain('primaryKey: true');
      expect(result).toContain('autoIncrement: true');
    });

    it('should include created_at column', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateTableDefinition('users', schema);
      
      expect(result).toContain('created_at: {');
      expect(result).toContain('type: Sequelize.DATE');
      expect(result).toContain("defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')");
    });

    it('should include updated_at column', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateTableDefinition('users', schema);
      
      expect(result).toContain('updated_at: {');
      expect(result).toContain('type: Sequelize.DATE');
    });

    it('should include transaction option', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateTableDefinition('users', schema);
      
      expect(result).toContain('{ transaction }');
    });

    it('should include schema columns', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateTableDefinition('users', schema);
      
      expect(result).toContain('email:');
      expect(result).toContain('name:');
    });
  });

  describe('generateColumns', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(simpleSchema);
    });

    it('should exclude id column', () => {
      const schema = { 
        properties: { 
          id: { type: 'integer' },
          name: { type: 'string' }
        } 
      };
      const result = generator.generateColumns(schema);
      
      expect(result).not.toContain('id:');
      expect(result).toContain('name:');
    });

    it('should convert property names to snake_case', () => {
      const schema = {
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' }
        }
      };
      const result = generator.generateColumns(schema);
      
      expect(result).toContain('first_name:');
      expect(result).toContain('last_name:');
    });

    it('should separate columns with comma and newline', () => {
      const schema = {
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        }
      };
      const result = generator.generateColumns(schema);
      
      expect(result).toMatch(/name:.*,\n.*age:/s);
    });

    it('should handle required fields', () => {
      const schema = {
        properties: {
          email: { type: 'string' }
        },
        required: ['email']
      };
      const result = generator.generateColumns(schema);
      
      expect(result).toContain('email:');
    });

    it('should return empty string for schema without properties', () => {
      const schema = {};
      
      expect(() => generator.generateColumns(schema)).toThrow();
    });
  });

  describe('getColumnDefinition', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(simpleSchema);
    });

    it('should include type', () => {
      const result = generator.getColumnDefinition('name', { type: 'string' }, false);
      
      expect(result).toContain('type');
      expect(result).toContain('Sequelize.TEXT');
    });

    it('should set allowNull false for required', () => {
      const result = generator.getColumnDefinition('email', { type: 'string' }, true);
      
      expect(result).toContain('"allowNull": false');
    });

    it('should set allowNull true for optional', () => {
      const result = generator.getColumnDefinition('bio', { type: 'string' }, false);
      
      expect(result).toContain('"allowNull": true');
    });

    it('should include default value', () => {
      const result = generator.getColumnDefinition('active', { type: 'boolean', default: true }, false);
      
      expect(result).toContain('"defaultValue": true');
    });

    it('should handle enum with ENUM type', () => {
      const result = generator.getColumnDefinition('status', { 
        type: 'string', 
        enum: ['active', 'inactive'] 
      }, false);
      
      expect(result).toContain("Sequelize.ENUM('active', 'inactive')");
    });

    it('should include comment from description', () => {
      const result = generator.getColumnDefinition('notes', { 
        type: 'string', 
        description: 'User notes' 
      }, false);
      
      expect(result).toContain('"comment": "User notes"');
    });

    it('should format as multiline JSON', () => {
      const result = generator.getColumnDefinition('name', { type: 'string' }, false);
      
      expect(result).toMatch(/\{[\s\S]+\}/);
      expect(result).toContain('\n');
    });

    it('should unquote Sequelize constants', () => {
      const result = generator.getColumnDefinition('age', { type: 'integer' }, false);
      
      expect(result).toContain('Sequelize.INTEGER');
      expect(result).not.toContain('"Sequelize.INTEGER"');
    });
  });

  describe('getSequelizeColumnType', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(simpleSchema);
    });

    it('should return Sequelize.TEXT for string', () => {
      const result = generator.getSequelizeColumnType({ type: 'string' });
      
      expect(result).toBe('Sequelize.TEXT');
    });

    it('should return Sequelize.STRING with length for maxLength', () => {
      const result = generator.getSequelizeColumnType({ type: 'string', maxLength: 100 });
      
      expect(result).toBe('Sequelize.STRING(100)');
    });

    it('should return Sequelize.DATE for date format', () => {
      const result = generator.getSequelizeColumnType({ type: 'string', format: 'date' });
      
      expect(result).toBe('Sequelize.DATE');
    });

    it('should return Sequelize.DATE for date-time format', () => {
      const result = generator.getSequelizeColumnType({ type: 'string', format: 'date-time' });
      
      expect(result).toBe('Sequelize.DATE');
    });

    it('should return Sequelize.DECIMAL for number', () => {
      const result = generator.getSequelizeColumnType({ type: 'number' });
      
      expect(result).toBe('Sequelize.DECIMAL(10, 2)');
    });

    it('should return Sequelize.FLOAT for float format', () => {
      const result = generator.getSequelizeColumnType({ type: 'number', format: 'float' });
      
      expect(result).toBe('Sequelize.FLOAT');
    });

    it('should return Sequelize.INTEGER for integer', () => {
      const result = generator.getSequelizeColumnType({ type: 'integer' });
      
      expect(result).toBe('Sequelize.INTEGER');
    });

    it('should return Sequelize.BOOLEAN for boolean', () => {
      const result = generator.getSequelizeColumnType({ type: 'boolean' });
      
      expect(result).toBe('Sequelize.BOOLEAN');
    });

    it('should return Sequelize.JSON for array', () => {
      const result = generator.getSequelizeColumnType({ type: 'array' });
      
      expect(result).toBe('Sequelize.JSON');
    });

    it('should return Sequelize.JSON for object', () => {
      const result = generator.getSequelizeColumnType({ type: 'object' });
      
      expect(result).toBe('Sequelize.JSON');
    });

    it('should return Sequelize.STRING for unknown type', () => {
      const result = generator.getSequelizeColumnType({ type: 'unknown' });
      
      expect(result).toBe('Sequelize.STRING');
    });

    it('should return Sequelize.STRING for missing type', () => {
      const result = generator.getSequelizeColumnType({});
      
      expect(result).toBe('Sequelize.STRING');
    });
  });

  describe('generateForeignKeys', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(relationshipSchema);
    });

    it('should return empty string for schema without x-ref', () => {
      const schema = {
        properties: {
          name: { type: 'string' }
        }
      };
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toBe('');
    });

    it('should generate addConstraint call', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain('await queryInterface.addConstraint');
    });

    it('should include table name', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("'posts'");
    });

    it('should include field in snake_case', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("fields: ['author_id_id']");
    });

    it('should set foreign key type', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("type: 'foreign key'");
    });

    it('should include constraint name', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("name: 'posts_author_id_id_fk'");
    });

    it('should reference correct table', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("table: 'Authors'");
    });

    it('should reference id field', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("field: 'id'");
    });

    it('should set onDelete CASCADE', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("onDelete: 'CASCADE'");
    });

    it('should set onUpdate CASCADE', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain("onUpdate: 'CASCADE'");
    });

    it('should include transaction', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateForeignKeys('posts', schema);
      
      expect(result).toContain('transaction');
    });

    it('should handle multiple foreign keys', () => {
      const schema = relationshipSchema.components.schemas.Comment;
      const result = generator.generateForeignKeys('comments', schema);
      
      // Comment has authorId and postId
      expect(result).toContain('author_id_id');
      expect(result).toContain('post_id_id');
    });
  });

  describe('generateSequelizeConfig', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(simpleSchema);
    });

    it('should create config directory', async () => {
      await generator.generateSequelizeConfig('/output');
      
      expect(fs.ensureDir).toHaveBeenCalledWith(
        path.join('/output', 'src', 'config')
      );
    });

    it('should write database.js config', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const configCall = fs.writeFile.mock.calls.find(
        call => call[0].includes('database.js')
      );
      expect(configCall).toBeDefined();
    });

    it('should include development config', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('development: {');
      expect(content).toContain("dialect: 'sqlite'");
      expect(content).toContain("storage: './src/database/development.sqlite'");
    });

    it('should include test config', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('test: {');
      expect(content).toContain("storage: ':memory:'");
      expect(content).toContain('logging: false');
    });

    it('should include production config', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('production: {');
      expect(content).toContain("storage: './src/database/production.sqlite'");
    });

    it('should write .sequelizerc file', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const rcCall = fs.writeFile.mock.calls.find(
        call => call[0].includes('.sequelizerc')
      );
      expect(rcCall).toBeDefined();
    });

    it('should configure config path in .sequelizerc', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const rcCall = fs.writeFile.mock.calls.find(call => call[0].includes('.sequelizerc'));
      expect(rcCall[1]).toContain("'config': path.resolve('src', 'config', 'database.js')");
    });

    it('should configure models-path in .sequelizerc', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const rcCall = fs.writeFile.mock.calls.find(call => call[0].includes('.sequelizerc'));
      expect(rcCall[1]).toContain("'models-path': path.resolve('src', 'models')");
    });

    it('should configure seeders-path in .sequelizerc', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const rcCall = fs.writeFile.mock.calls.find(call => call[0].includes('.sequelizerc'));
      expect(rcCall[1]).toContain("'seeders-path': path.resolve('src', 'database', 'seeders')");
    });

    it('should configure migrations-path in .sequelizerc', async () => {
      await generator.generateSequelizeConfig('/output');
      
      const rcCall = fs.writeFile.mock.calls.find(call => call[0].includes('.sequelizerc'));
      expect(rcCall[1]).toContain("'migrations-path': path.resolve('src', 'database', 'migrations')");
    });
  });

  describe('toSnakeCase', () => {
    beforeEach(() => {
      generator = new MigrationGenerator(simpleSchema);
    });

    it('should convert camelCase to snake_case', () => {
      expect(generator.toSnakeCase('firstName')).toBe('first_name');
    });

    it('should convert PascalCase to snake_case', () => {
      expect(generator.toSnakeCase('UserProfile')).toBe('_user_profile');
    });

    it('should handle single word', () => {
      expect(generator.toSnakeCase('user')).toBe('user');
    });

    it('should handle already snake_case', () => {
      expect(generator.toSnakeCase('user_name')).toBe('user_name');
    });

    it('should handle multiple capital letters', () => {
      expect(generator.toSnakeCase('HTTPSConnection')).toBe('_h_t_t_p_s_connection');
    });

    it('should handle empty string', () => {
      expect(generator.toSnakeCase('')).toBe('');
    });
  });
});
