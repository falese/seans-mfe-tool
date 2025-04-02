// src/commands/__tests__/test-utils.js
const mockFs = {
  ensureDir: jest.fn().mockResolvedValue(undefined),
  copy: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('template content'),
  writeFile: jest.fn().mockResolvedValue(undefined),
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

// Setup global test environment
beforeAll(() => {
  // Mock fs, path, and child_process
  jest.mock('fs-extra', () => mockFs);
  jest.mock('path', () => mockPath);
  jest.mock('child_process', () => mockExec);

  // Mock process.exit
  const originalExit = process.exit;
  process.exit = jest.fn(code => {
    throw new Error(`Process exit with code ${code}`);
  });

  // Mock console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();

  return () => {
    process.exit = originalExit;
    Object.assign(console, originalConsole);
    jest.resetModules();
  };
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after each suite
afterAll(() => {
  jest.restoreAllMocks();
});

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

module.exports = {
  mockFs,
  mockPath,
  mockExec,
  expectProcessExit,
  createTestSpec,
  createPackageJson
};