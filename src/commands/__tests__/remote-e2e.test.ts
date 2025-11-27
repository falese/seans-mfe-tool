/**
 * E2E Integration Test: remote:init → remote:generate flow
 * 
 * Tests the complete workflow of:
 * 1. Creating a new remote MFE with remote:init
 * 2. Modifying the manifest to add capabilities
 * 3. Running remote:generate to create capability files
 * 
 * Uses a temp directory with real filesystem operations (no mocks)
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

// Import actual commands (not mocked)
import { remoteInitCommand } from '../remote-init';
import { remoteGenerateCommand } from '../remote-generate';

describe('E2E: remote:init → remote:generate', () => {
  let testDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
  });

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = path.join(os.tmpdir(), `mfe-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(testDir);
    
    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original cwd
    process.chdir(originalCwd);
    
    // Cleanup temp directory
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('Full Workflow', () => {
    it('should create MFE, add capability, and generate files', async () => {
      const mfeName = 'test-feature';
      const mfeDir = path.join(testDir, mfeName);

      // Step 1: Initialize new remote MFE
      await remoteInitCommand(mfeName, { skipInstall: true });

      // Verify directory structure created
      expect(await fs.pathExists(mfeDir)).toBe(true);
      expect(await fs.pathExists(path.join(mfeDir, 'mfe-manifest.yaml'))).toBe(true);
      expect(await fs.pathExists(path.join(mfeDir, 'package.json'))).toBe(true);
      expect(await fs.pathExists(path.join(mfeDir, 'rspack.config.js'))).toBe(true);
      expect(await fs.pathExists(path.join(mfeDir, 'src/App.tsx'))).toBe(true);

      // Step 2: Read and modify manifest to add a capability
      const manifestPath = path.join(mfeDir, 'mfe-manifest.yaml');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = yaml.load(manifestContent) as Record<string, any>;

      // Add a domain capability
      manifest.capabilities = [
        ...(manifest.capabilities || []),
        {
          UserProfile: {
            type: 'domain',
            description: 'User profile management',
            handler: 'src/features/UserProfile/UserProfile'
          }
        }
      ];

      await fs.writeFile(manifestPath, yaml.dump(manifest), 'utf8');

      // Step 3: Run generate from inside the MFE directory
      process.chdir(mfeDir);
      await remoteGenerateCommand({ force: false });

      // Verify capability files were generated
      expect(await fs.pathExists(path.join(mfeDir, 'src/features/UserProfile/UserProfile.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(mfeDir, 'src/features/UserProfile/UserProfile.test.tsx'))).toBe(true);
      expect(await fs.pathExists(path.join(mfeDir, 'src/features/UserProfile/index.ts'))).toBe(true);
    }, 30000); // Extended timeout for filesystem operations

    it('should handle dry-run mode without writing files', async () => {
      const mfeName = 'dry-run-test';
      const mfeDir = path.join(testDir, mfeName);

      // Initialize MFE
      await remoteInitCommand(mfeName, { skipInstall: true });

      // Add capability
      const manifestPath = path.join(mfeDir, 'mfe-manifest.yaml');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = yaml.load(manifestContent) as Record<string, any>;
      
      manifest.capabilities = [
        { Dashboard: { type: 'domain', description: 'Dashboard view' } }
      ];
      await fs.writeFile(manifestPath, yaml.dump(manifest), 'utf8');

      // Run generate in dry-run mode
      process.chdir(mfeDir);
      await remoteGenerateCommand({ dryRun: true });

      // Files should NOT be created in dry-run mode
      expect(await fs.pathExists(path.join(mfeDir, 'src/features/Dashboard'))).toBe(false);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should fail when directory already exists without --force', async () => {
      const mfeName = 'existing-project';
      const mfeDir = path.join(testDir, mfeName);

      // Create directory first
      await fs.ensureDir(mfeDir);
      await fs.writeFile(path.join(mfeDir, 'existing-file.txt'), 'content');

      // Should throw error
      await expect(remoteInitCommand(mfeName, { skipInstall: true }))
        .rejects.toThrow();
    });

    it('should succeed with --force when directory exists', async () => {
      const mfeName = 'force-overwrite';
      const mfeDir = path.join(testDir, mfeName);

      // Create directory first
      await fs.ensureDir(mfeDir);

      // Should succeed with force flag
      await remoteInitCommand(mfeName, { skipInstall: true, force: true });

      expect(await fs.pathExists(path.join(mfeDir, 'mfe-manifest.yaml'))).toBe(true);
    });
  });

  describe('Manifest Validation', () => {
    it('should validate manifest structure', async () => {
      const mfeName = 'validation-test';
      const mfeDir = path.join(testDir, mfeName);

      await remoteInitCommand(mfeName, { skipInstall: true });

      // Read generated manifest
      const manifestPath = path.join(mfeDir, 'mfe-manifest.yaml');
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = yaml.load(manifestContent) as Record<string, any>;

      // Verify manifest structure
      expect(manifest.name).toBe(mfeName);
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.type).toBe('remote');
      expect(manifest.language).toBe('typescript');
      expect(manifest.endpoint).toBeDefined();
      expect(manifest.remoteEntry).toBeDefined();
    });
  });

  describe('Generated File Content', () => {
    it('should generate valid TypeScript files', async () => {
      const mfeName = 'content-test';
      const mfeDir = path.join(testDir, mfeName);

      await remoteInitCommand(mfeName, { skipInstall: true });

      // Verify App.tsx content
      const appContent = await fs.readFile(path.join(mfeDir, 'src/App.tsx'), 'utf8');
      expect(appContent).toContain('React');
      expect(appContent).toContain('export default App'); // Verify it's a valid component

      // Verify package.json has correct dependencies
      const packageJson = await fs.readJson(path.join(mfeDir, 'package.json'));
      expect(packageJson.name).toBe(mfeName);
      expect(packageJson.dependencies.react).toBeDefined();
      expect(packageJson.dependencies['@mui/material']).toBeDefined();
    });

    it('should generate valid rspack.config.js with Module Federation', async () => {
      const mfeName = 'rspack-test';
      const mfeDir = path.join(testDir, mfeName);

      await remoteInitCommand(mfeName, { skipInstall: true, port: 3005 });

      const rspackConfig = await fs.readFile(path.join(mfeDir, 'rspack.config.js'), 'utf8');
      
      // Should contain Module Federation config
      expect(rspackConfig).toContain('ModuleFederation');
      expect(rspackConfig).toContain('remoteEntry.js');
      expect(rspackConfig).toContain('3005'); // Custom port
    });
  });
});
