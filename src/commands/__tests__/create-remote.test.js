// src/commands/__tests__/create-remote.test.js
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { createRemoteCommand } = require('../create-remote');

// Mock modules
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('path');

describe('Create Remote Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fs methods
    fs.ensureDir.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.readFile.mockResolvedValue('template content');
    fs.writeFile.mockResolvedValue();
    fs.pathExists.mockResolvedValue(true);
    fs.existsSync.mockReturnValue(true);
    
    // Mock path methods
    path.resolve.mockImplementation((...args) => args.join('/'));
    path.join.mockImplementation((...args) => args.join('/'));
    
    // Mock execSync
    execSync.mockImplementation(() => '');
  });

  it('should create remote MFE with default options', async () => {
    const options = { 
      port: '3001', 
      muiVersion: '5.15.0' 
    };
    
    await createRemoteCommand('test-remote', options);
    
    expect(fs.ensureDir).toHaveBeenCalled();
    expect(fs.copy).toHaveBeenCalled();
    expect(execSync).toHaveBeenCalledWith(
      'npm install',
      expect.any(Object)
    );
  });

  it('should handle custom MUI version', async () => {
    const options = { 
      port: '3001',
      muiVersion: '5.14.0'
    };
    
    await createRemoteCommand('test-remote', options);
    
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('package.json'),
      expect.stringContaining('5.14.0'),
      expect.any(String)
    );
  });

  it('should handle invalid MUI version format', async () => {
    const options = {
      port: '3001',
      muiVersion: 'invalid'
    };

    await expect(createRemoteCommand('test-remote', options))
      .rejects.toThrow('Invalid MUI version format');
  });

  it('should handle invalid port number', async () => {
    const options = {
      port: 'invalid',
      muiVersion: '5.15.0'
    };

    await expect(createRemoteCommand('test-remote', options))
      .rejects.toThrow('Invalid port number');
  });
});