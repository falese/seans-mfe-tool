const fs = require('fs-extra');
const path = require('path');
const { RouteGenerator } = require('../RouteGenerator');
const { NameGenerator } = require('../../generators/NameGenerator');

jest.mock('fs-extra');
jest.mock('path');
jest.mock('../../generators/NameGenerator');

describe('RouteGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate routes with valid OpenAPI spec', async () => {
      const routesDir = './routes';
      const spec = {
        paths: {
          '/resource': {
            get: {
              operationId: 'getResource',
              summary: 'Get Resource'
            }
          }
        }
      };

      fs.ensureDir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      NameGenerator.toCamelCase.mockReturnValue('resource');
      NameGenerator.toKebabCase.mockReturnValue('resource');

      await RouteGenerator.generate(routesDir, spec);

      expect(fs.ensureDir).toHaveBeenCalledWith(routesDir);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid OpenAPI spec', async () => {
      const routesDir = './routes';
      const spec = {};

      fs.ensureDir.mockResolvedValue();

      await expect(RouteGenerator.generate(routesDir, spec)).resolves.toBeUndefined();

      expect(fs.ensureDir).toHaveBeenCalledWith(routesDir);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('generateRouteFile', () => {
    it('should generate route file content', () => {
      const paths = [
        ['/resource', { get: { operationId: 'getResource', summary: 'Get Resource' } }]
      ];
      const resourceName = 'resource';
      const spec = {};

      const result = RouteGenerator.generateRouteFile(paths, resourceName, spec);

      expect(result).toContain("const express = require('express');");
      expect(result).toContain("const { getResource } = require('../controllers/resource.controller');");
      expect(result).toContain("router.get('/', getResource);");
    });
  });
});
