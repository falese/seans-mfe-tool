const { MethodGenerator } = require('../generators/MethodGenerator');
const { logger } = require('../../../utils/logger');

jest.mock('../../../utils/logger');

describe('MethodGenerator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateControllerMethod', () => {
    it('should generate a controller method with validations and implementation', () => {
      const functionName = 'getResource';
      const method = 'get';
      const operationPath = '/resource';
      const operation = {};
      const validations = ['const { id } = req.params;'];
      const implementation = 'const item = await Model.Resource.findById(req.params.id);';

      const result = MethodGenerator.generateControllerMethod(
        functionName,
        method,
        operationPath,
        operation,
        validations,
        implementation
      );

      expect(result).toContain(`async function ${functionName}(req, res, next)`);
      expect(result).toContain('logger.info');
      expect(result).toContain('logger.error');
      expect(result).toContain(validations[0]);
      expect(result).toContain(implementation);
    });

    it('should generate a controller method without validations', () => {
      const functionName = 'getResource';
      const method = 'get';
      const operationPath = '/resource';
      const operation = {};
      const validations = [];
      const implementation = 'const item = await Model.Resource.findById(req.params.id);';

      const result = MethodGenerator.generateControllerMethod(
        functionName,
        method,
        operationPath,
        operation,
        validations,
        implementation
      );

      expect(result).toContain(`async function ${functionName}(req, res, next)`);
      expect(result).toContain('logger.info');
      expect(result).toContain('logger.error');
      expect(result).not.toContain('const { id } = req.params;');
      expect(result).toContain(implementation);
    });

    it('should generate a controller method with multiple validations', () => {
      const functionName = 'getResource';
      const method = 'get';
      const operationPath = '/resource';
      const operation = {};
      const validations = [
        'const { id } = req.params;',
        'const { name } = req.query;'
      ];
      const implementation = 'const item = await Model.Resource.findById(req.params.id);';

      const result = MethodGenerator.generateControllerMethod(
        functionName,
        method,
        operationPath,
        operation,
        validations,
        implementation
      );

      expect(result).toContain(`async function ${functionName}(req, res, next)`);
      expect(result).toContain('logger.info');
      expect(result).toContain('logger.error');
      expect(result).toContain(validations[0]);
      expect(result).toContain(validations[1]);
      expect(result).toContain(implementation);
    });
  });
});
