"use strict";
/**
 * Redis Cache Adapter - Pure Redis caching implementation
 * Replaces PostgreSQL caching functionality to maintain database separation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCacheFactory = exports.RedisCacheAdapter = void 0;
const logger_1 = require("../utils/logger");
const database_config_1 = require("../config/database-config");
class RedisCacheAdapter {
    logger = logger_1.Logger.getInstance();
    dbConnections;
    redisClient;
    keyPrefix;
    isConnected = false;
    constructor(keyPrefix = 'codemind:cache') {
        this.keyPrefix = keyPrefix;
        this.dbConnections = new database_config_1.DatabaseConnections();
    }
    async initialize() {
        try {
            // Try to connect with timeout protection
            const connectionTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
            });
            this.redisClient = await Promise.race([
                this.dbConnections.getRedisConnection(),
                connectionTimeout
            ]);
            this.isConnected = true;
            this.logger.info(`🗄️  Redis cache adapter initialized with prefix: ${this.keyPrefix}`);
        }
        catch (error) {
            this.isConnected = false;
            this.logger.warn(`⚠️  Redis cache adapter failed to initialize: ${error.message}`);
            this.logger.warn('  Cache will operate in degraded mode (memory and file cache only)');
        }
    }
    /**
     * Get cached entry from Redis
     */
    async get(key, contentHash) {
        if (!this.isConnected) {
            return null; // Skip Redis if not connected
        }
        try {
            const redisKey = this.createRedisKey(key);
            const cachedData = await this.redisClient.get(redisKey);
            if (!cachedData) {
                return null;
            }
            const entry = JSON.parse(cachedData);
            // Convert date strings back to Date objects
            entry.timestamp = new Date(entry.timestamp);
            entry.lastAccessed = new Date(entry.lastAccessed);
            if (entry.expiresAt) {
                entry.expiresAt = new Date(entry.expiresAt);
            }
            // Check if expired
            if (entry.expiresAt && entry.expiresAt < new Date()) {
                await this.delete(key);
                return null;
            }
            // Check content hash if provided
            if (contentHash && entry.contentHash !== contentHash) {
                return null;
            }
            // Update access statistics
            entry.accessCount++;
            entry.lastAccessed = new Date();
            // Update the entry in Redis with new access stats
            await this.updateAccessStats(redisKey, entry);
            return entry;
        }
        catch (error) {
            this.logger.warn(`Failed to get from Redis cache: ${error}`);
            return null;
        }
    }
    /**
     * Set cached entry in Redis
     */
    async set(key, data, contentHash, ttl) {
        if (!this.isConnected) {
            return; // Skip Redis if not connected
        }
        try {
            const entry = {
                key,
                data,
                contentHash,
                timestamp: new Date(),
                accessCount: 1,
                lastAccessed: new Date(),
                expiresAt: ttl ? new Date(Date.now() + ttl) : undefined
            };
            const redisKey = this.createRedisKey(key);
            const serializedEntry = JSON.stringify(entry);
            if (ttl) {
                // Set with expiration
                await this.redisClient.setex(redisKey, Math.floor(ttl / 1000), serializedEntry);
            }
            else {
                // Set without expiration
                await this.redisClient.set(redisKey, serializedEntry);
            }
            this.logger.debug(`💾 Redis cached: ${key} (hash: ${contentHash.substring(0, 8)})`);
        }
        catch (error) {
            this.logger.warn(`Failed to set Redis cache: ${error}`);
        }
    }
    /**
     * Delete cached entry from Redis
     */
    async delete(key) {
        if (!this.isConnected) {
            return; // Skip Redis if not connected
        }
        try {
            const redisKey = this.createRedisKey(key);
            await this.redisClient.del(redisKey);
            this.logger.debug(`🗑️  Redis cache deleted: ${key}`);
        }
        catch (error) {
            this.logger.warn(`Failed to delete from Redis cache: ${error}`);
        }
    }
    /**
     * Invalidate entries matching a pattern
     */
    async invalidatePattern(pattern) {
        if (!this.isConnected) {
            return 0; // Skip Redis if not connected
        }
        try {
            const searchPattern = `${this.keyPrefix}:*`;
            const keys = await this.redisClient.keys(searchPattern);
            let invalidated = 0;
            for (const redisKey of keys) {
                // Extract the original key from redis key
                const originalKey = this.extractOriginalKey(redisKey);
                if (pattern.test(originalKey)) {
                    await this.redisClient.del(redisKey);
                    invalidated++;
                }
            }
            this.logger.info(`🧹 Redis invalidated ${invalidated} entries matching pattern: ${pattern}`);
            return invalidated;
        }
        catch (error) {
            this.logger.warn(`Failed to invalidate Redis pattern: ${error}`);
            return 0;
        }
    }
    /**
     * Clear all cache entries with this prefix
     */
    async clear() {
        try {
            const searchPattern = `${this.keyPrefix}:*`;
            const keys = await this.redisClient.keys(searchPattern);
            if (keys.length > 0) {
                await this.redisClient.del(...keys);
            }
            this.logger.info(`🧽 Redis cleared ${keys.length} cache entries`);
            return keys.length;
        }
        catch (error) {
            this.logger.warn(`Failed to clear Redis cache: ${error}`);
            return 0;
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            const searchPattern = `${this.keyPrefix}:*`;
            const keys = await this.redisClient.keys(searchPattern);
            let totalAccessCount = 0;
            let totalMemoryUsage = 0;
            for (const key of keys.slice(0, 100)) { // Sample first 100 keys for performance
                const data = await this.redisClient.get(key);
                if (data) {
                    const entry = JSON.parse(data);
                    totalAccessCount += entry.accessCount || 0;
                    totalMemoryUsage += data.length;
                }
            }
            return {
                totalKeys: keys.length,
                memoryUsage: totalMemoryUsage,
                hitRate: keys.length > 0 ? totalAccessCount / keys.length : 0
            };
        }
        catch (error) {
            this.logger.warn(`Failed to get Redis cache stats: ${error}`);
            return { totalKeys: 0, memoryUsage: 0, hitRate: 0 };
        }
    }
    /**
     * Check if a key exists and is not expired
     */
    async exists(key) {
        try {
            const redisKey = this.createRedisKey(key);
            return (await this.redisClient.exists(redisKey)) > 0;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Cleanup expired entries (Redis handles TTL automatically, but this can clean manual expires)
     */
    async cleanup() {
        try {
            const searchPattern = `${this.keyPrefix}:*`;
            const keys = await this.redisClient.keys(searchPattern);
            let cleaned = 0;
            const now = new Date();
            for (const redisKey of keys) {
                const data = await this.redisClient.get(redisKey);
                if (data) {
                    const entry = JSON.parse(data);
                    if (entry.expiresAt && new Date(entry.expiresAt) < now) {
                        await this.redisClient.del(redisKey);
                        cleaned++;
                    }
                }
            }
            this.logger.info(`🧽 Redis cleaned ${cleaned} manually expired entries`);
            return cleaned;
        }
        catch (error) {
            this.logger.warn(`Failed to cleanup Redis cache: ${error}`);
            return 0;
        }
    }
    async close() {
        // Note: We don't close the Redis connection here as it might be shared
        // The DatabaseConnections class handles connection lifecycle
        this.logger.debug('Redis cache adapter closed');
    }
    // Private helper methods
    createRedisKey(key) {
        // Create a Redis-safe key with proper namespacing
        const hash = require('crypto').createHash('md5').update(key).digest('hex');
        return `${this.keyPrefix}:${hash}`;
    }
    extractOriginalKey(redisKey) {
        // This is approximate since we hash the keys - for pattern matching
        // we'd need to store the original key in the value if exact matching is critical
        return redisKey.replace(`${this.keyPrefix}:`, '');
    }
    async updateAccessStats(redisKey, entry) {
        try {
            // Update the entry in Redis with new access statistics
            const serializedEntry = JSON.stringify(entry);
            // Preserve the original TTL
            const ttl = await this.redisClient.ttl(redisKey);
            if (ttl > 0) {
                await this.redisClient.setex(redisKey, ttl, serializedEntry);
            }
            else {
                await this.redisClient.set(redisKey, serializedEntry);
            }
        }
        catch (error) {
            // Don't log this as it's not critical
        }
    }
}
exports.RedisCacheAdapter = RedisCacheAdapter;
/**
 * Factory for creating Redis cache adapters with different prefixes
 */
class RedisCacheFactory {
    static createCache(prefix) {
        return new RedisCacheAdapter(prefix);
    }
    static createSemanticCache() {
        return new RedisCacheAdapter('codemind:semantic');
    }
    static createEmbeddingCache() {
        return new RedisCacheAdapter('codemind:embeddings');
    }
    static createResultCache() {
        return new RedisCacheAdapter('codemind:results');
    }
}
exports.RedisCacheFactory = RedisCacheFactory;
//# sourceMappingURL=redis-cache-adapter.js.map