/**
 * Storage Module
 *
 * Provides unified storage abstraction for CodeSeeker with two modes:
 *
 * ## Embedded Mode (Default - Zero Setup)
 * Uses SQLite + Graphology + LRU-cache. No Docker or external services needed.
 * Data persists to ~/.codeseeker/data (or platform-specific equivalent).
 *
 * ## Server Mode (Production)
 * Uses PostgreSQL + Neo4j + Redis. Requires Docker or manual server setup.
 * Better for large codebases and team environments.
 *
 * ## Usage
 *
 * ```typescript
 * import { getStorageProvider } from '@codeseeker/storage';
 *
 * // Get storage (uses embedded by default)
 * const storage = await getStorageProvider();
 *
 * // Vector search
 * const vectors = storage.getVectorStore();
 * await vectors.upsert({ id: '1', projectId: 'p1', ... });
 * const results = await vectors.searchHybrid('find auth', embedding, 'p1');
 *
 * // Graph operations
 * const graph = storage.getGraphStore();
 * await graph.upsertNode({ id: 'fn1', type: 'function', ... });
 * const neighbors = await graph.getNeighbors('fn1');
 *
 * // Caching
 * const cache = storage.getCacheStore();
 * await cache.set('key', value, 300); // 5 minute TTL
 * const cached = await cache.get('key');
 *
 * // Projects
 * const projects = storage.getProjectStore();
 * const project = await projects.upsert({ id: 'p1', name: 'My Project', ... });
 * ```
 *
 * ## Configuration
 *
 * Set via environment variables:
 * - CODESEEKER_STORAGE_MODE: 'embedded' | 'server' (default: 'embedded')
 * - CODESEEKER_DATA_DIR: Custom data directory for embedded mode
 *
 * Or create ~/.codeseeker/storage.json:
 * ```json
 * {
 *   "mode": "server",
 *   "server": {
 *     "postgres": { "host": "localhost", "port": 5432, ... },
 *     "neo4j": { "uri": "bolt://localhost:7687", ... },
 *     "redis": { "host": "localhost", "port": 6379 }
 *   }
 * }
 * ```
 */

// Interfaces
export type {
  IVectorStore,
  IGraphStore,
  ICacheStore,
  IProjectStore,
  IStorageProvider,
  VectorDocument,
  VectorSearchResult,
  GraphNode,
  GraphEdge,
  GraphQueryResult,
  CacheEntry,
  Project,
  StorageMode,
  StorageConfig
} from './interfaces';

// Storage Provider (low-level)
export {
  getStorageProvider,
  resetStorageProvider,
  loadStorageConfig,
  saveStorageConfig,
  getConfigPath,
  isServerStorageAvailable
} from './storage-provider';

// Storage Manager (recommended high-level API)
export {
  StorageManager,
  StorageManagerConfig,
  getStorageManager,
  resetStorageManager,
  isUsingEmbeddedStorage
} from './storage-manager';

// Embedded implementations (for direct use)
export {
  EmbeddedStorageProvider,
  SQLiteVectorStore,
  GraphologyGraphStore,
  LRUCacheStore,
  SQLiteProjectStore
} from './embedded';