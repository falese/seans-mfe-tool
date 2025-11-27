// src/commands/__tests__/mfe-spec.test.js
const path = require('path');
const chalk = require('chalk');
const mfeSpecCommand = require('../mfe-spec');
const { run } = require('../../utils/MFEGenerator');

jest.mock('path');
jest.mock('chalk');
jest.mock('../../utils/MFEGenerator');

describe('MFE Spec Command', () => {
  let mockExit;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock process.exit
    mockExit = jest.spyOn(process, 'exit').mockImplementation();
    
    // Mock path methods
    path.resolve.mockImplementation((...args) => args.join('/'));
    
    // Mock chalk methods
    chalk.blue.mockImplementation((msg) => msg);
    chalk.red.mockImplementation((msg) => msg);
    chalk.gray.mockImplementation((msg) => msg);
    
    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/test/cwd');
    
    // Mock run to resolve successfully by default
    run.mockResolvedValue();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    mockExit.mockRestore();
  });

  describe('Generate command', () => {
    it('should run generator with resolved spec file path', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(path.resolve).toHaveBeenCalledWith('/test/cwd', 'mfe-spec.yaml');
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml'
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MFE Spec generate')
      );
    });

    it('should pass output option when specified', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {
        output: '/custom/output'
      });
      
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml',
        '--output=/custom/output'
      ]);
    });

    it('should not pass output option when it equals cwd', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {
        output: '/test/cwd'
      });
      
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml'
      ]);
    });

    it('should pass dry-run option when enabled', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {
        dryRun: true
      });
      
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml',
        '--dry-run'
      ]);
    });

    it('should pass both output and dry-run options together', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {
        output: '/custom/output',
        dryRun: true
      });
      
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml',
        '--output=/custom/output',
        '--dry-run'
      ]);
    });
  });

  describe('Update command', () => {
    it('should run generator with update command', async () => {
      await mfeSpecCommand('update', 'mfe-spec.yaml', {});
      
      expect(run).toHaveBeenCalledWith([
        'update',
        '/test/cwd/mfe-spec.yaml'
      ]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MFE Spec update')
      );
    });

    it('should handle relative spec file paths', async () => {
      await mfeSpecCommand('update', './specs/mfe-spec.yaml', {});
      
      expect(path.resolve).toHaveBeenCalledWith('/test/cwd', './specs/mfe-spec.yaml');
      expect(run).toHaveBeenCalledWith([
        'update',
        '/test/cwd/./specs/mfe-spec.yaml'
      ]);
    });

    it('should handle absolute spec file paths', async () => {
      await mfeSpecCommand('update', '/absolute/path/mfe-spec.yaml', {});
      
      expect(path.resolve).toHaveBeenCalledWith('/test/cwd', '/absolute/path/mfe-spec.yaml');
      expect(run).toHaveBeenCalledWith([
        'update',
        '/test/cwd//absolute/path/mfe-spec.yaml'
      ]);
    });
  });

  describe('Error handling', () => {
    it('should handle generator errors', async () => {
      const error = new Error('Generator failed');
      run.mockRejectedValue(error);
      
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generator failed')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should show stack trace when DEBUG is set', async () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
      
      const error = new Error('Generator failed');
      error.stack = 'Error: Generator failed\n  at test';
      run.mockRejectedValue(error);
      
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stack trace')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(error.stack);
      
      process.env.DEBUG = originalDebug;
    });

    it('should not show stack trace when DEBUG is not set', async () => {
      const originalDebug = process.env.DEBUG;
      delete process.env.DEBUG;
      
      const error = new Error('Generator failed');
      error.stack = 'Error: Generator failed\n  at test';
      run.mockRejectedValue(error);
      
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Stack trace')
      );
      
      if (originalDebug) {
        process.env.DEBUG = originalDebug;
      }
    });

    it('should handle errors without stack property', async () => {
      const error = new Error('No stack');
      delete error.stack;
      run.mockRejectedValue(error);
      
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No stack')
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle generator rejection with string error', async () => {
      run.mockRejectedValue('String error');
      
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Command variations', () => {
    it('should handle empty options object', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml'
      ]);
    });

    it('should handle options with undefined values', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {
        output: undefined,
        dryRun: undefined
      });
      
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml'
      ]);
    });

    it('should handle options with false dryRun', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {
        dryRun: false
      });
      
      expect(run).toHaveBeenCalledWith([
        'generate',
        '/test/cwd/mfe-spec.yaml'
      ]);
    });

    it('should display spec file name in log message', async () => {
      await mfeSpecCommand('generate', 'custom-spec.yaml', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('custom-spec.yaml')
      );
    });

    it('should use chalk.blue for info messages', async () => {
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(chalk.blue).toHaveBeenCalledWith(
        expect.stringContaining('MFE Spec generate')
      );
    });

    it('should use chalk.red for error messages', async () => {
      run.mockRejectedValue(new Error('Test error'));
      
      await mfeSpecCommand('generate', 'mfe-spec.yaml', {});
      
      expect(chalk.red).toHaveBeenCalledWith(
        expect.stringContaining('✗ Command failed')
      );
      expect(chalk.red).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
    });
  });
});
