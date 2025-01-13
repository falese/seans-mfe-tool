const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createRemoteCommand } = require('../create-remote');

jest.mock('fs-extra');
jest.mock('path');
jest.mock('child_process');

describe('createRemoteCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create remote MFE with valid inputs', async () => {
    const name = 'test-remote';
    const options = {
      muiVersion: '5.15.0',
      port: 3001
    };

    fs.ensureDir.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.readFile.mockResolvedValue('__PROJECT_NAME__');
    fs.writeFile.mockResolvedValue();
    execSync.mockReturnValue();

    await createRemoteCommand(name, options);

    expect(fs.ensureDir).toHaveBeenCalledWith(expect.any(String));
    expect(fs.copy).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(fs.writeFile).toHaveBeenCalledTimes(5);
    expect(execSync).toHaveBeenCalledWith('npm install', expect.any(Object));
  });

  it('should throw an error with invalid MUI version format', async () => {
    const name = 'test-remote';
    const options = {
      muiVersion: 'invalid-version',
      port: 3001
    };

    await expect(createRemoteCommand(name, options)).rejects.toThrow('Invalid MUI version format. Expected x.y.z');
  });

  it('should throw an error with invalid port number', async () => {
    const name = 'test-remote';
    const options = {
      muiVersion: '5.15.0',
      port: 'invalid-port'
    };

    await expect(createRemoteCommand(name, options)).rejects.toThrow('Invalid port number. Must be between 1 and 65535');
  });
});
