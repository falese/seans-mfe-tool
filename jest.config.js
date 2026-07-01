// jest.config.js
/** @type {import('@jest/types').Config.InitialOptions} */

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
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'src/commands/*.{js,ts}',
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
    '!src/**/fixtures/**',
    '!src/codegen/templates/**'
  ],
  
  // Coverage thresholds. Phase 1.1 adds per-file thresholds for the four
  // newly-covered files (api.ts, deploy.ts, schemas.ts, graphql-ws-client.ts)
  // and tightens the global floor.
  //
  // Targets (from the production-readiness roadmap):
  //   Commands: 90% statements / 85% branches / 90% functions / 90% lines
  //   Runtime:  95% statements / 90% branches / 100% functions / 95% lines
  //
  // Local thresholds match CI so contributors hit the same gate before push.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
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
    },
    // Phase 1.1: command-layer coverage targets
    'src/commands/api.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/commands/deploy.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/commands/schemas.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Phase 1.1: runtime-layer coverage target
    'src/runtime/graphql-ws-client.ts': {
      branches: 90,
      functions: 100,
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
    '^@seans-mfe/dsl$': '<rootDir>/packages/dsl/src/index.ts',
    '^@seans-mfe/dsl/(.*)$': '<rootDir>/packages/dsl/src/$1',
    '^@seans-mfe/oclif-base$': '<rootDir>/packages/oclif-base/src/index.ts',
    '^@seans-mfe/oclif-base/(.*)$': '<rootDir>/packages/oclif-base/src/$1',
    '^@seans-mfe/framework-react$': '<rootDir>/packages/framework-react/src/index.ts',
    '^@seans-mfe/framework-react/(.*)$': '<rootDir>/packages/framework-react/src/$1',
    '^@seans-mfe/framework-angular$': '<rootDir>/packages/framework-angular/src/index.ts',
    '^@seans-mfe/framework-angular/(.*)$': '<rootDir>/packages/framework-angular/src/$1'
  }
};