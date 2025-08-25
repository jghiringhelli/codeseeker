// Global test setup
import { beforeAll, afterAll } from '@jest/globals';

// Set test timeout
jest.setTimeout(30000);

beforeAll(async () => {
  // Global test setup
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Global test cleanup
});