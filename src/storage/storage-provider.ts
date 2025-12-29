/**
 * Storage Provider Factory
 *
 * Creates the appropriate storage provider based on configuration:
 * - Embedded (default): SQLite + Graphology + LRU-cache (no Docker)
 * - Server: PostgreSQL + Neo4j + Redis (for production)
 *
 * Usage:
 * ```typescript
 * import { getStorageProvider } from './storage';
 *
 * // Get the global storage provider (auto-configured)
 * const storage = await getStorageProvider();
 *
 * // Or with explicit configuration
 * const storage = await getStorageProvider({
 *   mode: 'embedded',
 *   dataDir: '/custom/path'
 * });
 *
 * // Use the stores
 * const vectors = storage.getVectorStore();
 * const graph = storage.getGraphStore();
 * const cache = storage.getCacheStore();
 * const projects = storage.getProjectStore();
 * ```
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { IStorageProvider, StorageConfig, StorageMode } from './interfaces';
import { EmbeddedStorageProvider } from './embedded';

// Global singleton
let storageProviderInstance: IStorageProvider | null = null;

/**
 * Load configuration from ~/.codemind/storage.json or environment
 */
export function loadStorageConfig(): StorageConfig {
  // Check environment variable first
  const envMode = process.env.CODEMIND_STORAGE_MODE as StorageMode | undefined;

  // Default config
  let config: StorageConfig = {
    mode: envMode || 'embedded',
    flushIntervalSeconds: 30
  };

  // Try to load from config file
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...config, ...fileConfig };
    } catch (error) {
      console.warn(`Warning: Failed to load storage config from ${configPath}:`, error);
    }
  }

  // Override from environment variables
  if (process.env.CODEMIND_DATA_DIR) {
    config.dataDir = process.env.CODEMIND_DATA_DIR;
  }

  if (process.env.CODEMIND_STORAGE_MODE) {
    config.mode = process.env.CODEMIND_STORAGE_MODE as StorageMode;
  }

  // Server configuration from environment
  if (config.mode === 'server') {
    config.server = {
      postgres: {
        host: process.env.CODEMIND_PG_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.CODEMIND_PG_PORT || process.env.DB_PORT || '5432'),
        database: process.env.CODEMIND_PG_DATABASE || process.env.DB_NAME || 'codemind',
        user: process.env.CODEMIND_PG_USER || process.env.DB_USER || 'codemind',
        password: process.env.CODEMIND_PG_PASSWORD || process.env.DB_PASSWORD || 'codemind123'
      },
      neo4j: {
        uri: process.env.CODEMIND_NEO4J_URI || 'bolt://localhost:7687',
        user: process.env.CODEMIND_NEO4J_USER || 'neo4j',
        password: process.env.CODEMIND_NEO4J_PASSWORD || 'codemind123'
      },
      redis: {
        host: process.env.CODEMIND_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.CODEMIND_REDIS_PORT || process.env.REDIS_PORT || '6379'),
        password: process.env.CODEMIND_REDIS_PASSWORD || process.env.REDIS_PASSWORD
      }
    };
  }

  return config;
}

/**
 * Get the path to storage configuration file
 */
export function getConfigPath(): string {
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'codemind', 'storage.json');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'codemind', 'storage.json');
  } else {
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'codemind', 'storage.json');
  }
}

/**
 * Save storage configuration
 */
export function saveStorageConfig(config: StorageConfig): void {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get the global storage provider
 * Creates one if it doesn't exist
 */
export async function getStorageProvider(config?: StorageConfig): Promise<IStorageProvider> {
  if (storageProviderInstance && !config) {
    return storageProviderInstance;
  }

  const effectiveConfig = config || loadStorageConfig();

  if (effectiveConfig.mode === 'embedded') {
    storageProviderInstance = new EmbeddedStorageProvider(effectiveConfig);
  } else if (effectiveConfig.mode === 'server') {
    // Server mode - import dynamically to avoid loading pg/neo4j if not needed
    // For now, fall back to embedded if server modules aren't available
    try {
      const { ServerStorageProvider } = await import('./server');
      storageProviderInstance = new ServerStorageProvider(effectiveConfig);
    } catch (error) {
      console.warn('Server storage modules not available, falling back to embedded mode');
      storageProviderInstance = new EmbeddedStorageProvider({
        ...effectiveConfig,
        mode: 'embedded'
      });
    }
  } else {
    throw new Error(`Unknown storage mode: ${effectiveConfig.mode}`);
  }

  return storageProviderInstance;
}

/**
 * Reset the global storage provider
 * Useful for testing or switching modes
 */
export async function resetStorageProvider(): Promise<void> {
  if (storageProviderInstance) {
    await storageProviderInstance.closeAll();
    storageProviderInstance = null;
  }
}

/**
 * Check if server storage is available
 */
export async function isServerStorageAvailable(config?: StorageConfig): Promise<{
  available: boolean;
  details: {
    postgres: boolean;
    neo4j: boolean;
    redis: boolean;
  };
}> {
  const effectiveConfig = config || loadStorageConfig();

  if (effectiveConfig.mode !== 'server' || !effectiveConfig.server) {
    return {
      available: false,
      details: { postgres: false, neo4j: false, redis: false }
    };
  }

  const details = {
    postgres: false,
    neo4j: false,
    redis: false
  };

  // Check PostgreSQL
  try {
    const { Pool } = await import('pg');
    const pool = new Pool(effectiveConfig.server.postgres);
    await pool.query('SELECT 1');
    await pool.end();
    details.postgres = true;
  } catch {
    // PostgreSQL not available
  }

  // Check Neo4j
  try {
    const neo4j = await import('neo4j-driver');
    const driver = neo4j.default.driver(
      effectiveConfig.server.neo4j!.uri,
      neo4j.default.auth.basic(
        effectiveConfig.server.neo4j!.user,
        effectiveConfig.server.neo4j!.password
      )
    );
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    await driver.close();
    details.neo4j = true;
  } catch {
    // Neo4j not available
  }

  // Check Redis
  try {
    const { createClient } = await import('redis');
    const client = createClient({
      socket: {
        host: effectiveConfig.server.redis!.host,
        port: effectiveConfig.server.redis!.port
      },
      password: effectiveConfig.server.redis!.password
    });
    await client.connect();
    await client.ping();
    await client.quit();
    details.redis = true;
  } catch {
    // Redis not available
  }

  return {
    available: details.postgres && details.neo4j && details.redis,
    details
  };
}