// src/commands/__tests__/deploy.test.js
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { 
  deployCommand, 
  verifyProjectStructure, 
  copyDockerFiles, 
  developmentDeploy,
  productionDeploy,
  dockerComposeProductionDeploy,
  kubernetesProductionDeploy,
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
    execSync.mockImplementation(() => '');
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
        expect.stringContaining('Dockerfile.shell'),
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
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('inspect')) return 'running';
        return '';
      });

      await expect(developmentDeploy(mockOptions)).resolves.not.toThrow();
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('docker build'),
        expect.any(Object)
      );
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('docker run'),
        expect.any(Object)
      );
    });

    it('should handle existing container cleanup', async () => {
      execSync.mockImplementationOnce(() => { throw new Error(); }); // First stop fails
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('inspect')) return 'running';
        return '';
      });

      await expect(developmentDeploy(mockOptions)).resolves.not.toThrow();
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('docker stop'),
        expect.any(Object)
      );
    });

    it('should mount volumes correctly', async () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('inspect')) return 'running';
        return '';
      });

      await developmentDeploy(mockOptions);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('-v'),
        expect.any(Object)
      );
    });

    it('should throw error on build failure', async () => {
      execSync.mockImplementationOnce(() => { throw new Error('Build failed'); });
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

      execSync.mockImplementation((cmd) => {
        if (cmd.includes('inspect')) return 'running';
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
      execSync.mockImplementation(() => {
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

      execSync.mockImplementation(() => {
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

      execSync.mockImplementation((cmd) => {
        if (cmd.includes('inspect')) return 'running';
        if (cmd.includes('logs -f')) return '';
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

      execSync.mockImplementation((cmd) => {
        if (cmd.includes('inspect')) return 'running';
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

      execSync.mockImplementation((cmd) => {
        if (cmd.includes('docker build')) {
          const error = new Error('Build failed');
          error.message = 'Build failed';
          throw error;
        }
        if (cmd.includes('inspect')) return 'running';
        return '';
      });

      await expect(deployCommand(options)).rejects.toThrow();
    });
  });

  describe('waitForContainer', () => {
    it('should return true when container is running immediately', async () => {
      execSync.mockReturnValue('running\n');
      
      await expect(waitForContainer('test-container')).resolves.toBe(true);
    });
  });

  describe('productionDeploy', () => {
    beforeEach(() => {
      // Setup common production deploy mocks
      const packageJsonContent = { name: 'test-app', version: '1.0.0', database: 'sqlite' };
      fs.readJson.mockResolvedValue(packageJsonContent);
      fs.readFile.mockResolvedValue('template content');
      fs.writeFile.mockResolvedValue();
      fs.ensureDir.mockResolvedValue();
      path.join.mockImplementation((...args) => args.join('/'));
      path.resolve.mockImplementation((...args) => args.join('/'));
    });

    it('should deploy using docker-compose mode', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000,
        mode: 'docker-compose'
      };

      await expect(productionDeploy(options)).resolves.not.toThrow();
      expect(fs.ensureDir).toHaveBeenCalled();
    });

    it('should deploy using kubernetes mode', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000,
        mode: 'kubernetes'
      };

      execSync.mockReturnValue('');

      await expect(productionDeploy(options)).resolves.not.toThrow();
    });

    it('should handle k8s mode alias', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000,
        mode: 'k8s'
      };

      execSync.mockReturnValue('');

      await expect(productionDeploy(options)).resolves.not.toThrow();
    });

    it('should handle production deployment errors', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000,
        mode: 'docker-compose'
      };

      fs.readJson.mockRejectedValue(new Error('File read error'));

      await expect(productionDeploy(options)).rejects.toThrow();
    });
  });

  describe('dockerComposeProductionDeploy', () => {
    beforeEach(() => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0', database: 'sqlite' };
      fs.readJson.mockResolvedValue(packageJsonContent);
      fs.readFile.mockResolvedValue('template content');
      fs.writeFile.mockResolvedValue();
      fs.ensureDir.mockResolvedValue();
      path.join.mockImplementation((...args) => args.join('/'));
      path.resolve.mockImplementation((...args) => args.join('/'));
    });

    it('should generate docker-compose files', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000
      };

      await expect(dockerComposeProductionDeploy(options)).resolves.not.toThrow();
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle registry option', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000,
        registry: 'myregistry.io'
      };

      await expect(dockerComposeProductionDeploy(options)).resolves.not.toThrow();
    });

    it('should handle api type for Dockerfile selection', async () => {
      const options = {
        name: 'test-api',
        type: 'api',
        port: 4000
      };

      await expect(dockerComposeProductionDeploy(options)).resolves.not.toThrow();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('Dockerfile.production.api'),
        'utf8'
      );
    });

    it('should generate nginx config for shell type', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000
      };

      await expect(dockerComposeProductionDeploy(options)).resolves.not.toThrow();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('nginx.production.conf'),
        'utf8'
      );
    });

    it('should generate nginx config for remote type', async () => {
      const options = {
        name: 'test-remote',
        type: 'remote',
        port: 3001
      };

      await expect(dockerComposeProductionDeploy(options)).resolves.not.toThrow();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('nginx.production.conf'),
        'utf8'
      );
    });
  });

  describe('kubernetesProductionDeploy', () => {
    beforeEach(() => {
      const packageJsonContent = { name: 'test-app', version: '1.0.0', database: 'sqlite' };
      fs.readJson.mockResolvedValue(packageJsonContent);
      fs.readFile.mockResolvedValue('template content');
      fs.writeFile.mockResolvedValue();
      fs.ensureDir.mockResolvedValue();
      path.join.mockImplementation((...args) => args.join('/'));
      path.resolve.mockImplementation((...args) => args.join('/'));
      execSync.mockReturnValue('');
    });

    it('should generate kubernetes manifests', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000
      };

      await expect(kubernetesProductionDeploy(options)).resolves.not.toThrow();
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle replicas option', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000,
        replicas: 3
      };

      await expect(kubernetesProductionDeploy(options)).resolves.not.toThrow();
    });

    it('should handle namespace option', async () => {
      const options = {
        name: 'test-app',
        type: 'shell',
        port: 3000,
        namespace: 'production'
      };

      await expect(kubernetesProductionDeploy(options)).resolves.not.toThrow();
      // Namespace should be used in template data
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        expect.stringContaining('production')
      );
    });

    it('should handle api type', async () => {
      const options = {
        name: 'test-api',
        type: 'api',
        port: 4000
      };

      await expect(kubernetesProductionDeploy(options)).resolves.not.toThrow();
    });
  });
});