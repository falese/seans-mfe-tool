// jest.config.js
/** @type {import('@jest/types').Config.InitialOptions} */
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
    '!src/**/index.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Handle timers
  timers: 'fake',

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