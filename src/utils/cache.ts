/**
 * Cache Manager implementation
 */

import { CacheManager } from '../core/interfaces';
import { Logger } from './logger';

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

export class InMemoryCacheManager<K, V> implements CacheManager<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private logger: Logger;
  private defaultTTL: number;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    options: {
      defaultTTL?: number; // in milliseconds
      maxSize?: number;
      cleanupIntervalMs?: number;
      logger?: Logger;
    } = {}
  ) {
    this.defaultTTL = options.defaultTTL || 60 * 60 * 1000; // 1 hour default
    this.maxSize = options.maxSize || 1000;
    this.logger = options.logger || new Logger();

    // Start cleanup interval
    if (options.cleanupIntervalMs !== 0) {
      this.startCleanup(options.cleanupIntervalMs || 5 * 60 * 1000); // 5 minutes default
    }
  }

  async get(key: K): Promise<V | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.debug('Cache entry expired and removed', { key });
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  async set(key: K, value: V, ttl?: number): Promise<void> {
    const now = Date.now();
    const effectiveTTL = ttl || this.defaultTTL;

    // Check if we need to evict entries due to size limit
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      await this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<V> = {
      value,
      expiresAt: now + effectiveTTL,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    this.logger.debug('Cache entry set', { 
      key, 
      ttl: effectiveTTL, 
      size: this.cache.size 
    });
  }

  async delete(key: K): Promise<void> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug('Cache entry deleted', { key });
    }
  }

  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug('Cache cleared', { previousSize: size });
  }

  async has(key: K): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Additional utility methods
  size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  async getStats(): Promise<{
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  }> {
    let totalAccesses = 0;
    let memoryUsage = 0;

    for (const entry of this.cache.values()) {
      totalAccesses += entry.accessCount;
      // Rough memory estimation (not accurate but gives an idea)
      memoryUsage += JSON.stringify(entry.value).length;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalAccesses > 0 ? totalAccesses / this.cache.size : 0,
      memoryUsage
    };
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.cache.size === 0) return;

    let lruKey: K | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey !== null) {
      this.cache.delete(lruKey);
      this.logger.debug('Evicted LRU cache entry', { key: lruKey });
    }
  }

  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug('Cleaned up expired cache entries', { 
        removed: removedCount, 
        remaining: this.cache.size 
      });
    }
  }

  // Stop cleanup interval when cache is no longer needed
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Factory for creating different types of cache managers
export class CacheFactory {
  static createInMemoryCache<K, V>(options?: {
    defaultTTL?: number;
    maxSize?: number;
    cleanupIntervalMs?: number;
    logger?: Logger;
  }): InMemoryCacheManager<K, V> {
    return new InMemoryCacheManager(options);
  }

  static createFileCache<K extends string, V>(options: {
    cacheDir: string;
    defaultTTL?: number;
    logger?: Logger;
  }): FileCacheManager<K, V> {
    return new FileCacheManager(options);
  }
}

// Simple file-based cache manager
export class FileCacheManager<K extends string, V> implements CacheManager<K, V> {
  private cacheDir: string;
  private defaultTTL: number;
  private logger: Logger;

  constructor(options: {
    cacheDir: string;
    defaultTTL?: number;
    logger?: Logger;
  }) {
    this.cacheDir = options.cacheDir;
    this.defaultTTL = options.defaultTTL || 60 * 60 * 1000; // 1 hour
    this.logger = options.logger || new Logger();
  }

  async get(key: K): Promise<V | null> {
    try {
      const { promises: fs } = require('fs');
      const filePath = this.getFilePath(key);
      
      const exists = await this.fileExists(filePath);
      if (!exists) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      // Check if expired
      if (Date.now() > data.expiresAt) {
        await fs.unlink(filePath).catch(() => {}); // Ignore errors
        return null;
      }

      return data.value;
    } catch (error) {
      this.logger.error('Failed to get cache entry from file', error as Error);
      return null;
    }
  }

  async set(key: K, value: V, ttl?: number): Promise<void> {
    try {
      const { promises: fs } = require('fs');
      const filePath = this.getFilePath(key);
      const effectiveTTL = ttl || this.defaultTTL;

      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });

      const data = {
        value,
        expiresAt: Date.now() + effectiveTTL,
        createdAt: Date.now()
      };

      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
    } catch (error) {
      this.logger.error('Failed to set cache entry to file', error as Error);
    }
  }

  async delete(key: K): Promise<void> {
    try {
      const { promises: fs } = require('fs');
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore errors (file might not exist)
    }
  }

  async clear(): Promise<void> {
    try {
      const { promises: fs } = require('fs');
      const files = await fs.readdir(this.cacheDir);
      
      await Promise.all(
        files.map((file: string) => 
          fs.unlink(require('path').join(this.cacheDir, file)).catch(() => {})
        )
      );
    } catch (error) {
      this.logger.error('Failed to clear file cache', error as Error);
    }
  }

  async has(key: K): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  private getFilePath(key: K): string {
    const { join } = require('path');
    const { createHash } = require('crypto');
    
    // Create a safe filename from the key
    const hash = createHash('md5').update(key).digest('hex');
    return join(this.cacheDir, `${hash}.json`);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const { promises: fs } = require('fs');
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}