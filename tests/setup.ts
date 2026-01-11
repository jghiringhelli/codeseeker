/**
 * Jest Test Setup
 * Global test configuration and setup for codeseeker test suite
 */

// Set NODE_ENV to test to prevent resource leaks
process.env.NODE_ENV = 'test';

// Set up test timeout for long-running operations
jest.setTimeout(30000);

// Mock console methods for cleaner test output
const originalConsole = console;

beforeAll(() => {
  // Mock console methods to prevent noisy test output
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
});

afterAll(() => {
  // Restore console
  global.console = originalConsole;
});

// Global test utilities
global.testUtils = {
  createMockProject: () => ({
    id: 'test-project-id',
    name: 'Test Project',
    path: '/test/project/path',
  }),
  
  createMockContext: () => ({
    sessionId: 'test-session-id',
    projectPath: '/test/project/path',
    projectId: 'test-project-id',
    settings: {
      tokenBudget: 4000,
      semanticDepth: 3,
      maxTools: 7,
      executionStrategy: 'hybrid' as const,
      colorOutput: false,
      verboseMode: false,
    },
  }),

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Declare global types for TypeScript
declare global {
  var testUtils: {
    createMockProject: () => any;
    createMockContext: () => any;
    sleep: (ms: number) => Promise<void>;
  };
}

export {};