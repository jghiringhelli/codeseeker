/**
 * Storage Manager
 *
 * Unified storage interface that:
 * - Uses embedded storage by default (no Docker required)
 * - Falls back to embedded if server connections fail
 * - Allows individual component override via config/environment
 *
 * This is the main entry point for all storage operations in CodeSeeker.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  IStorageProvider,
  IVectorStore,
  IGraphStore,
  ICacheStore,
  IProjectStore,
  ITextStore,
  StorageMode,
  StorageConfig
} from './interfaces';
import { EmbeddedStorageProvider } from './embedded';
import { PostgresVectorStore } from './server/postgres-vector-store';
import { Neo4jGraphStore } from './server/neo4j-graph-store';
import { RedisCacheStore } from './server/redis-cache-store';
import { PostgresProjectStore } from './server/postgres-project-store';

export interface StorageManagerConfig {
  /** Storage mode: 'embedded' (default), 'server', or 'auto' (try server, fallback to embedded) */
  mode?: 'embedded' | 'server' | 'auto';

  /** Data directory for embedded storage */
  dataDir?: string;

  /** Flush interval in seconds */
  flushIntervalSeconds?: number;

  /** Individual component overrides */
  overrides?: {
    /** Use server PostgreSQL for vectors even in embedded mode */
    vectorStore?: 'embedded' | 'server';
    /** Use server Neo4j for graph even in embedded mode */
    graphStore?: 'embedded' | 'server';
    /** Use server Redis for cache even in embedded mode */
    cacheStore?: 'embedded' | 'server';
  };

  /** Server configuration (for 'server' or 'auto' mode) */
  server?: {
    postgres?: {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    };
    neo4j?: {
      uri: string;
      user: string;
      password: string;
    };
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  };
}

// Singleton instance
let storageManagerInstance: StorageManager | null = null;

export class StorageManager implements IStorageProvider {
  private embeddedProvider: EmbeddedStorageProvider;
  private config: StorageManagerConfig;
  private initialized = false;
  private mode: StorageMode = 'embedded';

  // Component-level mode tracking
  private vectorStoreMode: 'embedded' | 'server' = 'embedded';
  private graphStoreMode: 'embedded' | 'server' = 'embedded';
  private cacheStoreMode: 'embedded' | 'server' = 'embedded';

  // Server clients (if using server mode for specific components)
  private serverVectorStore?: IVectorStore;
  private serverGraphStore?: IGraphStore;
  private serverCacheStore?: ICacheStore;
  private serverProjectStore?: IProjectStore;

  constructor(config?: StorageManagerConfig) {
    this.config = config || this.loadConfig();

    // Initialize embedded provider (always available as fallback)
    const embeddedConfig: StorageConfig = {
      mode: 'embedded',
      dataDir: this.config.dataDir || this.getDefaultDataDir(),
      flushIntervalSeconds: this.config.flushIntervalSeconds ?? 30
    };

    this.embeddedProvider = new EmbeddedStorageProvider(embeddedConfig);
  }

  /**
   * Initialize storage, testing server connections if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const requestedMode = this.config.mode || 'embedded';

    if (requestedMode === 'embedded') {
      // Pure embedded mode - no server connections
      this.mode = 'embedded';
      this.vectorStoreMode = 'embedded';
      this.graphStoreMode = 'embedded';
      this.cacheStoreMode = 'embedded';
      // Silent initialization - CLI handles user-facing messages

    } else if (requestedMode === 'server') {
      // Server mode - require all connections
      await this.initializeServerConnections();
      this.mode = 'server';

    } else if (requestedMode === 'auto') {
      // Auto mode - try server, fall back to embedded
      const serverAvailable = await this.testServerConnections();

      if (serverAvailable.all) {
        await this.initializeServerConnections();
        this.mode = 'server';
        console.log('🔌 Using server storage (PostgreSQL + Neo4j + Redis)');
      } else {
        this.mode = 'embedded';
        console.log('📦 Server not available, using embedded storage');
        if (!serverAvailable.postgres) console.log('   - PostgreSQL: not available');
        if (!serverAvailable.neo4j) console.log('   - Neo4j: not available');
        if (!serverAvailable.redis) console.log('   - Redis: not available');
      }
    }

    // Apply individual overrides
    if (this.config.overrides) {
      await this.applyOverrides();
    }

    this.initialized = true;
  }

  /**
   * Test if server connections are available
   */
  private async testServerConnections(): Promise<{
    all: boolean;
    postgres: boolean;
    neo4j: boolean;
    redis: boolean;
  }> {
    const results = { all: false, postgres: false, neo4j: false, redis: false };

    // Test PostgreSQL
    if (this.config.server?.postgres) {
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({
          ...this.config.server.postgres,
          connectionTimeoutMillis: 3000
        });
        await pool.query('SELECT 1');
        await pool.end();
        results.postgres = true;
      } catch {
        // PostgreSQL not available
      }
    }

