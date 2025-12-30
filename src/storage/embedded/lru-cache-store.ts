/**
 * LRU Cache Store with Disk Persistence
 *
 * Provides in-memory caching using lru-cache with:
 * - LRU eviction when max size reached
 * - TTL (time-to-live) support
 * - Automatic disk persistence for durability
 * - Tag-based invalidation
 * - Zero external dependencies (no Redis server required)
 *
 * Persists cache state to JSON file periodically and on close.
 */

import { LRUCache } from 'lru-cache';
import * as path from 'path';
import * as fs from 'fs';
import { ICacheStore } from '../interfaces';

interface CacheEntryData<T = unknown> {
  value: T;
  tags?: string[];
  expiresAt?: number; // Unix timestamp
}

export class LRUCacheStore implements ICacheStore {
  private cache: LRUCache<string, CacheEntryData>;
  private dataDir: string;
  private dbPath: string;
  private isDirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private hits = 0;
  private misses = 0;

  constructor(
    dataDir: string,
    private flushIntervalSeconds = 30,
    private maxSize = 10000
  ) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'cache.json');

    // Ensure data directory exists
    fs.mkdirSync(dataDir, { recursive: true });

    // Create LRU cache
    this.cache = new LRUCache<string, CacheEntryData>({
      max: maxSize,
      ttl: 0, // We handle TTL ourselves for persistence
      updateAgeOnGet: true
    });

    this.loadFromDisk();
    this.startFlushTimer();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(data) as Array<{ key: string; entry: CacheEntryData }>;

        const now = Date.now();
        for (const { key, entry } of parsed) {
          // Skip expired entries
          if (entry.expiresAt && entry.expiresAt < now) {
            continue;
          }
          this.cache.set(key, entry);
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from disk, starting fresh:', error);
    }
  }

  private saveToDisk(): void {
    try {
      const entries: Array<{ key: string; entry: CacheEntryData }> = [];
      const now = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        // Skip expired entries
        if (entry.expiresAt && entry.expiresAt < now) {
          continue;
        }
        entries.push({ key, entry });
      }

      fs.writeFileSync(this.dbPath, JSON.stringify(entries, null, 2), 'utf-8');
      this.isDirty = false;
    } catch (error) {
      console.error('Failed to save cache to disk:', error);
    }
  }

  private startFlushTimer(): void {
    if (this.flushIntervalSeconds > 0) {
      this.flushTimer = setInterval(() => {
        if (this.isDirty) {
          this.flush().catch(console.error);
        }
      }, this.flushIntervalSeconds * 1000);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      this.isDirty = true;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const entry: CacheEntryData<T> = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    };

    this.cache.set(key, entry);
    this.isDirty = true;
  }

  async setWithTags<T>(key: string, value: T, tags: string[], ttlSeconds?: number): Promise<void> {
    const entry: CacheEntryData<T> = {
      value,
      tags,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    };

    this.cache.set(key, entry);
    this.isDirty = true;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    if (existed) {
      this.isDirty = true;
    }
    return existed;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.isDirty = true;
      return false;
    }

    return true;
  }

  async deletePattern(pattern: string): Promise<number> {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.isDirty = true;
    }

    return count;
  }

  async deleteByTag(tag: string): Promise<number> {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.isDirty = true;
    }

    return count;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.isDirty = true;
  }

  async stats(): Promise<{ size: number; hits: number; misses: number }> {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses
    };
  }

  async flush(): Promise<void> {
    this.saveToDisk();
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}