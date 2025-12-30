/**
 * Unified Database Initialization Service
 *
 * Uses embedded storage by default (no Docker required).
 * Falls back gracefully and allows individual component server overrides.
 *
 * Storage Mode Priority:
 * 1. Environment variable: CODEMIND_STORAGE_MODE
 * 2. Config file: ~/.codemind/storage.json
 * 3. Default: 'embedded' (SQLite + Graphology + LRU-cache)
 */

import { IDatabaseInitializer, SetupResult } from './interfaces/setup-interfaces';
import { getStorageManager, StorageManager, isUsingEmbeddedStorage } from '../../../storage';

export class UnifiedDatabaseInitializer implements IDatabaseInitializer {
  private storageManager?: StorageManager;

  /**
   * Test if databases are available
   * For embedded mode, always returns true
   * For server mode, tests actual connections
   */
  async testConnections(): Promise<{ postgres: boolean; neo4j: boolean; redis: boolean }> {
    // Get storage manager (initializes embedded by default)
    this.storageManager = await getStorageManager();

    if (isUsingEmbeddedStorage()) {
      // Embedded mode - always available
      return {
        postgres: true,  // SQLite vector store
        neo4j: true,     // Graphology graph store
        redis: true      // LRU cache store
      };
    }

    // Server mode - test actual connections
    return this.testServerConnections();
  }

  /**
   * Test server connections (only used when explicitly in server mode)
   */
  private async testServerConnections(): Promise<{ postgres: boolean; neo4j: boolean; redis: boolean }> {
    const results = { postgres: false, neo4j: false, redis: false };

    // Test PostgreSQL
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'codemind',
        user: process.env.DB_USER || 'codemind',
        password: process.env.DB_PASSWORD || 'codemind123',
        connectionTimeoutMillis: 3000
      });
      await pool.query('SELECT 1');
      await pool.end();
      results.postgres = true;
    } catch {
      // Not available
    }

    // Test Neo4j
    try {
      const neo4j = await import('neo4j-driver');
      const driver = neo4j.default.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.default.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'codemind123'
        ),
        { connectionTimeout: 3000 }
      );
      const session = driver.session();
      await session.run('RETURN 1');
      await session.close();
      await driver.close();
      results.neo4j = true;
    } catch {
      // Not available
    }

    // Test Redis
    try {
      const Redis = (await import('ioredis')).default;
      const client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null
      });
      client.on('error', () => {});
      await client.connect();
      await client.ping();
      await client.disconnect();
      results.redis = true;
    } catch {
      // Not available
    }

    return results;
  }

  /**
   * Initialize PostgreSQL (or embedded vector store)
   */
  async initializePostgreSQL(): Promise<SetupResult> {
    try {
      if (!this.storageManager) {
        this.storageManager = await getStorageManager();
      }

      if (isUsingEmbeddedStorage()) {
        const vectorStore = this.storageManager.getVectorStore();
        const projectStore = this.storageManager.getProjectStore();

        return {
          success: true,
          message: 'Embedded vector store ready (SQLite)',
          data: {
            mode: 'embedded',
            type: 'SQLite + FTS5'
          }
        };
      }

      // Server mode - use legacy initializer
      const { DatabaseInitializer } = await import('./database-initializer');
      const legacyInitializer = new DatabaseInitializer();
      return legacyInitializer.initializePostgreSQL();

    } catch (error) {
      return {
        success: false,
        message: 'Vector store initialization failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Initialize Neo4j (or embedded graph store)
   */
  async initializeNeo4j(): Promise<SetupResult> {
    try {
      if (!this.storageManager) {
        this.storageManager = await getStorageManager();
      }

      if (isUsingEmbeddedStorage()) {
        const graphStore = this.storageManager.getGraphStore();

        return {
          success: true,
          message: 'Embedded graph store ready (Graphology)',
          data: {
            mode: 'embedded',
            type: 'Graphology (in-memory with JSON persistence)'
          }
        };
      }

      // Server mode - use legacy initializer
      const { DatabaseInitializer } = await import('./database-initializer');
      const legacyInitializer = new DatabaseInitializer();
      return legacyInitializer.initializeNeo4j();

    } catch (error) {
      return {
        success: false,
        message: 'Graph store initialization failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Initialize Redis (or embedded cache store)
   */
  async initializeRedis(): Promise<SetupResult> {
    try {
      if (!this.storageManager) {
        this.storageManager = await getStorageManager();
      }

      if (isUsingEmbeddedStorage()) {
        const cacheStore = this.storageManager.getCacheStore();

        return {
          success: true,
          message: 'Embedded cache store ready (LRU-cache)',
          data: {
            mode: 'embedded',
            type: 'LRU-cache (in-memory with JSON persistence)'
          }
        };
      }

      // Server mode - use legacy initializer
      const { DatabaseInitializer } = await import('./database-initializer');
      const legacyInitializer = new DatabaseInitializer();
      return legacyInitializer.initializeRedis();

    } catch (error) {
      return {
        success: false,
        message: 'Cache store initialization failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Initialize all storage components
   */
  async initializeAll(): Promise<{
    postgres: SetupResult;
    neo4j: SetupResult;
    redis: SetupResult;
    mode: 'embedded' | 'server';
  }> {
    const [postgres, neo4j, redis] = await Promise.all([
      this.initializePostgreSQL(),
      this.initializeNeo4j(),
      this.initializeRedis()
    ]);

    return {
      postgres,
      neo4j,
      redis,
      mode: isUsingEmbeddedStorage() ? 'embedded' : 'server'
    };
  }

  /**
   * Get the storage manager for direct access
   */
  async getStorageManager(): Promise<StorageManager> {
    if (!this.storageManager) {
      this.storageManager = await getStorageManager();
    }
    return this.storageManager;
  }

  /**
   * Check if using embedded storage
   */
  isEmbedded(): boolean {
    return isUsingEmbeddedStorage();
  }
}

// Export a factory function for easy instantiation
export function createDatabaseInitializer(): UnifiedDatabaseInitializer {
  return new UnifiedDatabaseInitializer();
}