module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  // Ignore test fixtures to prevent haste module collisions
  modulePathIgnorePatterns: [
    '<rootDir>/tests/fixtures/.temp',
    '<rootDir>/tests/fixtures/ContractMaster-Test-Original'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Configuration to fix IDE Jest worker issues
  maxWorkers: 1,
  workerIdleMemoryLimit: '512MB',
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  // Set NODE_ENV for tests
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  // Fix for Jest 30.x compatibility
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|ora)/)'
  ]
};