module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    // TODO(OPS-188): fix after the concourse redesign
    '/src/pages/__tests__/ConcoursePage.test.tsx',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/setupTests.ts', '!src/index.tsx'],
};
