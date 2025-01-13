const { ImplementationGenerator } = require('../generators/ImplementationGenerator');
const { ApiError } = require('../../../middleware/errorHandler');

jest.mock('../../../middleware/errorHandler');

describe('ImplementationGenerator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate GET implementation', () => {
      const result = ImplementationGenerator.generate('get', '/resource', {}, 'Resource', {});
      expect(result).toContain('const item = await');
      expect(result).toContain('res.status(200).json(item);');
    });

    it('should generate POST implementation', () => {
      const result = ImplementationGenerator.generate('post', '/resource', {}, 'Resource', {});
      expect(result).toContain('const newItem = await');
      expect(result).toContain('res.status(201).json(newItem);');
    });

    it('should generate PUT implementation', () => {
      const result = ImplementationGenerator.generate('put', '/resource/{id}', {}, 'Resource', {});
      expect(result).toContain('const updatedItem = await');
      expect(result).toContain('res.status(200).json(updatedItem);');
    });

    it('should generate PATCH implementation', () => {
      const result = ImplementationGenerator.generate('patch', '/resource/{id}', {}, 'Resource', {});
      expect(result).toContain('const patchedItem = await');
      expect(result).toContain('res.status(200).json(patchedItem);');
    });

    it('should generate DELETE implementation', () => {
      const result = ImplementationGenerator.generate('delete', '/resource/{id}', {}, 'Resource', {});
      expect(result).toContain('const deletedItem = await');
      expect(result).toContain('res.status(204).send();');
    });

    it('should generate default implementation for unsupported method', () => {
      const result = ImplementationGenerator.generate('unsupported', '/resource', {}, 'Resource', {});
      expect(result).toContain('throw new ApiError(501, \'Not implemented\');');
    });
  });

  describe('generateGetImplementation', () => {
    it('should generate GET implementation with valid path', () => {
      const dbAdapter = { generateFindQuery: jest.fn().mockReturnValue('find query') };
      const result = ImplementationGenerator.generateGetImplementation('/resource', dbAdapter);
      expect(result).toContain('const item = await find query;');
      expect(result).toContain('res.status(200).json(item);');
    });

    it('should throw error for invalid path', () => {
      const dbAdapter = { generateFindQuery: jest.fn().mockReturnValue(null) };
      expect(() => ImplementationGenerator.generateGetImplementation('/invalid', dbAdapter)).toThrow();
    });
  });
});
