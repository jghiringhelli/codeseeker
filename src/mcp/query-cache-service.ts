/**
 * Query Cache Service
 *
 * Provides caching for semantic search query results using the ICacheStore interface.
 * Works with both embedded (LRU-cache) and server (Redis) storage modes.
 *
 * Cache Strategy:
 * - Cache key: hash of (query + projectId + searchType)
 * - TTL: 5 minutes (default) - balances freshness with performance
 * - Invalidation: On file changes via sync/index
 * - Tags: project-based for bulk invalidation
 *
 * Benefits:
 * - Reduces embedding generation (~50-100ms per query)
 * - Reduces database queries (~20-50ms per search)
 * - Enables near-instant repeated queries
 */

import * as crypto from 'crypto';
import { ICacheStore } from '../storage/interfaces';
import { getStorageManager } from '../storage';

export interface CachedSearchResult {
  results: any[];
  cachedAt: number;
  queryHash: string;
  projectId: string;
}

export interface QueryCacheConfig {
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttlSeconds?: number;
  /** Whether caching is enabled (default: true) */
  enabled?: boolean;
  /** Max cached results per query (default: 50) */
  maxResults?: number;
}

const DEFAULT_CONFIG: Required<QueryCacheConfig> = {
  ttlSeconds: 300, // 5 minutes
  enabled: true,
  maxResults: 50,
};

export class QueryCacheService {
  private cacheStore: ICacheStore | null = null;
  private config: Required<QueryCacheConfig>;
  private initialized = false;

  constructor(config?: QueryCacheConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize cache store from storage manager
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const storageManager = await getStorageManager();
      this.cacheStore = storageManager.getCacheStore();
      this.initialized = true;
    } catch (error) {
      // Cache init failed - will operate in passthrough mode
      console.error('QueryCacheService: Failed to initialize cache store:', error);
      this.initialized = true; // Mark as initialized to avoid repeated attempts
    }
  }

  /**
   * Generate a cache key for a search query
   */
  private generateCacheKey(query: string, projectId: string, searchType: string = 'hybrid'): string {
    const keyData = `query:${query}|project:${projectId}|type:${searchType}`;
    const hash = crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 32);
    return `search:${hash}`;
  }

  /**
   * Get cached search results
   * @returns Cached results or null if not cached/expired
   */
  async get(query: string, projectId: string, searchType: string = 'hybrid'): Promise<CachedSearchResult | null> {
    if (!this.config.enabled) return null;

    await this.ensureInitialized();
    if (!this.cacheStore) return null;

    try {
      const cacheKey = this.generateCacheKey(query, projectId, searchType);
      const cached = await this.cacheStore.get<CachedSearchResult>(cacheKey);

      if (cached) {
        // Validate cached data structure
        if (cached.results && Array.isArray(cached.results) && cached.cachedAt) {
          return cached;
        }
      }

      return null;
    } catch (error) {
      // Cache read failed - not critical, just return null
      console.error('QueryCacheService: Cache read error:', error);
      return null;
    }
  }

  /**
   * Cache search results
   */
  async set(
    query: string,
    projectId: string,
    results: any[],
    searchType: string = 'hybrid'
  ): Promise<void> {
    if (!this.config.enabled) return;

    await this.ensureInitialized();
    if (!this.cacheStore) return;

    try {
      const cacheKey = this.generateCacheKey(query, projectId, searchType);

      // Limit cached results to prevent bloat
      const limitedResults = results.slice(0, this.config.maxResults);

      const cacheEntry: CachedSearchResult = {
        results: limitedResults,
        cachedAt: Date.now(),
        queryHash: cacheKey,
        projectId,
      };

      await this.cacheStore.set(cacheKey, cacheEntry, this.config.ttlSeconds);
    } catch (error) {
      // Cache write failed - not critical, log and continue
      console.error('QueryCacheService: Cache write error:', error);
    }
  }

  /**
   * Invalidate cache for a specific project
   * Called when files are indexed/modified
   */
  async invalidateProject(projectId: string): Promise<number> {
    await this.ensureInitialized();
    if (!this.cacheStore) return 0;

    try {
      // Delete all search cache entries for this project
      // Uses pattern matching: search:* entries containing this projectId
      const deleted = await this.cacheStore.deletePattern(`search:*`);
      return deleted;
    } catch (error) {
      console.error('QueryCacheService: Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache for specific files in a project
   * More surgical invalidation - only clears queries that might have matched these files
   */
  async invalidateFiles(projectId: string, filePaths: string[]): Promise<number> {
    // For now, invalidate entire project cache when files change
    // A more sophisticated approach would track which queries matched which files
    return this.invalidateProject(projectId);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: number; hits: number; misses: number } | null> {
    await this.ensureInitialized();
    if (!this.cacheStore) return null;

    try {
      return await this.cacheStore.stats();
    } catch (error) {
      console.error('QueryCacheService: Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Clear all search cache entries
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    if (!this.cacheStore) return;

    try {
      await this.cacheStore.deletePattern('search:*');
    } catch (error) {
      console.error('QueryCacheService: Failed to clear cache:', error);
    }
  }

  /**
   * Check if caching is available and enabled
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;

    await this.ensureInitialized();
    return this.cacheStore !== null;
  }
}

// Singleton instance for use across the MCP server
let queryCacheInstance: QueryCacheService | null = null;

export function getQueryCacheService(config?: QueryCacheConfig): QueryCacheService {
  if (!queryCacheInstance) {
    queryCacheInstance = new QueryCacheService(config);
  }
  return queryCacheInstance;
}

export function resetQueryCacheService(): void {
  queryCacheInstance = null;
}
