const { PathGenerator } = require('../generators/PathGenerator');
const { SchemaGenerator } = require('../generators/SchemaGenerator');
const { NameGenerator } = require('../../generators/NameGenerator');

jest.mock('../generators/SchemaGenerator');
jest.mock('../../generators/NameGenerator');

describe('PathGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePathContent', () => {
    it('should generate path content with different paths and operations', () => {
      const paths = [
        ['/resource', { get: { operationId: 'getResource', summary: 'Get Resource' } }],
        ['/resource/{id}', { get: { operationId: 'getResourceById', summary: 'Get Resource By Id' } }]
      ];
      const resourceName = 'resource';
      const controllerName = 'resourceController';
      const spec = {};

      NameGenerator.toPascalCase.mockReturnValue('Resource');
      NameGenerator.toCamelCase.mockReturnValue('getResource');
      SchemaGenerator.generateValidationSchema.mockReturnValue('validationSchema');

      const result = PathGenerator.generatePathContent(paths, resourceName, controllerName, spec);

      expect(result.operationMap).toHaveProperty('getResource');
      expect(result.operationMap).toHaveProperty('getResourceById');
      expect(result.validationSchemas).toContain('validationSchema');
      expect(result.routes).toContain("router.get('/', getResource);");
      expect(result.routes).toContain("router.get('/:id', getResourceById);");
    });
  });
});
