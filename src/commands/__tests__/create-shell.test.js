// src/commands/__tests__/create-shell.test.js
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createShellCommand } = require('../create-shell');
const { 
  mockProcessExit, 
  mockConsole, 
  setupCommonMocks,
  mockFs,
  mockExec
} = require('./test-utils');

describe('Create Shell Command', () => {
  mockProcessExit();
  mockConsole();
  setupCommonMocks();

  const defaultOptions = {
    port: '3000',
    remotes: undefined
  };

  beforeEach(() => {
    // Setup specific mock for package.json
    mockFs.readFile.mockImplementation(async (filePath) => {
      if (filePath.endsWith('package.json')) {
        return JSON.stringify({
          name: '',
          version: '1.0.0',
          dependencies: {},
          devDependencies: {},
          scripts: {}
        });
      }
      return 'template content';
    });
  });

  it('should create shell application with default options', async () => {
    await createShellCommand('test-shell', defaultOptions);
    
    expect(mockFs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('test-shell'));
    expect(mockFs.copy).toHaveBeenCalled();
    expect(mockExec.execSync).toHaveBeenCalledWith(
      'npm install',
      expect.any(Object)
    );
  });

  it('should handle remote configuration', async () => {
    const options = {
      ...defaultOptions,
      remotes: JSON.stringify({
        "remote1": "http://localhost:3001"
      })
    };

    await createShellCommand('test-shell', options);
    
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('rspack.config.js'),
      expect.stringContaining('remote1'),
      expect.any(String)
    );
  });

  it('should validate port number', async () => {
    const options = {
      ...defaultOptions,
      port: 'invalid'
    };

    await expect(createShellCommand('test-shell', options))
      .rejects
      .toThrow(/Invalid port/);
  });

  it('should handle file system errors', async () => {
    mockFs.ensureDir.mockRejectedValue(new Error('Permission denied'));
    
    await expect(createShellCommand('test-shell', defaultOptions))
      .rejects
      .toThrow(/Permission denied/);
  });

  it('should correctly process template files', async () => {
    await createShellCommand('test-shell', defaultOptions);

    // Check if package.json was processed
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      expect.stringContaining('test-shell'),
      expect.any(String)
    );

    // Check if rspack.config.js was processed
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('rspack.config.js'),
      expect.stringContaining('3000'),
      expect.any(String)
    );
  });
});