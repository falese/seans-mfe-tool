module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/e2e/**/*.e2e.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/e2e/setup.ts'],
  moduleNameMapper: {
    '^@seans-mfe-tool/runtime$': '<rootDir>/../../dist/runtime',
    '^@seans-mfe-tool/dsl$': '<rootDir>/../../dist/dsl',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        skipLibCheck: true,
      }
    }]
  }
};
