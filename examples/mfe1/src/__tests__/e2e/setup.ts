/**
 * E2E Test Setup
 * Configures test environment for E2E Load Capability tests
 */

// Mock browser globals for jsdom environment
global.fetch = jest.fn();

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for E2E tests
jest.setTimeout(30000);
