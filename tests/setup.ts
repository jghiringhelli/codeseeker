import { beforeAll, afterAll, jest } from '@jest/globals';

// Set test timeout
jest.setTimeout(30000);

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DB_TYPE = 'sqlite';
  process.env.DB_FILE = ':memory:';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.LOG_LEVEL = 'error';
  
  // Mock console methods in test environment
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(async () => {
  // Cleanup after all tests
  jest.restoreAllMocks();
});

// Mock common modules that might not be available in test environment
jest.mock('ora', () => {
  return {
    default: jest.fn(() => ({
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
      text: '',
    })),
  };
});