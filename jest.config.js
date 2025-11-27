// jest.config.js
/** @type {import('@jest/types').Config.InitialOptions} */
const isCI = !!process.env.CI;

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test patterns
  testMatch: [
    '**/src/**/__tests__/**/*.test.js',
    '**/src/**/*.test.js'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }]
      ]
    }]
  },

  // Test timeout (increased for deployment tests)
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/commands/*.js',
    'src/utils/**/*.js',
    'src/codegen/generators/**/*.js',
    'src/codegen/RouteGenerator/**/*.js',
    'src/codegen/ControllerGenerator/**/*.js',
    'src/codegen/DatabaseGenerator/**/*.js',
    '!src/**/index.js',
    '!src/**/__tests__/**',
    '!src/**/*.test.js',
    '!src/**/fixtures/**'
  ],
  
  // Coverage thresholds (relaxed locally, strict in CI)
  coverageThreshold: isCI
    ? {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Enforce 100% for code generators (TDD mandate - ADR-022)
        'src/codegen/generators/**/*.js': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        // Enforce 100% for RouteGenerator (TDD mandate - ADR-022)
        'src/codegen/RouteGenerator/**/*.js': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        // Enforce 99%+ for ControllerGenerator (TDD mandate - ADR-022)
        'src/codegen/ControllerGenerator/**/*.js': {
          branches: 100,
          functions: 97,
          lines: 99,
          statements: 99
        },
        // Enforce 98%+ for DatabaseGenerator (TDD mandate - ADR-022)
        'src/codegen/DatabaseGenerator/**/*.js': {
          branches: 95,
          functions: 97,
          lines: 98,
          statements: 98
        },
        // Enforce 95%+ for Utils module (TDD mandate - Phase 1)
        'src/utils/*.js': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    : {
        global: {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0
        },
        // Enforce 100% for code generators even locally (TDD mandate - ADR-022)
        'src/codegen/generators/**/*.js': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        // Enforce 100% for RouteGenerator even locally (TDD mandate - ADR-022)
        'src/codegen/RouteGenerator/**/*.js': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100
        },
        // Enforce 99%+ for ControllerGenerator even locally (TDD mandate - ADR-022)
        'src/codegen/ControllerGenerator/**/*.js': {
          branches: 100,
          functions: 97,
          lines: 99,
          statements: 99
        },
        // Enforce 98%+ for DatabaseGenerator even locally (TDD mandate - ADR-022)
        'src/codegen/DatabaseGenerator/**/*.js': {
          branches: 95,
          functions: 97,
          lines: 98,
          statements: 98
        },
        // Enforce 95%+ for Utils module even locally (TDD mandate - Phase 1)
        'src/utils/*.js': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        }
      },

  // Handle timers
  fakeTimers: {
    enableGlobally: true
  },

  // Test environment configuration
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Error handling
  bail: false,
  verbose: true,

  // Handle module mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};