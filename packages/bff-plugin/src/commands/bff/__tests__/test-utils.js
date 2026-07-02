// src/commands/__tests__/test-utils.js
// Centralized mocks for command tests

// Hoisted module mocks - MUST be at the top
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  copy: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('template content'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  writeJson: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue(['package.json.ejs', 'rspack.config.js.ejs']),
  stat: jest.fn().mockResolvedValue({ isDirectory: () => false }),
  pathExists: jest.fn().mockResolvedValue(true),
  existsSync: jest.fn().mockReturnValue(true),
  remove: jest.fn().mockResolvedValue(undefined),
  readJson: jest.fn().mockResolvedValue({
    name: '',
    version: '1.0.0',
    dependencies: {},
    devDependencies: {},
    scripts: {}
  })
}));

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue('')
}));

jest.mock('path', () => ({
  resolve: jest.fn((...args) => args.join('/')),
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(p => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn((p, ext) => {
    const base = p.split('/').pop();
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  }),
  extname: jest.fn(p => {
    const match = p.match(/\.[^./]+$/);
    return match ? match[0] : '';
  })
}));

// Get references to the mocked modules
const mockFs = require('fs-extra');
const mockPath = require('path');
const mockExec = require('child_process');

/**
 * Setup function to mock process.exit
 * Returns a function that sets up the mock in beforeAll
 */
const mockProcessExit = () => {
  // This is intentionally empty - process.exit is already mocked in jest.setup.js
  // This function exists for compatibility with existing test structure
};

/**
 * Setup function to mock console methods
 * Returns a function that sets up the mock in beforeAll
 */
const mockConsole = () => {
  // Console is already mocked in individual tests as needed
  // This function exists for compatibility with existing test structure
};

/**
 * Reset and configure common mocks for fs-extra, path, and child_process
 * Call this function directly in beforeEach blocks
 */
const setupCommonMocks = () => {
  // Reset and restore default implementations
  mockFs.ensureDir.mockReset().mockResolvedValue(undefined);
  mockFs.copy.mockReset().mockResolvedValue(undefined);
  mockFs.readFile.mockReset().mockImplementation(async (filePath) => {
    if (filePath.endsWith('package.json.ejs')) {
      return '{"name": "<%= name %>", "version": "<%= version || \\"1.0.0\\" %>" }';
    }
    if (filePath.endsWith('rspack.config.js.ejs')) {
      return 'module.exports = { devServer: { port: <%= port %> }, remotes: <%= remotes %> }';
    }
    return 'template content';
  });
  mockFs.writeFile.mockReset().mockResolvedValue(undefined);
  mockFs.writeJson.mockReset().mockResolvedValue(undefined);
  mockFs.readdir.mockReset().mockResolvedValue(['package.json.ejs', 'rspack.config.js.ejs']);
  mockFs.stat.mockReset().mockResolvedValue({ isDirectory: () => false });
  mockFs.pathExists.mockReset().mockResolvedValue(true);
  mockFs.existsSync.mockReset().mockReturnValue(true);
  mockFs.remove.mockReset().mockResolvedValue(undefined);
  mockFs.readJson.mockReset().mockResolvedValue({
    name: '',
    version: '1.0.0',
    dependencies: {},
    devDependencies: {},
    scripts: {}
  });

  mockPath.resolve.mockReset().mockImplementation((...args) => args.join('/'));
  mockPath.join.mockReset().mockImplementation((...args) => args.join('/'));
  mockPath.dirname.mockReset().mockImplementation(p => p.split('/').slice(0, -1).join('/'));
  mockPath.basename.mockReset().mockImplementation((p, ext) => {
    const base = p.split('/').pop();
    if (ext && base.endsWith(ext)) {
      return base.slice(0, -ext.length);
    }
    return base;
  });
  mockPath.extname.mockReset().mockImplementation(p => {
    const match = p.match(/\.[^./]+$/);
    return match ? match[0] : '';
  });

  mockExec.execSync.mockReset().mockReturnValue('');

  // Stable cwd for path expectations
  if (process.cwd.mockRestore) {
    // If previously mocked, restore then re-mock
    process.cwd.mockRestore();
  }
  jest.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
};

/**
 * Helper to handle async process.exit expectations
 */
const expectProcessExit = async (fn, expectedCode = 1) => {
  try {
    await fn();
    throw new Error('Expected process.exit to be called');
  } catch (error) {
    if (!error.message.includes('Process exit with code')) {
      throw error;
    }
    expect(error.message).toBe(`Process exit with code ${expectedCode}`);
  }
};

/**
 * Create OpenAPI spec for testing
 */
const createTestSpec = (paths = {}) => ({
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0'
  },
  paths,
  components: {
    schemas: {}
  }
});

/**
 * Create package.json content for testing
 */
const createPackageJson = (name = '') => ({
  name,
  version: '1.0.0',
  dependencies: {},
  devDependencies: {},
  scripts: {}
});

// Backward-compatible alias expected by some tests
const createTestData = {
  apiSpec: createTestSpec,
  packageJson: createPackageJson
};

module.exports = {
  mockFs,
  mockPath,
  mockExec,
  mockProcessExit,
  mockConsole,
  setupCommonMocks,
  expectProcessExit,
  createTestSpec,
  createPackageJson,
  createTestData
};