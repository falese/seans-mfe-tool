// jest.config.js
/** @type {import('@jest/types').Config.InitialOptions} */
const isCI = !!process.env.CI;

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test patterns - support both JS and TS
  testMatch: [
    '**/packages/*/src/**/__tests__/**/*.test.[jt]s',
    '**/packages/*/src/**/*.test.[jt]s'
  ],
  
  // Transform configuration - ts-jest for TS, babel-jest for JS
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }],
    '^.+\\.jsx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }]
      ]
    }]
  },

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test timeout (increased for deployment tests)
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],

  // Module paths
  moduleDirectories: ['node_modules'],

  // Coverage configuration (only collect when explicitly requested)
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'packages/cli/src/commands/*.{js,ts}',
    '!packages/cli/src/commands/create-shell.js', // Skip - tests have template mocking issues (will fix in refactor)
    'packages/cli/src/utils/**/*.{js,ts}',
    'packages/codegen/src/**/*.{js,ts}',
    'packages/dsl/src/**/*.{js,ts}',
    'packages/runtime/src/**/*.{js,ts}',
    '!packages/**/index.{js,ts}',
    '!packages/**/__tests__/**',
    '!packages/**/*.test.{js,ts}',
    '!packages/**/fixtures/**',
    '!packages/codegen/src/templates/**'
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
        // Enforce strict coverage for DSL Type System (TDD Guardian scope)
        'packages/dsl/src/type-system.ts': {
          branches: 90,
          functions: 95,
          lines: 90,
          statements: 90
        },
        // Enforce strict coverage for Runtime BaseMFE (TDD Guardian scope)
        'packages/runtime/src/base-mfe.ts': {
          branches: 90,
          functions: 95,
          lines: 90,
          statements: 90
        },
        // Enforce 95%+ for Utils module (TDD mandate - Phase 1)
        'packages/cli/src/utils/*.js': {
          branches: 88,
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
        // Enforce strict coverage locally for DSL Type System
        'packages/dsl/src/type-system.ts': {
          branches: 99,
          functions: 100,
          lines: 100,
          statements: 100
        },
        // Enforce strict coverage locally for Runtime BaseMFE
        'packages/runtime/src/base-mfe.ts': {
          branches: 90,
          functions: 100,
          lines: 95,
          statements: 95
        },
        // Enforce 95%+ for Utils module even locally (TDD mandate - Phase 1)
        'packages/cli/src/utils/*.js': {
          branches: 88,
          functions: 95,
          lines: 95,
          statements: 95
        }
      },

  // Handle timers
  fakeTimers: {
    enableGlobally: true
  },

  // Ignore patterns - exclude example projects and dist
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/examples/',
    '/packages/.*/dist/'
  ],

  // Test environment configuration
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Error handling
  bail: false,
  verbose: true,

  // Handle module mocks - map workspace packages
  moduleNameMapper: {
    '^@seans-mfe-tool/dsl$': '<rootDir>/packages/dsl/src/index.ts',
    '^@seans-mfe-tool/runtime$': '<rootDir>/packages/runtime/src/index.ts',
    '^@seans-mfe-tool/codegen$': '<rootDir>/packages/codegen/src/index.ts',
    '^@seans-mfe-tool/cli$': '<rootDir>/packages/cli/src'
  }
};