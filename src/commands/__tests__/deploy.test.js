const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { deployCommand, verifyProjectStructure } = require('../deploy');

jest.mock('fs-extra');
jest.mock('path');
jest.mock('child_process');

describe('deployCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should deploy with valid inputs', async () => {
    const options = {
      type: 'remote',
      env: 'development',
      port: 3000,
      name: 'test-app',
      registry: 'test-registry'
    };

    fs.pathExists.mockResolvedValue(true);
    fs.ensureDir.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    execSync.mockReturnValue();

    await deployCommand(options);

    expect(fs.ensureDir).toHaveBeenCalledWith(expect.any(String));
    expect(fs.copy).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('docker build'), expect.any(Object));
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('docker run'), expect.any(Object));
  });

  it('should throw an error with missing required files', async () => {
    const options = {
      type: 'remote',
      env: 'development',
      port: 3000,
      name: 'test-app',
      registry: 'test-registry'
    };

    fs.pathExists.mockResolvedValue(false);

    await expect(deployCommand(options)).rejects.toThrow('Missing required files:');
  });

  it('should throw an error with invalid Docker template', async () => {
    const options = {
      type: 'invalid-type',
      env: 'development',
      port: 3000,
      name: 'test-app',
      registry: 'test-registry'
    };

    fs.pathExists.mockResolvedValue(true);
    fs.ensureDir.mockResolvedValue();
    fs.copy.mockRejectedValue(new Error('Docker template not found'));

    await expect(deployCommand(options)).rejects.toThrow('Docker template not found');
  });
});

describe('verifyProjectStructure', () => {
  it('should verify project structure with all required files', async () => {
    fs.existsSync.mockReturnValue(true);

    await verifyProjectStructure();

    expect(fs.existsSync).toHaveBeenCalledTimes(5);
  });

  it('should throw an error with missing required files', async () => {
    fs.existsSync.mockReturnValueOnce(false);

    await expect(verifyProjectStructure()).rejects.toThrow('Missing required files:');
  });
});
