const fs = require('fs-extra');
const path = require('path');
const { ControllerGenerator } = require('../ControllerGenerator');
const { DatabaseAdapter } = require('../adapters/DatabaseAdapter');
const { NameGenerator } = require('../../generators/NameGenerator');

jest.mock('fs-extra');
jest.mock('../adapters/DatabaseAdapter');
jest.mock('../../generators/NameGenerator');

describe('ControllerGenerator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should throw an error if spec is missing paths', async () => {
      const spec = {};
      await expect(ControllerGenerator.generate('mongodb', './controllers', spec)).rejects.toThrow('Invalid OpenAPI specification: missing paths');
    });

    it('should call generateControllers with correct parameters', async () => {
      const spec = { paths: { '/test': {} } };
      const dbAdapter = { getImportStatement: jest.fn() };
      DatabaseAdapter.create.mockReturnValue(dbAdapter);

      await ControllerGenerator.generate('mongodb', './controllers', spec);

      expect(DatabaseAdapter.create).toHaveBeenCalledWith('mongodb');
      expect(ControllerGenerator.generateControllers).toHaveBeenCalledWith('./controllers', spec, dbAdapter);
    });
  });

  describe('generateControllers', () => {
    it('should group paths by resource and generate controllers', async () => {
      const spec = {
        paths: {
          '/resource1': { get: {} },
          '/resource2': { post: {} }
        }
      };
      const dbAdapter = { getImportStatement: jest.fn() };
      const resources = {
        resource1: { paths: [{ path: '/resource1', operations: { get: {} } }] },
        resource2: { paths: [{ path: '/resource2', operations: { post: {} } }] }
      };
      ControllerGenerator.groupPathsByResource = jest.fn().mockReturnValue(resources);
      ControllerGenerator.generateControllerContent = jest.fn().mockResolvedValue('controller content');

      await ControllerGenerator.generateControllers('./controllers', spec, dbAdapter);

      expect(ControllerGenerator.groupPathsByResource).toHaveBeenCalledWith(spec.paths);
      expect(ControllerGenerator.generateControllerContent).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should throw an error if there is an issue generating controllers', async () => {
      const spec = { paths: { '/resource1': { get: {} } } };
      const dbAdapter = { getImportStatement: jest.fn() };
      ControllerGenerator.groupPathsByResource = jest.fn().mockReturnValue({});
      ControllerGenerator.generateControllerContent = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(ControllerGenerator.generateControllers('./controllers', spec, dbAdapter)).rejects.toThrow('Test error');
    });
  });

  describe('groupPathsByResource', () => {
    it('should group paths by resource', () => {
      const paths = {
        '/resource1': { get: {} },
        '/resource2': { post: {} }
      };
      const result = ControllerGenerator.groupPathsByResource(paths);
      expect(result).toEqual({
        resource1: { paths: [{ path: '/resource1', operations: { get: {} } }] },
        resource2: { paths: [{ path: '/resource2', operations: { post: {} } }] }
      });
    });
  });

  describe('generateControllerContent', () => {
    it('should generate controller content', async () => {
      const resourceName = 'resource';
      const modelName = 'Resource';
      const pathGroup = { paths: [{ path: '/resource', operations: { get: {} } }] };
      const dbAdapter = { getImportStatement: jest.fn().mockReturnValue('import statement') };
      const imports = 'import statement';
      const methods = [{ name: 'getResource', content: 'method content' }];
      const exports = 'module.exports = { getResource };';

      ControllerGenerator.generateImports = jest.fn().mockReturnValue(imports);
      ControllerGenerator.generateMethods = jest.fn().mockReturnValue(methods);
      ControllerGenerator.generateExports = jest.fn().mockReturnValue(exports);

      const result = await ControllerGenerator.generateControllerContent(resourceName, modelName, pathGroup, dbAdapter);

      expect(result).toEqual(`${imports}\n\n${methods[0].content}\n\n${exports}`);
    });
  });

  describe('generateImports', () => {
    it('should generate import statements', () => {
      const dbAdapter = { getImportStatement: jest.fn().mockReturnValue('import statement') };
      const result = ControllerGenerator.generateImports(dbAdapter);
      expect(result).toEqual(`const { ApiError } = require('../middleware/errorHandler');\nconst logger = require('../utils/logger');\nimport statement`);
    });
  });

  describe('generateMethods', () => {
    it('should generate methods', () => {
      const resourceName = 'resource';
      const modelName = 'Resource';
      const pathGroup = { paths: [{ path: '/resource', operations: { get: {} } }] };
      const dbAdapter = { getImportStatement: jest.fn() };
      const functionName = 'getResource';
      const validations = ['validation'];
      const implementation = 'implementation';
      const methodContent = 'method content';

      NameGenerator.generateControllerMethodName = jest.fn().mockReturnValue(functionName);
      ValidationGenerator.generateValidations = jest.fn().mockReturnValue(validations);
      ImplementationGenerator.generate = jest.fn().mockReturnValue(implementation);
      MethodGenerator.generateControllerMethod = jest.fn().mockReturnValue(methodContent);

      const result = ControllerGenerator.generateMethods(resourceName, modelName, pathGroup, dbAdapter);

      expect(result).toEqual([{ name: functionName, content: methodContent }]);
    });
  });

  describe('generateExports', () => {
    it('should generate export statements', () => {
      const methodNames = ['getResource'];
      const result = ControllerGenerator.generateExports(methodNames);
      expect(result).toEqual('module.exports = {\n  getResource\n};');
    });
  });
});
