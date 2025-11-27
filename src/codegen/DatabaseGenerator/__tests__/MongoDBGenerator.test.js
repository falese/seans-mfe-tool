const { MongoDBGenerator } = require('../generators/MongoDBGenerator');
const { 
  simpleSchema, 
  complexSchema, 
  relationshipSchema,
  validationSchema,
  mongoSpecificSchema,
  multiSchemaSpec
} = require('./fixtures/openapi-schemas');
const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra
jest.mock('fs-extra');

describe('MongoDBGenerator', () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new MongoDBGenerator();
    
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
  });

  describe('generateModelFile', () => {
    it('should generate valid Mongoose model structure', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('const mongoose = require(\'mongoose\')');
      expect(result).toContain('const { Schema } = mongoose');
      expect(result).toContain('const UserSchema = new Schema(');
      expect(result).toContain('const User = mongoose.model(\'Users\', UserSchema)');
    });

    it('should include schema options', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('timestamps: true');
      expect(result).toContain('versionKey: false');
      expect(result).toContain('toJSON:');
      expect(result).toContain('virtuals: true');
    });

    it('should include toJSON transform', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('transform: (doc, ret) =>');
      expect(result).toContain('ret.id = ret._id');
      expect(result).toContain('delete ret._id');
      expect(result).toContain('delete ret.__v');
    });

    it('should generate schema validations', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('// Add schema validations');
    });

    it('should include toDTO method', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('async toDTO()');
      expect(result).toContain('id: this._id');
      expect(result).toContain('createdAt: this.createdAt');
      expect(result).toContain('updatedAt: this.updatedAt');
    });

    it('should include findByIdOrThrow static method', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('async findByIdOrThrow(id)');
      expect(result).toContain('const doc = await this.findById(id)');
      expect(result).toContain('if (!doc) throw new Error(\'Document not found\')');
    });

    it('should include findOneOrThrow static method', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('async findOneOrThrow(conditions)');
      expect(result).toContain('const doc = await this.findOne(conditions)');
    });

    it('should export model with plural collection name', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('mongoose.model(\'Users\', UserSchema)');
      expect(result).toContain('module.exports = User');
    });

    it('should export both singular and plural forms', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      expect(result).toContain('module.exports.Users = User');
      expect(result).toContain('module.exports.User = User');
    });

    it('should throw error for invalid schema', () => {
      const invalidSchema = { type: 'object' };
      
      expect(() => {
        generator.generateModelFile('Invalid', invalidSchema);
      }).toThrow('Invalid schema: schema must have properties defined');
    });
  });

  describe('validateSchema', () => {
    it('should not throw for valid schema', () => {
      const schema = { properties: { name: { type: 'string' } } };
      
      expect(() => generator.validateSchema(schema)).not.toThrow();
    });

    it('should throw for schema without properties', () => {
      const schema = { type: 'object' };
      
      expect(() => generator.validateSchema(schema)).toThrow('Invalid schema: schema must have properties defined');
    });

    it('should throw for null schema', () => {
      expect(() => generator.validateSchema(null)).toThrow('Invalid schema: schema must have properties defined');
    });

    it('should throw for undefined schema', () => {
      expect(() => generator.validateSchema(undefined)).toThrow('Invalid schema: schema must have properties defined');
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

    it('should exclude _id field', () => {
      const schema = {
        properties: {
          _id: { type: 'string' },
          title: { type: 'string' }
        }
      };
      const result = generator.generateSchemaObject(schema);
      
      expect(result).not.toContain('"_id"');
      expect(result).toContain('title');
    });

    it('should replace quoted Mongoose types with unquoted', () => {
      const schema = {
        properties: {
          name: { type: 'string' }
        }
      };
      const result = generator.generateSchemaObject(schema);
      
      expect(result).toContain('String');
      expect(result).not.toContain('"String"');
    });

    it('should include all Mongoose type replacements', () => {
      const schema = {
        properties: {
          str: { type: 'string' },
          num: { type: 'number' },
          bool: { type: 'boolean' }
        }
      };
      const result = generator.generateSchemaObject(schema);
      
      expect(result).toContain('String');
      expect(result).toContain('Number');
      expect(result).toContain('Boolean');
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

  describe('convertToMongooseType', () => {
    it('should set type for string property', () => {
      const result = generator.convertToMongooseType('name', { type: 'string' }, false);
      
      expect(result.type).toBe('String');
    });

    it('should add required validation with message', () => {
      const result = generator.convertToMongooseType('email', { type: 'string' }, true);
      
      expect(result.required).toEqual([true, 'email is required']);
    });

    it('should not add required for optional fields', () => {
      const result = generator.convertToMongooseType('bio', { type: 'string' }, false);
      
      expect(result.required).toBeUndefined();
    });

    it('should include enum values', () => {
      const result = generator.convertToMongooseType('status', { 
        type: 'string', 
        enum: ['active', 'inactive'] 
      }, false);
      
      expect(result.enum).toEqual(['active', 'inactive']);
    });

    it('should include default value', () => {
      const result = generator.convertToMongooseType('active', { 
        type: 'boolean', 
        default: true 
      }, false);
      
      expect(result.default).toBe(true);
    });

    it('should include description', () => {
      const result = generator.convertToMongooseType('notes', { 
        type: 'string', 
        description: 'User notes' 
      }, false);
      
      expect(result.description).toBe('User notes');
    });

    it('should add min validation for numbers', () => {
      const result = generator.convertToMongooseType('age', { 
        type: 'integer', 
        minimum: 18 
      }, false);
      
      expect(result.min).toBe(18);
    });

    it('should add max validation for numbers', () => {
      const result = generator.convertToMongooseType('score', { 
        type: 'number', 
        maximum: 100 
      }, false);
      
      expect(result.max).toBe(100);
    });

    it('should add minlength for strings', () => {
      const result = generator.convertToMongooseType('username', { 
        type: 'string', 
        minLength: 3 
      }, false);
      
      expect(result.minlength).toBe(3);
    });

    it('should add maxlength for strings', () => {
      const result = generator.convertToMongooseType('bio', { 
        type: 'string', 
        maxLength: 500 
      }, false);
      
      expect(result.maxlength).toBe(500);
    });

    it('should add pattern validation for strings', () => {
      const result = generator.convertToMongooseType('code', { 
        type: 'string', 
        pattern: '^[A-Z0-9]+$' 
      }, false);
      
      expect(result.match).toEqual(new RegExp('^[A-Z0-9]+$'));
    });
  });

  describe('generateSchemaValidations', () => {
    it('should return empty string for schema without properties', () => {
      const result = generator.generateSchemaValidations({}, 'Model');
      
      expect(result).toBe('');
    });

    it('should skip id field', () => {
      const schema = {
        properties: {
          id: { type: 'integer', format: 'email' }
        }
      };
      const result = generator.generateSchemaValidations(schema, 'User');
      
      expect(result).toBe('');
    });

    it('should generate email validation', () => {
      const schema = {
        properties: {
          email: { type: 'string', format: 'email' }
        }
      };
      const result = generator.generateSchemaValidations(schema, 'User');
      
      expect(result).toContain('UserSchema.path(\'email\').validate(function(value)');
      expect(result).toContain('.test(value)');
      expect(result).toContain('email must be a valid email address');
    });

    it('should generate URI validation', () => {
      const schema = {
        properties: {
          website: { type: 'string', format: 'uri' }
        }
      };
      const result = generator.generateSchemaValidations(schema, 'User');
      
      expect(result).toContain('UserSchema.path(\'website\').validate(function(value)');
      expect(result).toContain('new URL(value)');
      expect(result).toContain('website must be a valid URL');
    });

    it('should generate x-ref validation', () => {
      const schema = {
        properties: {
          authorId: { type: 'integer', 'x-ref': 'Author' }
        }
      };
      const result = generator.generateSchemaValidations(schema, 'Post');
      
      expect(result).toContain('PostSchema.path(\'authorId\').validate(async function(value)');
      expect(result).toContain('mongoose.model(\'Author\')');
      expect(result).toContain('await Author.findById(value)');
      expect(result).toContain('Author not found');
    });

    it('should handle multiple validations', () => {
      const schema = {
        properties: {
          email: { type: 'string', format: 'email' },
          website: { type: 'string', format: 'uri' },
          authorId: { type: 'integer', 'x-ref': 'User' }
        }
      };
      const result = generator.generateSchemaValidations(schema, 'Profile');
      
      expect(result).toContain('email');
      expect(result).toContain('website');
      expect(result).toContain('authorId');
    });
  });

  describe('getMongooseType', () => {
    it('should return String for string type', () => {
      const result = generator.getMongooseType({ type: 'string' });
      
      expect(result).toBe('String');
    });

    it('should return Number for number type', () => {
      const result = generator.getMongooseType({ type: 'number' });
      
      expect(result).toBe('Number');
    });

    it('should return Number for integer type', () => {
      const result = generator.getMongooseType({ type: 'integer' });
      
      expect(result).toBe('Number');
    });

    it('should return Boolean for boolean type', () => {
      const result = generator.getMongooseType({ type: 'boolean' });
      
      expect(result).toBe('Boolean');
    });

    it('should return ObjectId array for array with x-ref items', () => {
      const result = generator.getMongooseType({ 
        type: 'array', 
        items: { 'x-ref': 'User' } 
      });
      
      expect(result).toBe('[Schema.Types.ObjectId]');
    });

    it('should return typed array for array with typed items', () => {
      const result = generator.getMongooseType({ 
        type: 'array', 
        items: { type: 'string' } 
      });
      
      expect(result).toBe('[String]');
    });

    it('should return Mixed array for array without items definition', () => {
      const result = generator.getMongooseType({ type: 'array' });
      
      expect(result).toBe('[Schema.Types.Mixed]');
    });

    it('should return ObjectId for object with x-ref', () => {
      const result = generator.getMongooseType({ 
        type: 'object', 
        'x-ref': 'Category' 
      });
      
      expect(result).toBe('Schema.Types.ObjectId');
    });

    it('should return nested schema for object with properties', () => {
      const result = generator.getMongooseType({ 
        type: 'object', 
        properties: {
          street: { type: 'string' },
          city: { type: 'string' }
        }
      });
      
      expect(result).toEqual({
        street: 'String',
        city: 'String'
      });
    });

    it('should return Map for object with additionalProperties', () => {
      const result = generator.getMongooseType({ 
        type: 'object', 
        additionalProperties: true 
      });
      
      expect(result).toBe('Map');
    });

    it('should return Mixed for generic object', () => {
      const result = generator.getMongooseType({ type: 'object' });
      
      expect(result).toBe('Schema.Types.Mixed');
    });

    it('should return String for unknown type', () => {
      const result = generator.getMongooseType({ type: 'unknown' });
      
      expect(result).toBe('String');
    });

    it('should return String for property without type', () => {
      const result = generator.getMongooseType({});
      
      expect(result).toBe('String');
    });

    it('should handle nested objects recursively', () => {
      const result = generator.getMongooseType({
        type: 'object',
        properties: {
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              number: { type: 'integer' }
            }
          }
        }
      });
      
      expect(result.address).toEqual({
        street: 'String',
        number: 'Number'
      });
    });
  });

  describe('generateModelIndex', () => {
    it('should generate mongoose require', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const mongoose = require(\'mongoose\')');
    });

    it('should import all models', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      expect(content).toContain('const Category = require(\'./Category.model\')');
      expect(content).toContain('const Product = require(\'./Product.model\')');
      expect(content).toContain('const Order = require(\'./Order.model\')');
    });

    it('should export singular and plural forms', async () => {
      await generator.generateModelIndex('/models', multiSchemaSpec.components.schemas);
      
      const [[, content]] = fs.writeFile.mock.calls;
      // Format: ModelName,\n  ModelNames: ModelName
      expect(content).toContain('Category,');
      expect(content).toContain('Categorys: Category');
      expect(content).toContain('Product,');
      expect(content).toContain('Products: Product');
      expect(content).toContain('Order,');
      expect(content).toContain('Orders: Order');
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
      
      expect(result).toContain('ProductSchema');
      expect(result).toContain('name');
      expect(result).toContain('price');
      expect(result).toContain('category');
      expect(result).toContain('tags');
    });

    it('should handle relationship schema with x-ref', () => {
      const schema = relationshipSchema.components.schemas.Post;
      const result = generator.generateModelFile('Post', schema);
      
      expect(result).toContain('PostSchema');
      expect(result).toContain('authorId');
      expect(result).toContain('title');
    });

    it('should handle validation schema', () => {
      const schema = validationSchema.components.schemas.Account;
      const result = generator.generateModelFile('Account', schema);
      
      expect(result).toContain('AccountSchema');
      expect(result).toContain('email must be a valid email address');
      expect(result).toContain('website must be a valid URL');
    });

    it('should generate executable Mongoose model', () => {
      const schema = simpleSchema.components.schemas.User;
      const result = generator.generateModelFile('User', schema);
      
      // Should not throw syntax error
      expect(() => {
        new Function(result);
      }).not.toThrow();
    });
  });
});
