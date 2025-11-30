const { BaseGenerator } = require('../generators/BaseGenerator');
const { simpleSchema, emptyPropertiesSchema } = require('./fixtures/openapi-schemas');
const fs = require('fs-extra');
const path = require('path');

// Mock fs-extra
jest.mock('fs-extra');

describe('BaseGenerator', () => {
  let generator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new BaseGenerator();
    
    // Setup fs mocks
    fs.ensureDir = jest.fn().mockResolvedValue(undefined);
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
    
    // Mock abstract methods by default
    jest.spyOn(generator, 'generateModelIndex').mockResolvedValue(undefined);
  });

  describe('generateModels', () => {
    it('should create models directory', async () => {
      jest.spyOn(generator, 'generateModelFile').mockReturnValue('model content');
      
      const outputDir = '/test/output';
      const expectedModelsDir = path.join(outputDir, 'src', 'models');
      
      await generator.generateModels(outputDir, simpleSchema);
      
      expect(fs.ensureDir).toHaveBeenCalledWith(expectedModelsDir);
    });

    it('should skip spec without components', async () => {
      const spec = { openapi: '3.0.0' };
      
      await generator.generateModels('/output', spec);
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should skip spec without schemas', async () => {
      const spec = { 
        openapi: '3.0.0',
        components: {}
      };
      
      await generator.generateModels('/output', spec);
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should skip schemas without properties', async () => {
      await generator.generateModels('/output', emptyPropertiesSchema);
      
      // Should not write files for schemas without properties
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should skip schemas with empty properties object', async () => {
      const spec = {
        components: {
          schemas: {
            Empty: {
              type: 'object',
              properties: {}
            }
          }
        }
      };
      
      await generator.generateModels('/output', spec);
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should call generateModelFile for valid schemas', async () => {
      const spy = jest.spyOn(generator, 'generateModelFile').mockReturnValue('model content');
      
      await generator.generateModels('/output', simpleSchema);
      
      expect(spy).toHaveBeenCalledWith('User', simpleSchema.components.schemas.User);
    });

    it('should write model files to correct paths', async () => {
      jest.spyOn(generator, 'generateModelFile').mockReturnValue('model content');
      
      await generator.generateModels('/output', simpleSchema);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join('/output', 'src', 'models', 'User.model.js'),
        'model content',
        'utf8'
      );
    });

    it('should call generateModelIndex after processing schemas', async () => {
      const spy = jest.spyOn(generator, 'generateModelIndex').mockResolvedValue(undefined);
      jest.spyOn(generator, 'generateModelFile').mockReturnValue('model content');
      
      await generator.generateModels('/output', simpleSchema);
      
      expect(spy).toHaveBeenCalledWith(
        path.join('/output', 'src', 'models'),
        simpleSchema.components.schemas
      );
    });

    it('should process multiple schemas', async () => {
      const spec = {
        components: {
          schemas: {
            User: { properties: { name: { type: 'string' } } },
            Post: { properties: { title: { type: 'string' } } },
            Comment: { properties: { content: { type: 'string' } } }
          }
        }
      };
      
      const spy = jest.spyOn(generator, 'generateModelFile').mockReturnValue('content');
      
      await generator.generateModels('/output', spec);
      
      expect(spy).toHaveBeenCalledTimes(3);
      expect(fs.writeFile).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateModelFile', () => {
    it('should throw error when not implemented', () => {
      expect(() => {
        generator.generateModelFile('User', { properties: {} });
      }).toThrow('generateModelFile must be implemented by subclass');
    });
  });

  describe('generateModelIndex', () => {
    it('should throw error when not implemented', async () => {
      // Create a fresh generator without mocks
      const freshGenerator = new BaseGenerator();
      
      await expect(
        freshGenerator.generateModelIndex('/models', {})
      ).rejects.toThrow('generateModelIndex must be implemented by subclass');
    });
  });

  describe('validateSchema', () => {
    it('should not throw for valid schema with properties', () => {
      const schema = {
        properties: {
          name: { type: 'string' }
        }
      };
      
      expect(() => generator.validateSchema(schema)).not.toThrow();
    });

    it('should throw error for schema without properties', () => {
      const schema = { type: 'object' };
      
      expect(() => generator.validateSchema(schema)).toThrow('Schema must have properties defined');
    });

    it('should throw error for null schema', () => {
      expect(() => generator.validateSchema(null)).toThrow('Schema must have properties defined');
    });

    it('should throw error for undefined schema', () => {
      expect(() => generator.validateSchema(undefined)).toThrow('Schema must have properties defined');
    });

    it('should throw error for schema with null properties', () => {
      const schema = { properties: null };
      
      expect(() => generator.validateSchema(schema)).toThrow('Schema must have properties defined');
    });
  });

  describe('getPropertyType', () => {
    it('should return type for string property', () => {
      const property = { type: 'string' };
      
      expect(generator.getPropertyType(property)).toBe('string');
    });

    it('should return type for number property', () => {
      const property = { type: 'number' };
      
      expect(generator.getPropertyType(property)).toBe('number');
    });

    it('should return type for integer property', () => {
      const property = { type: 'integer' };
      
      expect(generator.getPropertyType(property)).toBe('integer');
    });

    it('should return type for boolean property', () => {
      const property = { type: 'boolean' };
      
      expect(generator.getPropertyType(property)).toBe('boolean');
    });

    it('should return type for array property', () => {
      const property = { type: 'array', items: { type: 'string' } };
      
      expect(generator.getPropertyType(property)).toBe('array');
    });

    it('should return type for object property', () => {
      const property = { type: 'object', properties: {} };
      
      expect(generator.getPropertyType(property)).toBe('object');
    });

    it('should throw error for property without type', () => {
      const property = { format: 'email' };
      
      expect(() => generator.getPropertyType(property)).toThrow('Property must have a type defined');
    });

    it('should throw error for null property', () => {
      expect(() => generator.getPropertyType(null)).toThrow('Property must have a type defined');
    });

    it('should throw error for undefined property', () => {
      expect(() => generator.getPropertyType(undefined)).toThrow('Property must have a type defined');
    });
  });
});
