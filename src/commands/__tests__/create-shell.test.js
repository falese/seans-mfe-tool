const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createShellCommand } = require('../create-shell');

jest.mock('fs-extra');
jest.mock('path');
jest.mock('child_process');

describe('createShellCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create shell application with valid inputs', async () => {
    const name = 'test-shell';
    const options = {
      port: 3000,
      remotes: '{}'
    };

    fs.ensureDir.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.readFile.mockResolvedValue('__PROJECT_NAME__');
    fs.writeFile.mockResolvedValue();
    execSync.mockReturnValue();

    await createShellCommand(name, options);

    expect(fs.ensureDir).toHaveBeenCalledWith(expect.any(String));
    expect(fs.copy).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(fs.writeFile).toHaveBeenCalledTimes(4);
    expect(execSync).toHaveBeenCalledWith('npm install', expect.any(Object));
  });

  it('should throw an error with invalid port number', async () => {
    const name = 'test-shell';
    const options = {
      port: 'invalid-port',
      remotes: '{}'
    };

    await expect(createShellCommand(name, options)).rejects.toThrow('Invalid port number. Must be between 1 and 65535');
  });

  it('should throw an error if template directory does not exist', async () => {
    const name = 'test-shell';
    const options = {
      port: 3000,
      remotes: '{}'
    };

    fs.existsSync.mockReturnValue(false);

    await expect(createShellCommand(name, options)).rejects.toThrow('Template directory not found:');
  });
});
