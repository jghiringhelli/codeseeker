/**
 * Multi-Level Cache System
 * Provides L1 (memory), L2 (file), and L3 (database) caching with smart invalidation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';
import { RedisCacheAdapter } from './redis-cache-adapter';

export interface CacheEntry<T> {
  key: string;
  data: T;
  contentHash: string;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxMemoryEntries: number;
  maxFileSize: number; // bytes
  defaultTTL: number; // milliseconds
  fileBasePath: string;
  enableCompression: boolean;
}

export class MultiLevelCache<T> {
  private logger = Logger.getInstance();
  private redisCache: RedisCacheAdapter<T>;
  private config: CacheConfig;

  // L1 Cache: In-Memory (fastest)
  private memoryCache: Map<string, CacheEntry<T>> = new Map();

  // L2 Cache: File System (fast)
  private fileCacheDir: string;

  constructor(cacheName: string, config: Partial<CacheConfig> = {}) {
    this.config = {
      maxMemoryEntries: config.maxMemoryEntries || 1000,
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      defaultTTL: config.defaultTTL || 3600000, // 1 hour
      fileBasePath: config.fileBasePath || '.codemind/cache',
      enableCompression: config.enableCompression || true
    };

    this.fileCacheDir = path.join(this.config.fileBasePath, cacheName);
    this.redisCache = new RedisCacheAdapter<T>(`codemind:cache:${cacheName}`);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.fileCacheDir, { recursive: true });

    // Initialize Redis cache but don't fail if it's not available
    try {
      await this.redisCache.initialize();
    } catch (error: any) {
      this.logger.warn(`⚠️  Redis cache unavailable: ${error.message}`);
      this.logger.warn('  Multi-level cache will operate without Redis (L1 + L2 only)');
    }

    this.logger.info(`🗄️  Multi-level cache initialized: ${this.fileCacheDir}`);
  }

  /**
   * Get data from cache (tries L1 → L2 → L3)
   */
  async get(key: string, contentHash?: string): Promise<T | null> {
    const cacheKey = this.createCacheKey(key);
    
    // L1: Memory cache (fastest)
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && this.isEntryValid(memoryEntry, contentHash)) {
      memoryEntry.accessCount++;
      memoryEntry.lastAccessed = new Date();
      this.logger.debug(`🎯 L1 cache hit: ${key}`);
      return memoryEntry.data;
    }
    
    // L2: File cache (fast)
    const fileEntry = await this.getFromFileCache(cacheKey, contentHash);
    if (fileEntry) {
      // Promote to L1
      this.setMemoryCache(cacheKey, fileEntry);
      this.logger.debug(`📄 L2 cache hit: ${key}`);
      return fileEntry.data;
    }
    
    // L3: Redis cache (comprehensive and persistent)
    const redisEntry = await this.getFromRedisCache(key, contentHash);
    if (redisEntry) {
      // Promote to L2 and L1
      await this.setFileCache(cacheKey, redisEntry);
      this.setMemoryCache(cacheKey, redisEntry);
      this.logger.debug(`🗃️  L3 Redis cache hit: ${key}`);
      return redisEntry.data;
    }
    
    this.logger.debug(`❌ Cache miss: ${key}`);
    return null;
  }

  /**
   * Set data in all cache levels
   */
  async set(key: string, data: T, contentHash: string, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      data,
      contentHash,
      timestamp: new Date(),
      accessCount: 1,
      lastAccessed: new Date(),
      expiresAt: ttl ? new Date(Date.now() + ttl) : new Date(Date.now() + this.config.defaultTTL)
    };
    
    const cacheKey = this.createCacheKey(key);
    
    // Set in all levels
    this.setMemoryCache(cacheKey, entry);
    await this.setFileCache(cacheKey, entry);
    await this.setRedisCache(key, entry);
    
    this.logger.debug(`💾 Cached: ${key} (hash: ${contentHash.substring(0, 8)})`);
  }

  /**
   * Invalidate cache entry when content changes
   */
  async invalidate(key: string): Promise<void> {
    const cacheKey = this.createCacheKey(key);
    
    // Remove from L1
    this.memoryCache.delete(cacheKey);
    
    // Remove from L2
    try {
      await fs.unlink(path.join(this.fileCacheDir, `${cacheKey}.json`));
    } catch (error) {
      // File may not exist
    }
    
    // Remove from L3 (Redis)
    await this.redisCache.delete(key);
    
    this.logger.debug(`🗑️  Invalidated: ${key}`);
  }

  /**
   * Smart bulk invalidation based on file patterns
   */
  async invalidatePattern(pattern: RegExp): Promise<number> {
    let invalidated = 0;
    
    // L1: Check memory cache
    for (const [cacheKey, entry] of this.memoryCache.entries()) {
      if (pattern.test(entry.key)) {
        this.memoryCache.delete(cacheKey);
        invalidated++;
      }
    }
    
    // L2: Check file cache
    try {
      const files = await fs.readdir(this.fileCacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.fileCacheDir, file);
          const entry = await this.readFileEntry(filePath);
          if (entry && pattern.test(entry.key)) {
            await fs.unlink(filePath);
            invalidated++;
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error checking file cache for pattern: ${error}`);
    }
    
    // L3: Redis invalidation
    invalidated += await this.redisCache.invalidatePattern(pattern);
    
    this.logger.info(`🧹 Invalidated ${invalidated} entries matching pattern: ${pattern}`);
    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memoryEntries: number;
    memoryHitRate: number;
    totalSize: number;
  } {
    return {
      memoryEntries: this.memoryCache.size,
      memoryHitRate: this.calculateHitRate(),
      totalSize: this.calculateTotalSize()
    };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    let cleaned = 0;
    const now = new Date();
    
    // L1: Memory cleanup
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    // L2: File cleanup
    try {
      const files = await fs.readdir(this.fileCacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.fileCacheDir, file);
          const entry = await this.readFileEntry(filePath);
          if (entry?.expiresAt && entry.expiresAt < now) {
            await fs.unlink(filePath);
            cleaned++;
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error during file cache cleanup: ${error}`);
    }
    
    this.logger.info(`🧽 Cleaned up ${cleaned} expired cache entries`);
    return cleaned;
  }

  // Private methods for cache level implementations

  private createCacheKey(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  private isEntryValid(entry: CacheEntry<T>, contentHash?: string): boolean {
    const now = new Date();
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < now) {
      return false;
    }
    
    // Check content hash if provided
    if (contentHash && entry.contentHash !== contentHash) {
      return false;
    }
    
    return true;
  }

  private setMemoryCache(cacheKey: string, entry: CacheEntry<T>): void {
    // Implement LRU eviction if needed
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      const oldestKey = this.findLeastRecentlyUsed();
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    
    this.memoryCache.set(cacheKey, entry);
  }

  private findLeastRecentlyUsed(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = new Date();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  private async getFromFileCache(cacheKey: string, contentHash?: string): Promise<CacheEntry<T> | null> {
    try {
      const filePath = path.join(this.fileCacheDir, `${cacheKey}.json`);
      const entry = await this.readFileEntry(filePath);
      
      if (entry && this.isEntryValid(entry, contentHash)) {
        entry.accessCount++;
        entry.lastAccessed = new Date();
        return entry;
      }
    } catch (error) {
      // File doesn't exist or is corrupted
    }
    
    return null;
  }

  private async readFileEntry(filePath: string): Promise<CacheEntry<T> | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(content);
      
      // Convert date strings back to Date objects
      entry.timestamp = new Date(entry.timestamp);
      entry.lastAccessed = new Date(entry.lastAccessed);
      if (entry.expiresAt) {
        entry.expiresAt = new Date(entry.expiresAt);
      }
      
      return entry;
    } catch (error) {
      return null;
    }
  }

  private async setFileCache(cacheKey: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const filePath = path.join(this.fileCacheDir, `${cacheKey}.json`);
      const serialized = JSON.stringify(entry, null, 2);
      
      // Check file size limit
      if (serialized.length > this.config.maxFileSize) {
        this.logger.warn(`Cache entry too large for file storage: ${entry.key}`);
        return;
      }
      
      await fs.writeFile(filePath, serialized, 'utf-8');
    } catch (error) {
      this.logger.warn(`Failed to write file cache: ${error}`);
    }
  }

  private async getFromRedisCache(key: string, contentHash?: string): Promise<CacheEntry<T> | null> {
    try {
      const entry = await this.redisCache.get(key, contentHash);
      return entry;
    } catch (error) {
      this.logger.warn(`Failed to read from Redis cache: ${error}`);
      return null;
    }
  }

  private async setRedisCache(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const ttl = entry.expiresAt ? entry.expiresAt.getTime() - Date.now() : undefined;
      await this.redisCache.set(key, entry.data, entry.contentHash, ttl);
    } catch (error) {
      this.logger.warn(`Failed to write to Redis cache: ${error}`);
    }
  }


  private calculateHitRate(): number {
    if (this.memoryCache.size === 0) return 0;
    
    let totalAccess = 0;
    for (const entry of this.memoryCache.values()) {
      totalAccess += entry.accessCount;
    }
    
    return totalAccess / this.memoryCache.size;
  }

  private calculateTotalSize(): number {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry.data).length;
    }
    return size;
  }

  async close(): Promise<void> {
    await this.cleanup();
    await this.redisCache.close();
  }
}

