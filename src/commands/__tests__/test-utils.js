// src/commands/__tests__/test-utils.js
// Centralized mocks for command tests
const mockFs = {
  ensureDir: jest.fn().mockResolvedValue(undefined),
  copy: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockImplementation(async (filePath) => {
    if (filePath.endsWith('package.json.ejs')) {
      return '{"name": "<%= name %>", "version": "<%= version || \"1.0.0\" %>" }';
    }
    if (filePath.endsWith('rspack.config.js.ejs')) {
      return 'module.exports = { devServer: { port: <%= port %> }, remotes: <%= remotes %> }';
    }
    return 'template content';
  }),
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
};

const mockPath = {
  resolve: jest.fn((...args) => args.join('/')),
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(p => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn(p => p.split('/').pop())
};

const mockExec = {
  execSync: jest.fn().mockReturnValue('')
};

// Hoisted module mocks for tests that import this helper first
// These ensure command modules use the mocked implementations
jest.mock('fs-extra', () => mockFs);
jest.mock('child_process', () => ({ execSync: mockExec.execSync }));
jest.mock('path', () => ({
  resolve: (...args) => args.join('/'),
  join: (...args) => args.join('/'),
  dirname: (p) => p.split('/').slice(0, -1).join('/'),
  basename: (p) => p.split('/').pop()
}));

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
 * Setup common mocks for fs-extra, path, and child_process
 * Returns a function that sets up the mocks in beforeAll
 */
const setupCommonMocks = () => {
  beforeEach(() => {
    // Reset and restore default implementations before each test
    mockFs.ensureDir.mockReset().mockResolvedValue(undefined);
    mockFs.copy.mockReset().mockResolvedValue(undefined);
    mockFs.readFile.mockReset().mockResolvedValue('template content');
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
    mockPath.basename.mockReset().mockImplementation(p => p.split('/').pop());

    mockExec.execSync.mockReset().mockReturnValue('');
  });
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