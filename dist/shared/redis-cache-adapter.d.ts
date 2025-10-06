/**
 * Redis Cache Adapter - Pure Redis caching implementation
 * Replaces PostgreSQL caching functionality to maintain database separation
 */
export interface RedisCacheEntry<T> {
    key: string;
    data: T;
    contentHash: string;
    timestamp: Date;
    accessCount: number;
    lastAccessed: Date;
    expiresAt?: Date;
    metadata?: Record<string, any>;
}
export declare class RedisCacheAdapter<T> {
    private logger;
    private dbConnections;
    private redisClient;
    private keyPrefix;
    private isConnected;
    constructor(keyPrefix?: string);
    initialize(): Promise<void>;
    /**
     * Get cached entry from Redis
     */
    get(key: string, contentHash?: string): Promise<RedisCacheEntry<T> | null>;
    /**
     * Set cached entry in Redis
     */
    set(key: string, data: T, contentHash: string, ttl?: number): Promise<void>;
    /**
     * Delete cached entry from Redis
     */
    delete(key: string): Promise<void>;
    /**
     * Invalidate entries matching a pattern
     */
    invalidatePattern(pattern: RegExp): Promise<number>;
    /**
     * Clear all cache entries with this prefix
     */
    clear(): Promise<number>;
    /**
     * Get cache statistics
     */
    getStats(): Promise<{
        totalKeys: number;
        memoryUsage: number;
        hitRate: number;
    }>;
    /**
     * Check if a key exists and is not expired
     */
    exists(key: string): Promise<boolean>;
    /**
     * Cleanup expired entries (Redis handles TTL automatically, but this can clean manual expires)
     */
    cleanup(): Promise<number>;
    close(): Promise<void>;
    private createRedisKey;
    private extractOriginalKey;
    private updateAccessStats;
}
/**
 * Factory for creating Redis cache adapters with different prefixes
 */
export declare class RedisCacheFactory {
    static createCache<T>(prefix: string): RedisCacheAdapter<T>;
    static createSemanticCache<T>(): RedisCacheAdapter<T>;
    static createEmbeddingCache<T>(): RedisCacheAdapter<T>;
    static createResultCache<T>(): RedisCacheAdapter<T>;
}
//# sourceMappingURL=redis-cache-adapter.d.ts.map