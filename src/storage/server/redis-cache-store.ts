/**
 * Redis Cache Store
 *
 * Provides distributed caching using Redis:
 * - Fast key-value storage with TTL support
 * - Pattern-based key deletion
 * - Tag-based cache invalidation
 *
 * Requires Redis server running.
 * See docs/STORAGE.md for setup instructions.
 */

import { createClient, RedisClientType } from 'redis';
import { ICacheStore } from '../interfaces';

export interface RedisCacheStoreConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  keyPrefix?: string;
}

export class RedisCacheStore implements ICacheStore {
  private client: RedisClientType;
  private keyPrefix: string;
  private connected = false;
  private hits = 0;
  private misses = 0;

  constructor(private config: RedisCacheStoreConfig) {
    this.keyPrefix = config.keyPrefix || 'codeseeker:';
    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
        connectTimeout: 5000
      },
      password: config.password,
      database: config.database || 0
    });

    // Handle connection events
    this.client.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    this.client.on('connect', () => {
      this.connected = true;
    });

    this.client.on('end', () => {
      this.connected = false;
    });
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private tagKey(tag: string): string {
    return `${this.keyPrefix}tag:${tag}`;
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnected();

    const prefixedKey = this.prefixKey(key);
    const value = await this.client.get(prefixedKey);

    if (value === null) {
      this.misses++;
      return null;
    }

    this.hits++;
    try {
      return JSON.parse(value as string) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.ensureConnected();

    const prefixedKey = this.prefixKey(key);
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.setEx(prefixedKey, ttlSeconds, serialized);
    } else {
      await this.client.set(prefixedKey, serialized);
    }
  }

  /**
   * Set with tags for bulk invalidation
   */
  async setWithTags<T>(key: string, value: T, tags: string[], ttlSeconds?: number): Promise<void> {
    await this.ensureConnected();

    const prefixedKey = this.prefixKey(key);
    const serialized = JSON.stringify(value);

    // Use a multi/exec transaction for atomicity
    const multi = this.client.multi();

    if (ttlSeconds) {
      multi.setEx(prefixedKey, ttlSeconds, serialized);
    } else {
      multi.set(prefixedKey, serialized);
    }

    // Add key to each tag's set
    for (const tag of tags) {
      multi.sAdd(this.tagKey(tag), prefixedKey);
    }

    await multi.exec();
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();

    const prefixedKey = this.prefixKey(key);
    const result = await this.client.del(prefixedKey);
    return result > 0;
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnected();

    const prefixedKey = this.prefixKey(key);
    const exists = await this.client.exists(prefixedKey);
    return exists > 0;
  }

  async deletePattern(pattern: string): Promise<number> {
    await this.ensureConnected();

    const prefixedPattern = this.prefixKey(pattern);
    let deleted = 0;

    // Use SCAN to find matching keys (safer than KEYS for production)
    for await (const key of this.client.scanIterator({
      MATCH: prefixedPattern,
      COUNT: 100
    })) {
      await this.client.del(key);
      deleted++;
    }

    return deleted;
  }

  async deleteByTag(tag: string): Promise<number> {
    await this.ensureConnected();

    const tagSetKey = this.tagKey(tag);

    // Get all keys with this tag
    const keys = await this.client.sMembers(tagSetKey);

    if (keys.length === 0) return 0;

    // Delete all tagged keys and the tag set itself
    const deleted = await this.client.del([...keys, tagSetKey]);
    return deleted;
  }

  async clear(): Promise<void> {
    await this.ensureConnected();

    // Delete all keys with our prefix
    await this.deletePattern('*');
    this.hits = 0;
    this.misses = 0;
  }

  async stats(): Promise<{ size: number; hits: number; misses: number }> {
    await this.ensureConnected();

    // Count keys with our prefix
    let size = 0;
    for await (const _key of this.client.scanIterator({
      MATCH: `${this.keyPrefix}*`,
      COUNT: 100
    })) {
      size++;
    }

    return {
      size,
      hits: this.hits,
      misses: this.misses
    };
  }

  async flush(): Promise<void> {
    // No-op for Redis (writes are immediate)
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Test connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureConnected();
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get Redis server info
   */
  async getInfo(): Promise<Record<string, string>> {
    await this.ensureConnected();

    const info = await this.client.info();
    const result: Record<string, string> = {};

    // Parse INFO output
    info.split('\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key.trim()] = value?.trim() || '';
      }
    });

    return result;
  }
}