// src/commands/__tests__/build.test.js
const { buildCommand } = require('../build');
const { BuildManager } = require('../../build/BuildManager');
const chalk = require('chalk');

jest.mock('../../build/BuildManager');
jest.mock('chalk');

describe('Build Command', () => {
  let mockExit;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation();
    
    // Mock chalk
    chalk.red = jest.fn((msg) => msg);
    chalk.gray = jest.fn((msg) => msg);
    
    // Mock BuildManager methods
    BuildManager.prototype.initialize = jest.fn().mockResolvedValue();
    BuildManager.prototype.build = jest.fn().mockResolvedValue();
    BuildManager.prototype.serve = jest.fn().mockResolvedValue();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    mockExit.mockRestore();
  });

  it('should execute build process', async () => {
    const options = {
      name: 'test-app',
      type: 'remote',
      mode: 'production'
    };
    await buildCommand(options);
    
    expect(BuildManager.prototype.initialize).toHaveBeenCalled();
    expect(BuildManager.prototype.build).toHaveBeenCalled();
  });

  it('should start development server when serve option is true', async () => {
    const options = {
      name: 'test-app',
      type: 'remote',
      mode: 'development',
      serve: true
    };
    await buildCommand(options);
    
    expect(BuildManager.prototype.serve).toHaveBeenCalled();
  });

  it('should handle initialization errors', async () => {
    BuildManager.prototype.initialize.mockRejectedValue(new Error('Init failed'));
    
    await buildCommand({ name: 'test-app' });
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✗ Command failed'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Init failed'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle build errors', async () => {
    BuildManager.prototype.build.mockRejectedValue(new Error('Build failed'));
    
    await buildCommand({ name: 'test-app' });
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✗ Command failed'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Build failed'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should handle serve errors', async () => {
    BuildManager.prototype.serve.mockRejectedValue(new Error('Serve failed'));
    
    await buildCommand({ name: 'test-app', serve: true });
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('✗ Command failed'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Serve failed'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should show stack trace when DEBUG is set', async () => {
    const originalDebug = process.env.DEBUG;
    process.env.DEBUG = 'true';
    
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n  at test';
    BuildManager.prototype.initialize.mockRejectedValue(error);
    
    await buildCommand({ name: 'test-app' });
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Stack trace'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(error.stack);
    
    process.env.DEBUG = originalDebug;
  });

  it('should not show stack trace when DEBUG is not set', async () => {
    const originalDebug = process.env.DEBUG;
    delete process.env.DEBUG;
    
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n  at test';
    BuildManager.prototype.initialize.mockRejectedValue(error);
    
    await buildCommand({ name: 'test-app' });
    
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Stack trace'));
    
    if (originalDebug) {
      process.env.DEBUG = originalDebug;
    }
  });

  it('should handle errors without stack property', async () => {
    const error = new Error('No stack');
    delete error.stack;
    BuildManager.prototype.build.mockRejectedValue(error);
    
    await buildCommand({ name: 'test-app' });
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No stack'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should use chalk.red for error messages', async () => {
    BuildManager.prototype.build.mockRejectedValue(new Error('Test error'));
    
    await buildCommand({ name: 'test-app' });
    
    expect(chalk.red).toHaveBeenCalledWith(expect.stringContaining('✗ Command failed'));
    expect(chalk.red).toHaveBeenCalledWith(expect.stringContaining('Test error'));
  });
});