/**
 * Specialized semantic search cache
 */
export class SemanticSearchCache {
  private embeddingCache: MultiLevelCache<number[]>;
  private segmentCache: MultiLevelCache<any[]>;
  private resultCache: MultiLevelCache<any>;
  
  constructor(projectPath: string) {
    const baseConfig = { fileBasePath: path.join(projectPath, '.codemind', 'cache') };
    
    this.embeddingCache = new MultiLevelCache('embeddings', {
      ...baseConfig,
      maxMemoryEntries: 500,
      defaultTTL: 24 * 3600000 // 24 hours for embeddings
    });
    
    this.segmentCache = new MultiLevelCache('segments', {
      ...baseConfig,
      maxMemoryEntries: 1000,
      defaultTTL: 3600000 // 1 hour for segments
    });
    
    this.resultCache = new MultiLevelCache('search-results', {
      ...baseConfig,
      maxMemoryEntries: 200,
      defaultTTL: 1800000 // 30 minutes for search results
    });
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.embeddingCache.initialize(),
      this.segmentCache.initialize(),
      this.resultCache.initialize()
    ]);
  }

  async getEmbedding(content: string, contentHash: string): Promise<number[] | null> {
    return this.embeddingCache.get(content, contentHash);
  }

  async setEmbedding(content: string, embedding: number[], contentHash: string): Promise<void> {
    await this.embeddingCache.set(content, embedding, contentHash);
  }

  async getSegments(filePath: string, contentHash: string): Promise<any[] | null> {
    return this.segmentCache.get(filePath, contentHash);
  }

  async setSegments(filePath: string, segments: any[], contentHash: string): Promise<void> {
    await this.segmentCache.set(filePath, segments, contentHash);
  }

  async getSearchResults(query: string, queryHash: string): Promise<any | null> {
    return this.resultCache.get(query, queryHash);
  }

  async setSearchResults(query: string, results: any, queryHash: string): Promise<void> {
    await this.resultCache.set(query, results, queryHash);
  }

  async invalidateFile(filePath: string): Promise<void> {
    const pattern = new RegExp(filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    await Promise.all([
      this.embeddingCache.invalidatePattern(pattern),
      this.segmentCache.invalidate(filePath),
      this.resultCache.invalidatePattern(/./) // Invalidate all search results
    ]);
  }

  getStats() {
    return {
      embeddings: this.embeddingCache.getStats(),
      segments: this.segmentCache.getStats(),
      results: this.resultCache.getStats()
    };
  }

  async close(): Promise<void> {
    await Promise.all([
      this.embeddingCache.close(),
      this.segmentCache.close(),
      this.resultCache.close()
    ]);
  }
}