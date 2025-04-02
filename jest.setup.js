// jest.setup.js

// Increase timeout for all tests
jest.setTimeout(30000);

// Use fake timers
jest.useFakeTimers();

// Handle process.exit mocks
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn(code => {
    throw new Error(`Process exit with code ${code}`);
  });
});

afterAll(() => {
  process.exit = originalExit;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// Mock chalk to avoid ANSI color codes in test output
jest.mock('chalk', () => ({
  red: jest.fn(str => str),
  green: jest.fn(str => str),
  blue: jest.fn(str => str),
  yellow: jest.fn(str => str),
  gray: jest.fn(str => str)
}));