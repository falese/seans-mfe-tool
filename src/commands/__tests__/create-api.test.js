const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createApiCommand } = require('../create-api');
const { DatabaseGenerator } = require('../../utils/databaseGenerator');
const { ControllerGenerator } = require('../../utils/ControllerGenerator');
const { generateRoutes } = require('../../utils/RouteGenerator');

jest.mock('fs-extra');
jest.mock('path');
jest.mock('child_process');
jest.mock('../../utils/databaseGenerator');
jest.mock('../../utils/ControllerGenerator');
jest.mock('../../utils/RouteGenerator');

describe('createApiCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create API with valid inputs', async () => {
    const name = 'test-api';
    const options = {
      spec: 'test-spec.yaml',
      database: 'sqlite',
      port: 3001
    };

    fs.pathExists.mockResolvedValue(true);
    fs.ensureDir.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    execSync.mockReturnValue();

    await createApiCommand(name, options);

    expect(fs.ensureDir).toHaveBeenCalledWith(expect.any(String));
    expect(fs.copy).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(DatabaseGenerator.generate).toHaveBeenCalledWith('sqlite', expect.any(String), expect.any(Object));
    expect(ControllerGenerator.generate).toHaveBeenCalledWith('sqlite', expect.any(String), expect.any(Object));
    expect(generateRoutes).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
    expect(execSync).toHaveBeenCalledWith('npm install', expect.any(Object));
  });

  it('should throw an error with invalid database type', async () => {
    const name = 'test-api';
    const options = {
      spec: 'test-spec.yaml',
      database: 'invalid-db',
      port: 3001
    };

    await expect(createApiCommand(name, options)).rejects.toThrow('Unsupported database type: invalid-db. Valid options are: mongodb, mongo, sqlite, sql');
  });

  it('should throw an error with invalid OpenAPI spec', async () => {
    const name = 'test-api';
    const options = {
      spec: 'invalid-spec.yaml',
      database: 'sqlite',
      port: 3001
    };

    fs.pathExists.mockResolvedValue(true);
    fs.ensureDir.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    execSync.mockReturnValue();

    await expect(createApiCommand(name, options)).rejects.toThrow('Failed to parse OpenAPI spec:');
  });
});