    // Test Neo4j
    if (this.config.server?.neo4j) {
      try {
        const neo4j = await import('neo4j-driver');
        const driver = neo4j.default.driver(
          this.config.server.neo4j.uri,
          neo4j.default.auth.basic(
            this.config.server.neo4j.user,
            this.config.server.neo4j.password
          ),
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
    }

    // Test Redis
    if (this.config.server?.redis) {
      try {
        const { createClient } = await import('redis');
        const client = createClient({
          socket: {
            host: this.config.server.redis.host,
            port: this.config.server.redis.port,
            connectTimeout: 3000
          },
          password: this.config.server.redis.password
        });
        await client.connect();
        await client.ping();
        await client.quit();
        results.redis = true;
      } catch {
        // Redis not available
      }
    }

    results.all = results.postgres && results.neo4j && results.redis;
    return results;
  }

  /**
   * Initialize server connections
   */
  private async initializeServerConnections(): Promise<void> {
    if (!this.config.server?.postgres || !this.config.server?.neo4j || !this.config.server?.redis) {
      console.warn('⚠️  Server mode requires postgres, neo4j, and redis config. Falling back to embedded.');
      this.mode = 'embedded';
      return;
    }

    try {
      // Initialize PostgreSQL vector store
      this.serverVectorStore = new PostgresVectorStore(this.config.server.postgres);
      await (this.serverVectorStore as PostgresVectorStore).initialize();
      this.vectorStoreMode = 'server';

      // Initialize Neo4j graph store
      this.serverGraphStore = new Neo4jGraphStore(this.config.server.neo4j);
      await (this.serverGraphStore as Neo4jGraphStore).initialize();
      this.graphStoreMode = 'server';

      // Initialize Redis cache store
      this.serverCacheStore = new RedisCacheStore(this.config.server.redis);
      this.cacheStoreMode = 'server';

      // Initialize PostgreSQL project store (uses same DB as vectors)
      this.serverProjectStore = new PostgresProjectStore(this.config.server.postgres);
      await (this.serverProjectStore as PostgresProjectStore).initialize();

      this.mode = 'server';
      console.log('🔌 Server storage initialized (PostgreSQL + Neo4j + Redis)');
    } catch (error) {
      console.warn(`⚠️  Server storage initialization failed: ${error instanceof Error ? error.message : error}`);
      console.warn('   Falling back to embedded storage');
      this.mode = 'embedded';
      this.vectorStoreMode = 'embedded';
      this.graphStoreMode = 'embedded';
      this.cacheStoreMode = 'embedded';
    }
  }

  /**
   * Apply individual component overrides
   */
  private async applyOverrides(): Promise<void> {
    const overrides = this.config.overrides;
    if (!overrides) return;

    // Override vector store to server if requested and config available
    if (overrides.vectorStore === 'server' && this.config.server?.postgres && !this.serverVectorStore) {
      try {
        this.serverVectorStore = new PostgresVectorStore(this.config.server.postgres);
        await (this.serverVectorStore as PostgresVectorStore).initialize();
        this.vectorStoreMode = 'server';
        console.log('   - Vector store: using PostgreSQL');
      } catch (error) {
        console.warn(`   - Vector store: PostgreSQL failed, using embedded`);
      }
    }

    // Override graph store to server if requested and config available
    if (overrides.graphStore === 'server' && this.config.server?.neo4j && !this.serverGraphStore) {
      try {
        this.serverGraphStore = new Neo4jGraphStore(this.config.server.neo4j);
        await (this.serverGraphStore as Neo4jGraphStore).initialize();
        this.graphStoreMode = 'server';
        console.log('   - Graph store: using Neo4j');
      } catch (error) {
        console.warn(`   - Graph store: Neo4j failed, using embedded`);
      }
    }

    // Override cache store to server if requested and config available
    if (overrides.cacheStore === 'server' && this.config.server?.redis && !this.serverCacheStore) {
      try {
        this.serverCacheStore = new RedisCacheStore(this.config.server.redis);
        this.cacheStoreMode = 'server';
        console.log('   - Cache store: using Redis');
      } catch (error) {
        console.warn(`   - Cache store: Redis failed, using embedded`);
      }
    }
  }

  /**
   * Load configuration from environment and config file
   */
  private loadConfig(): StorageManagerConfig {
    const config: StorageManagerConfig = {
      mode: (process.env.CODESEEKER_STORAGE_MODE || process.env.CODESEEKER_STORAGE_MODE as any) || 'embedded',
      dataDir: process.env.CODESEEKER_DATA_DIR || process.env.CODESEEKER_DATA_DIR,
      flushIntervalSeconds: 30
    };

    // Load server config from environment
    if (process.env.DB_HOST || process.env.CODESEEKER_PG_HOST || process.env.CODESEEKER_PG_HOST) {
      config.server = config.server || {};
      config.server.postgres = {
        host: process.env.CODESEEKER_PG_HOST || process.env.CODESEEKER_PG_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.CODESEEKER_PG_PORT || process.env.CODESEEKER_PG_PORT || process.env.DB_PORT || '5432'),
        database: process.env.CODESEEKER_PG_DATABASE || process.env.CODESEEKER_PG_DATABASE || process.env.DB_NAME || 'codeseeker',
        user: process.env.CODESEEKER_PG_USER || process.env.CODESEEKER_PG_USER || process.env.DB_USER || 'codeseeker',
        password: process.env.CODESEEKER_PG_PASSWORD || process.env.CODESEEKER_PG_PASSWORD || process.env.DB_PASSWORD || 'codeseeker123'
      };
    }

    if (process.env.NEO4J_URI || process.env.CODESEEKER_NEO4J_URI || process.env.CODESEEKER_NEO4J_URI) {
      config.server = config.server || {};
      config.server.neo4j = {
        uri: process.env.CODESEEKER_NEO4J_URI || process.env.CODESEEKER_NEO4J_URI || process.env.NEO4J_URI || 'bolt://localhost:7687',
        user: process.env.CODESEEKER_NEO4J_USER || process.env.CODESEEKER_NEO4J_USER || process.env.NEO4J_USER || 'neo4j',
        password: process.env.CODESEEKER_NEO4J_PASSWORD || process.env.CODESEEKER_NEO4J_PASSWORD || process.env.NEO4J_PASSWORD || 'codeseeker123'
      };
    }

    if (process.env.REDIS_HOST || process.env.CODESEEKER_REDIS_HOST || process.env.CODESEEKER_REDIS_HOST) {
      config.server = config.server || {};
      config.server.redis = {
        host: process.env.CODESEEKER_REDIS_HOST || process.env.CODESEEKER_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.CODESEEKER_REDIS_PORT || process.env.CODESEEKER_REDIS_PORT || process.env.REDIS_PORT || '6379'),
        password: process.env.CODESEEKER_REDIS_PASSWORD || process.env.CODESEEKER_REDIS_PASSWORD || process.env.REDIS_PASSWORD
      };
    }

