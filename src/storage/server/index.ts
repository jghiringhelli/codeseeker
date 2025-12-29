/**
 * Server Storage Provider
 *
 * Uses external servers for production deployments:
 * - PostgreSQL + pgvector for vector search
 * - Neo4j for graph database
 * - Redis for caching
 *
 * This module is only loaded when storage mode is 'server'.
 * For most users, the embedded storage (SQLite + Graphology + LRU-cache) is sufficient.
 *
 * Setup requires Docker or manual server installation.
 * See docs/STORAGE.md for configuration details.
 */

import {
  IStorageProvider,
  IVectorStore,
  IGraphStore,
  ICacheStore,
  IProjectStore,
  ITextStore,
  StorageMode,
  StorageConfig
} from '../interfaces';
import { ElasticsearchTextStore } from './elasticsearch-text-store';

import { PostgresVectorStore, PostgresVectorStoreConfig } from './postgres-vector-store';
import { Neo4jGraphStore, Neo4jGraphStoreConfig } from './neo4j-graph-store';
import { RedisCacheStore, RedisCacheStoreConfig } from './redis-cache-store';
import { PostgresProjectStore, PostgresProjectStoreConfig } from './postgres-project-store';

// Re-export individual stores
export { PostgresVectorStore, PostgresVectorStoreConfig } from './postgres-vector-store';
export { Neo4jGraphStore, Neo4jGraphStoreConfig } from './neo4j-graph-store';
export { RedisCacheStore, RedisCacheStoreConfig } from './redis-cache-store';
export { PostgresProjectStore, PostgresProjectStoreConfig } from './postgres-project-store';

/**
 * Server storage provider using PostgreSQL, Neo4j, and Redis
 */
export class ServerStorageProvider implements IStorageProvider {
  private vectorStore: PostgresVectorStore;
  private graphStore: Neo4jGraphStore;
  private cacheStore: RedisCacheStore;
  private projectStore: PostgresProjectStore;

  constructor(config: StorageConfig) {
    if (!config.server?.postgres) {
      throw new Error('PostgreSQL configuration required for server mode');
    }
    if (!config.server?.neo4j) {
      throw new Error('Neo4j configuration required for server mode');
    }
    if (!config.server?.redis) {
      throw new Error('Redis configuration required for server mode');
    }

    // Initialize all stores with their configurations
    this.vectorStore = new PostgresVectorStore(config.server.postgres);
    this.graphStore = new Neo4jGraphStore(config.server.neo4j);
    this.cacheStore = new RedisCacheStore(config.server.redis);
    this.projectStore = new PostgresProjectStore(config.server.postgres);
  }

  getVectorStore(): IVectorStore {
    return this.vectorStore;
  }

  getGraphStore(): IGraphStore {
    return this.graphStore;
  }

  getCacheStore(): ICacheStore {
    return this.cacheStore;
  }

  getProjectStore(): IProjectStore {
    return this.projectStore;
  }

  getTextStore(): ITextStore {
    // For server mode, Elasticsearch would be used (future feature)
    // For now, throw an error - users should use embedded mode for text search
    throw new Error('ElasticsearchTextStore is not yet implemented. Use embedded mode for text search.');
  }

  getMode(): StorageMode {
    return 'server';
  }

  async flushAll(): Promise<void> {
    // Server stores write immediately, no flush needed
    await Promise.all([
      this.vectorStore.flush(),
      this.graphStore.flush(),
      this.cacheStore.flush(),
      this.projectStore.flush()
    ]);
  }

  async closeAll(): Promise<void> {
    await Promise.all([
      this.vectorStore.close(),
      this.graphStore.close(),
      this.cacheStore.close(),
      this.projectStore.close()
    ]);
  }

  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, boolean> }> {
    const [postgres, neo4j, redis] = await Promise.all([
      this.vectorStore.healthCheck(),
      this.graphStore.healthCheck(),
      this.cacheStore.healthCheck()
    ]);

    return {
      healthy: postgres && neo4j && redis,
      details: {
        postgres,
        neo4j,
        redis
      }
    };
  }
}