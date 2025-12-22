/**
 * Mock logger for tests
 * Allows tests to verify logger calls without actual output
 * Returns a singleton instance so all calls to createLogger() return the same mock
 */

// Create a singleton mock logger instance
const mockLoggerInstance = {
  debug: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setLevel: jest.fn(),
  setContext: jest.fn(),
  setSilent: jest.fn(),
  child: jest.fn(function(this: any) {
    return this;
  }),
  format: {
    success: (text: string) => text,
    error: (text: string) => text,
    warn: (text: string) => text,
    info: (text: string) => text,
    debug: (text: string) => text,
    command: (text: string) => text,
    path: (text: string) => text,
    code: (text: string) => text,
  }
};

// Always return the same instance
export const createLogger = jest.fn(() => mockLoggerInstance);

export const logger = mockLoggerInstance;
