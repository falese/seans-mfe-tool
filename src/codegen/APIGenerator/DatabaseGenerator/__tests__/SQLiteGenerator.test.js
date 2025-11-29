const { SQLiteGenerator } = require('../generators/SQLiteGenerator');
const { 
  simpleSchema, 
  complexSchema, 
  relationshipSchema,
  validationSchema,
  sqliteSpecificSchema,
  multiSchemaSpec
} = require('./fixtures/openapi-schemas');
const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra
jest.mock('fs-extra');

describe('SQLiteGenerator', () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new SQLiteGenerator();
    
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  describe('generateModelFile', () => {
    it('should generate valid Sequelize model structure', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('const { DataTypes, Model } = require(\'sequelize\')');
      expect(result).toContain('class User extends Model {');
      expect(result).toContain('static init(sequelize) {');
      expect(result).toContain('return super.init(');
    });

    it('should include model options', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('sequelize,');
      expect(result).toContain('modelName: \'User\'');
      expect(result).toContain('tableName: \'Users\'');
      expect(result).toContain('timestamps: true');
      expect(result).toContain('underscored: true');
    });

    it('should convert table name to PascalCase plural', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('tableName: \'Users\'');
    });

    it('should include hooks object', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('hooks: {');
    });

    it('should define associate static method', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('static associate(models) {');
    });

    it('should include toDTO instance method', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('instanceMethods: {');
      expect(result).toContain('toDTO()');
    });

    it('should export model class', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('module.exports = User');
    });

    it('should throw error for invalid schema', () => {
      const invalidSchema = { type: 'object' };
      
      expect(() => {
        generator.generateModelFile('Invalid', invalidSchema);
      }).toThrow('Schema must have properties defined');
    });
  });

  describe('validateSchema', () => {
    it('should not throw for valid schema', () => {
      const schema = { properties: { name: { type: 'string' } } };
      
      expect(() => generator.validateSchema(schema)).not.toThrow();
    });

    it('should throw for schema without properties', () => {
      const schema = { type: 'object' };
      
      expect(() => generator.validateSchema(schema)).toThrow('Schema must have properties defined');
    });
  });

  describe('generateSchemaObject', () => {
    it('should return empty object for schema without properties', () => {
      const result = generator.generateSchemaObject({});
      
      expect(result).toBe('{}');
    });

    it('should exclude id field', () => {
      const schema = {
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' }
        }
      };
      const result = generator.generateSchemaObject(schema);
      
      expect(result).not.toContain('"id"');
      expect(result).toContain('name');
    });

    it('should replace quoted DataTypes with unquoted', () => {
      const schema = {
        properties: {
          name: { type: 'string' }
        }
      };
      const result = generator.generateSchemaObject(schema);
      
      expect(result).toContain('DataTypes.TEXT');
      expect(result).not.toContain('"DataTypes.TEXT"');
    });

    it('should include all DataTypes replacements', () => {
      const schema = {
        properties: {
          str: { type: 'string' },
          num: { type: 'number' },
          int: { type: 'integer' },
          bool: { type: 'boolean' }
        }
      };
      const result = generator.generateSchemaObject(schema);
      
      expect(result).toContain('DataTypes.TEXT');
      expect(result).toContain('DataTypes.DECIMAL');
      expect(result).toContain('DataTypes.INTEGER');
      expect(result).toContain('DataTypes.BOOLEAN');
    });

    it('should format as valid structure', () => {
      const schema = complexSchema.components.schemas.Product;
      const result = generator.generateSchemaObject(schema);
      
      // Should contain object structure
      expect(result).toContain('{');
      expect(result).toContain('}');
      expect(result).toContain('"name"');
      expect(result).toContain('"price"');
    });
  });

  describe('convertToSequelizeType', () => {
    it('should set type for string property', () => {
      const result = generator.convertToSequelizeType('name', { type: 'string' }, false);
      
      expect(result.type).toBe('DataTypes.TEXT');
    });

    it('should add allowNull false for required fields', () => {
      const result = generator.convertToSequelizeType('email', { type: 'string' }, true);
      
      expect(result.allowNull).toBe(false);
    });

    it('should not add allowNull for optional fields', () => {
      const result = generator.convertToSequelizeType('bio', { type: 'string' }, false);
      
      expect(result.allowNull).toBeUndefined();
    });

    it('should handle enum with ENUM type and values', () => {
      const result = generator.convertToSequelizeType('status', { 
        type: 'string', 
        enum: ['active', 'inactive'] 
      }, false);
      
      expect(result.type).toBe('DataTypes.ENUM');
      expect(result.values).toEqual(['active', 'inactive']);
    });

    it('should include default value', () => {
      const result = generator.convertToSequelizeType('active', { 
        type: 'boolean', 
        default: true 
      }, false);
      
      expect(result.defaultValue).toBe(true);
    });

    it('should include comment from description', () => {
      const result = generator.convertToSequelizeType('notes', { 
        type: 'string', 
        description: 'User notes' 
      }, false);
      
      expect(result.comment).toBe('User notes');
    });

    it('should add min validation for numbers', () => {
      const result = generator.convertToSequelizeType('age', { 
        type: 'integer', 
        minimum: 18 
      }, false);
      
      expect(result.validate).toBeDefined();
      expect(result.validate.min).toBe(18);
    });

    it('should add max validation for numbers', () => {
      const result = generator.convertToSequelizeType('score', { 
        type: 'number', 
        maximum: 100 
      }, false);
      
      expect(result.validate).toBeDefined();
      expect(result.validate.max).toBe(100);
    });

    it('should add email validation', () => {
      const result = generator.convertToSequelizeType('email', { 
        type: 'string', 
        format: 'email' 
      }, false);
      
      expect(result.validate).toBeDefined();
      expect(result.validate.isEmail).toBe(true);
    });

    it('should add URL validation', () => {
      const result = generator.convertToSequelizeType('website', { 
        type: 'string', 
        format: 'uri' 
      }, false);
      
      expect(result.validate).toBeDefined();
      expect(result.validate.isUrl).toBe(true);
    });

    it('should add len validation for minLength/maxLength', () => {
      const result = generator.convertToSequelizeType('username', { 
        type: 'string', 
        minLength: 3,
        maxLength: 20 
      }, false);
      
      expect(result.validate).toBeDefined();
      expect(result.validate.len).toEqual([3, 20]);
    });

    it('should add is validation for pattern', () => {
      const result = generator.convertToSequelizeType('code', { 
        type: 'string', 
        pattern: '^[A-Z0-9]+$' 
      }, false);
      
      expect(result.validate).toBeDefined();
      expect(result.validate.is).toEqual(/^[A-Z0-9]+$/);
    });
  });

  describe('getSequelizeType', () => {
    it('should return DataTypes.TEXT for string type', () => {
      const result = generator.getSequelizeType({ type: 'string' });
      
      expect(result).toBe('DataTypes.TEXT');
    });

    it('should return DataTypes.STRING with length for string with maxLength <= 255', () => {
      const result = generator.getSequelizeType({ type: 'string', maxLength: 100 });
      
      expect(result).toBe('DataTypes.STRING(100)');
    });

    it('should return DataTypes.DECIMAL for number type', () => {
      const result = generator.getSequelizeType({ type: 'number' });
      
      expect(result).toBe('DataTypes.DECIMAL(10, 2)');
    });

    it('should return DataTypes.FLOAT for number with float format', () => {
      const result = generator.getSequelizeType({ type: 'number', format: 'float' });
      
      expect(result).toBe('DataTypes.FLOAT');
    });

    it('should return DataTypes.INTEGER for integer type', () => {
      const result = generator.getSequelizeType({ type: 'integer' });
      
      expect(result).toBe('DataTypes.INTEGER');
    });

    it('should return DataTypes.BOOLEAN for boolean type', () => {
      const result = generator.getSequelizeType({ type: 'boolean' });
      
      expect(result).toBe('DataTypes.BOOLEAN');
    });

    it('should return DataTypes.JSON for array type', () => {
      const result = generator.getSequelizeType({ type: 'array' });
      
      expect(result).toBe('DataTypes.JSON');
    });

    it('should return DataTypes.JSON for object type', () => {
      const result = generator.getSequelizeType({ type: 'object' });
      
      expect(result).toBe('DataTypes.JSON');
    });

    it('should return DataTypes.STRING for unknown type', () => {
      const result = generator.getSequelizeType({ type: 'unknown' });
      
      expect(result).toBe('DataTypes.STRING');
    });

    it('should return DataTypes.STRING for property without type', () => {
      const result = generator.getSequelizeType({});
      
      expect(result).toBe('DataTypes.STRING');
    });

    it('should return DataTypes.DATE for date format', () => {
      const result = generator.getSequelizeType({ type: 'string', format: 'date' });
      
      expect(result).toBe('DataTypes.DATE');
    });

    it('should return DataTypes.DATE for date-time format', () => {
      const result = generator.getSequelizeType({ type: 'string', format: 'date-time' });
      
      expect(result).toBe('DataTypes.DATE');
    });
  });

  describe('generateAssociations', () => {
    it('should return comment for schema without x-ref properties', () => {
      const schema = {
        properties: {
          name: { type: 'string' }
        }
      };
      const result = generator.generateAssociations(schema);
      
      expect(result).toContain('// No associations defined');
    });

    it('should generate associations even for id field', () => {
      const schema = {
        properties: {
          id: { type: 'integer', 'x-ref': 'User' }
        }
      };
      const result = generator.generateAssociations(schema);
      
      expect(result).toContain('this.belongsTo(models.User');
    });

    it('should generate belongsTo for x-ref', () => {
      const schema = {
        properties: {
          authorId: { type: 'integer', 'x-ref': 'Author' }
        }
      };
      const result = generator.generateAssociations(schema);
      
      expect(result).toContain('this.belongsTo(models.Author');
      expect(result).toContain('as: \'authorId\'');
    });

    it('should use property name for as alias', () => {
      const schema = {
        properties: {
          userId: { type: 'integer', 'x-ref': 'User' }
        }
      };
      const result = generator.generateAssociations(schema);
      
      expect(result).toContain('as: \'userId\'');
    });

    it('should handle multiple associations', () => {
      const schema = {
        properties: {
          authorId: { type: 'integer', 'x-ref': 'User' },
          categoryId: { type: 'integer', 'x-ref': 'Category' }
        }
      };
      const result = generator.generateAssociations(schema);
      
      expect(result).toContain('belongsTo(models.User');
      expect(result).toContain('belongsTo(models.Category');
    });
  });

  describe('generateModelIndex', () => {
    it('should generate sequelize require', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const { Sequelize } = require(\'sequelize\')');
    });

    it('should require database config', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const config = require(\'../config/database\')');
    });

    it('should create sequelize instance from config', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const env = process.env.NODE_ENV || \'development\'');
      expect(content).toContain('const sequelize = new Sequelize(config[env])');
    });

    it('should import all models', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const Category = require(\'./Category.model\')');
      expect(content).toContain('const Product = require(\'./Product.model\')');
      expect(content).toContain('const Order = require(\'./Order.model\')');
    });

    it('should initialize all models', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('Category.init(sequelize)');
      expect(content).toContain('Product.init(sequelize)');
      expect(content).toContain('Order.init(sequelize)');
    });

    it('should associate all models', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('Category.associate(sequelize.models)');
      expect(content).toContain('Product.associate(sequelize.models)');
      expect(content).toContain('Order.associate(sequelize.models)');
    });

    it('should export sequelize instance', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('module.exports = {');
      expect(content).toContain('sequelize,');
    });

    it('should export Sequelize class', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('Sequelize,');
    });

    it('should export all models', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('Category,');
      expect(content).toContain('Product,');
      expect(content).toContain('Order');
      expect(content).toContain('module.exports = {');
    });

    it('should write to index.js', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[filePath]] = fs.writeFile.mock.calls;
      expect(filePath).toBe(path.join('/models', 'index.js'));
    });

    it('should export valid JavaScript module', async () => {
      await generator.generateModelIndex('/models', simpleSchema.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('module.exports = {');
      expect(content).toMatch(/}\s*;?\s*$/);
    });
  });

  describe('Integration: Complex schema generation', () => {
    it('should handle complex nested schema', () => {
      const schema = complexSchema.components.schemas.Product;
      const result = generator.generateModelFile('Product', schema);
      
      expect(result).toContain('class Product extends Model');
      expect(result).toContain('name');
      expect(result).toContain('price');
      expect(result).toContain('category');
      expect(result).toContain('tags');
    });

    it('should handle relationship schema with x-ref', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateModelFile('Post', schema);
      
      expect(result).toContain('class Post extends Model');
      expect(result).toContain('authorId');
      expect(result).toContain('title');
    });

    it('should handle validation schema', () => {
      const schema = validationSchema.components.schemas.Account;
      const result = generator.generateModelFile('Account', schema);
      
      expect(result).toContain('class Account extends Model');
      expect(result).toContain('"isEmail": true');
      expect(result).toContain('"isUrl": true');
    });

    it('should generate executable Sequelize model', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      // Should not throw syntax error
      expect(() => {
        new Function(result);
      }).not.toThrow();
    });
  });
});
