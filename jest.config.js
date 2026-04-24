// jest.config.js
/** @type {import('@jest/types').Config.InitialOptions} */
const isCI = !!process.env.CI;

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test patterns - support both JS and TS
  testMatch: [
    '**/src/**/__tests__/**/*.test.[jt]s',
    '**/src/**/*.test.[jt]s'
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
  moduleDirectories: ['node_modules', 'src'],

  // Coverage configuration (only collect when explicitly requested)
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'src/commands/*.{js,ts}',
    '!src/commands/create-shell.js', // Skip - tests have template mocking issues (will fix in refactor)
    '!src/commands/api.ts',          // Skip - no tests yet; full oclif port tracked in migration plan
    '!src/commands/deploy.ts',       // Skip - no tests yet; full oclif port tracked in migration plan
    '!src/commands/schemas.ts',      // Skip - no tests yet; CLI scaffolding only
    'src/utils/**/*.{js,ts}',
    'src/codegen/UnifiedGenerator/**/*.{js,ts}',
    'src/codegen/APIGenerator/**/*.{js,ts}',
    // Include DSL/runtime for TDD Guardian phase
    'src/dsl/**/*.{js,ts}',
    'src/runtime/**/*.{js,ts}',
    'src/build/**/*.{js,ts}',
    '!src/**/index.{js,ts}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{js,ts}',
    '!src/**/*.d.ts',          // Skip - TypeScript declaration files have no executable code
    '!src/dsl/schema.js',      // Skip - compiled Peggy parser artifact (not a source file)
    '!src/runtime/graphql-ws-client.ts', // Skip - no tests yet; tracked for future coverage
    '!src/**/fixtures/**',
    '!src/codegen/templates/**'
  ],
  
  // Coverage thresholds (relaxed locally, strict in CI)
  // NOTE: CI thresholds are calibrated for the test suite with excluded tests
  // (remote-mfe.integration.test.ts excluded due to jest-environment-jsdom@30/jest@29
  // incompatibility; json-contract.test.ts excluded due to ts-node/Node20 CJS issue).
  // Restore to 80% global once those tests are re-enabled.
  coverageThreshold: isCI
    ? {
        global: {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70
        },
        // DSL Type System has dedicated coverage tests — keep strict
        'src/dsl/type-system.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        // Runtime BaseMFE has dedicated coverage tests — keep strict
        'src/runtime/base-mfe.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        // Utils module has dedicated tests but branch coverage varies
        'src/utils/*.js': {
          branches: 75,
          functions: 85,
          lines: 85,
          statements: 85
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
        'src/dsl/type-system.ts': {
          branches: 99,
          functions: 100,
          lines: 100,
          statements: 100
        },
        // Enforce strict coverage locally for Runtime BaseMFE
        'src/runtime/base-mfe.ts': {
          branches: 90,
          functions: 100,
          lines: 95,
          statements: 95
        },
        // Enforce 95%+ for Utils module even locally (TDD mandate - Phase 1)
        'src/utils/*.js': {
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
    '/examples/'
  ],

  // Test environment configuration
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Error handling
  bail: false,
  verbose: true,

  // Handle module mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@seans-mfe/contracts$': '<rootDir>/packages/contracts/src/index.ts',
    '^@seans-mfe/contracts/(.*)$': '<rootDir>/packages/contracts/src/$1',
    '^@seans-mfe/oclif-base$': '<rootDir>/packages/oclif-base/src/index.ts',
    '^@seans-mfe/oclif-base/(.*)$': '<rootDir>/packages/oclif-base/src/$1'
  }
};