/**
 * E2E Test Configuration
 *
 * Supports both embedded and server storage modes.
 * Storage mode is determined by:
 * 1. CODEMIND_TEST_STORAGE_MODE environment variable
 * 2. Defaults to 'embedded' for fast CI testing
 */

import * as path from 'path';

export type StorageMode = 'embedded' | 'server';

export interface TestStorageConfig {
  mode: StorageMode;
  embedded?: {
    dataDir: string;
  };
  server?: {
    postgres: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    };
    neo4j: {
      uri: string;
      user: string;
      password: string;
    };
    redis: {
      host: string;
      port: number;
      password?: string;
    };
  };
}

export interface TestConfig {
  originalProjectPath: string;
  testProjectPath: string;
  useMockClaude: boolean;
  skipCleanup: boolean;
  claudeTimeout: number;
  storage: TestStorageConfig;
}

// Resolve paths relative to project root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'tests', 'fixtures');
const TEMP_DIR = path.join(PROJECT_ROOT, 'tests', 'fixtures', '.temp');

/**
 * Get storage mode from environment or default to embedded
 */
export function getStorageMode(): StorageMode {
  const envMode = process.env.CODEMIND_TEST_STORAGE_MODE?.toLowerCase();
  if (envMode === 'server' || envMode === 'docker') {
    return 'server';
  }
  return 'embedded';
}

/**
 * Create storage configuration based on mode
 */
export function createStorageConfig(mode: StorageMode): TestStorageConfig {
  if (mode === 'server') {
    return {
      mode: 'server',
      server: {
        postgres: {
          host: process.env.CODEMIND_PG_HOST || process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.CODEMIND_PG_PORT || process.env.DB_PORT || '5432'),
          database: process.env.CODEMIND_PG_DATABASE || process.env.DB_NAME || 'codemind',
          user: process.env.CODEMIND_PG_USER || process.env.DB_USER || 'codemind',
          password: process.env.CODEMIND_PG_PASSWORD || process.env.DB_PASSWORD || 'codemind123'
        },
        neo4j: {
          uri: process.env.CODEMIND_NEO4J_URI || process.env.NEO4J_URI || 'bolt://localhost:7687',
          user: process.env.CODEMIND_NEO4J_USER || process.env.NEO4J_USER || 'neo4j',
          password: process.env.CODEMIND_NEO4J_PASSWORD || process.env.NEO4J_PASSWORD || 'codemind123'
        },
        redis: {
          host: process.env.CODEMIND_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.CODEMIND_REDIS_PORT || process.env.REDIS_PORT || '6379'),
          password: process.env.CODEMIND_REDIS_PASSWORD || process.env.REDIS_PASSWORD || undefined
        }
      }
    };
  }

  // Embedded mode - use temp directory for test data
  return {
    mode: 'embedded',
    embedded: {
      dataDir: path.join(TEMP_DIR, '.codemind-test-data')
    }
  };
}

/**
 * Default test configuration
 */
export function createTestConfig(overrides?: Partial<TestConfig>): TestConfig {
  const storageMode = getStorageMode();

  const defaultConfig: TestConfig = {
    originalProjectPath: path.join(FIXTURES_DIR, 'ContractMaster-Test-Original'),
    testProjectPath: path.join(TEMP_DIR, 'ContractMaster-Test-E2E'),
    useMockClaude: !process.argv.includes('--live'),
    skipCleanup: process.argv.includes('--skip-cleanup'),
    claudeTimeout: 120000,
    storage: createStorageConfig(storageMode)
  };

  return { ...defaultConfig, ...overrides };
}

/**
 * Get environment variables to pass to child processes
 */
export function getTestEnvVars(config: TestConfig): Record<string, string> {
  const env: Record<string, string> = {
    CODEMIND_STORAGE_MODE: config.storage.mode
  };

  if (config.storage.mode === 'embedded' && config.storage.embedded) {
    env.CODEMIND_DATA_DIR = config.storage.embedded.dataDir;
  }

  if (config.storage.mode === 'server' && config.storage.server) {
    env.CODEMIND_PG_HOST = config.storage.server.postgres.host;
    env.CODEMIND_PG_PORT = String(config.storage.server.postgres.port);
    env.CODEMIND_PG_DATABASE = config.storage.server.postgres.database;
    env.CODEMIND_PG_USER = config.storage.server.postgres.user;
    env.CODEMIND_PG_PASSWORD = config.storage.server.postgres.password;
    env.CODEMIND_NEO4J_URI = config.storage.server.neo4j.uri;
    env.CODEMIND_NEO4J_USER = config.storage.server.neo4j.user;
    env.CODEMIND_NEO4J_PASSWORD = config.storage.server.neo4j.password;
    env.CODEMIND_REDIS_HOST = config.storage.server.redis.host;
    env.CODEMIND_REDIS_PORT = String(config.storage.server.redis.port);
    if (config.storage.server.redis.password) {
      env.CODEMIND_REDIS_PASSWORD = config.storage.server.redis.password;
    }
  }

  return env;
}

/**
 * Check if server databases are available
 */
export async function checkServerAvailability(config: TestStorageConfig): Promise<{
  postgres: boolean;
  neo4j: boolean;
  redis: boolean;
}> {
  if (config.mode !== 'server' || !config.server) {
    return { postgres: false, neo4j: false, redis: false };
  }

  const results = { postgres: false, neo4j: false, redis: false };

  // Check PostgreSQL
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      ...config.server.postgres,
      connectionTimeoutMillis: 3000
    });
    await pool.query('SELECT 1');
    await pool.end();
    results.postgres = true;
  } catch {
    // PostgreSQL not available
  }

  // Check Neo4j
  try {
    const neo4j = await import('neo4j-driver');
    const driver = neo4j.default.driver(
      config.server.neo4j.uri,
      neo4j.default.auth.basic(config.server.neo4j.user, config.server.neo4j.password),
      { connectionTimeout: 3000 }
    );
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    await driver.close();
    results.neo4j = true;
  } catch {
    // Neo4j not available
  }

  // Check Redis
  try {
    const { createClient } = await import('redis');
    const client = createClient({
      socket: {
        host: config.server.redis.host,
        port: config.server.redis.port,
        connectTimeout: 3000
      },
      password: config.server.redis.password
    });
    await client.connect();
    await client.ping();
    await client.quit();
    results.redis = true;
  } catch {
    // Redis not available
  }

  return results;
}

// Default config for backward compatibility
export const DEFAULT_CONFIG = createTestConfig();