    // Try to load from config file
    const configPath = this.getConfigPath();
    if (fs.existsSync(configPath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        Object.assign(config, fileConfig);
      } catch (error) {
        console.warn(`Warning: Failed to load storage config from ${configPath}`);
      }
    }

    return config;
  }

  private getConfigPath(): string {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'codeseeker', 'storage.json');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'codeseeker', 'storage.json');
    } else {
      return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'codeseeker', 'storage.json');
    }
  }

  private getDefaultDataDir(): string {
    const platform = os.platform();
    if (platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'codeseeker', 'data');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'codeseeker', 'data');
    } else {
      return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'codeseeker', 'data');
    }
  }

  // IStorageProvider implementation

  getVectorStore(): IVectorStore {
    if (this.vectorStoreMode === 'server' && this.serverVectorStore) {
      return this.serverVectorStore;
    }
    return this.embeddedProvider.getVectorStore();
  }

  getGraphStore(): IGraphStore {
    if (this.graphStoreMode === 'server' && this.serverGraphStore) {
      return this.serverGraphStore;
    }
    return this.embeddedProvider.getGraphStore();
  }

  getCacheStore(): ICacheStore {
    if (this.cacheStoreMode === 'server' && this.serverCacheStore) {
      return this.serverCacheStore;
    }
    return this.embeddedProvider.getCacheStore();
  }

  getProjectStore(): IProjectStore {
    if (this.mode === 'server' && this.serverProjectStore) {
      return this.serverProjectStore;
    }
    return this.embeddedProvider.getProjectStore();
  }

  getTextStore(): ITextStore {
    // Text store always uses embedded provider (MiniSearch)
    // Server mode would use Elasticsearch when implemented
    return this.embeddedProvider.getTextStore();
  }

  getMode(): StorageMode {
    return this.mode;
  }

  async flushAll(): Promise<void> {
    await this.embeddedProvider.flushAll();
    // Server stores don't need flushing (writes are immediate)
  }

  async closeAll(): Promise<void> {
    await this.embeddedProvider.closeAll();

    // Close server connections if they exist
    if (this.serverVectorStore) await this.serverVectorStore.close();
    if (this.serverGraphStore) await this.serverGraphStore.close();
    if (this.serverCacheStore) await this.serverCacheStore.close();
    if (this.serverProjectStore) await this.serverProjectStore.close();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, boolean> }> {
    const embeddedHealth = await this.embeddedProvider.healthCheck();

    return {
      healthy: embeddedHealth.healthy,
      details: {
        vectorStore: true,
        graphStore: true,
        cacheStore: true,
        projectStore: true,
        mode: this.mode === 'embedded' ? true : true
      }
    };
  }

  /**
   * Get storage status for display
   */
  getStatus(): {
    mode: StorageMode;
    dataDir: string;
    components: {
      vectorStore: 'embedded' | 'server';
      graphStore: 'embedded' | 'server';
      cacheStore: 'embedded' | 'server';
    };
  } {
    return {
      mode: this.mode,
      dataDir: this.config.dataDir || this.getDefaultDataDir(),
      components: {
        vectorStore: this.vectorStoreMode,
        graphStore: this.graphStoreMode,
        cacheStore: this.cacheStoreMode
      }
    };
  }
}

/**
 * Get the global storage manager instance
 */
export async function getStorageManager(config?: StorageManagerConfig): Promise<StorageManager> {
  if (!storageManagerInstance) {
    storageManagerInstance = new StorageManager(config);
    await storageManagerInstance.initialize();
  }
  return storageManagerInstance;
}

/**
 * Reset the storage manager (for testing)
 */
export async function resetStorageManager(): Promise<void> {
  if (storageManagerInstance) {
    await storageManagerInstance.closeAll();
    storageManagerInstance = null;
  }
}

/**
 * Check if storage is using embedded mode
 */
export function isUsingEmbeddedStorage(): boolean {
  return storageManagerInstance?.getMode() === 'embedded';
}