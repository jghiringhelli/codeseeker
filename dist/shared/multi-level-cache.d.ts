/**
 * Multi-Level Cache System
 * Provides L1 (memory), L2 (file), and L3 (database) caching with smart invalidation
 */
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
    maxFileSize: number;
    defaultTTL: number;
    fileBasePath: string;
    enableCompression: boolean;
}
export declare class MultiLevelCache<T> {
    private logger;
    private redisCache;
    private config;
    private memoryCache;
    private fileCacheDir;
    constructor(cacheName: string, config?: Partial<CacheConfig>);
    initialize(): Promise<void>;
    /**
     * Get data from cache (tries L1 → L2 → L3)
     */
    get(key: string, contentHash?: string): Promise<T | null>;
    /**
     * Set data in all cache levels
     */
    set(key: string, data: T, contentHash: string, ttl?: number): Promise<void>;
    /**
     * Invalidate cache entry when content changes
     */
    invalidate(key: string): Promise<void>;
    /**
     * Smart bulk invalidation based on file patterns
     */
    invalidatePattern(pattern: RegExp): Promise<number>;
    /**
     * Get cache statistics
     */
    getStats(): {
        memoryEntries: number;
        memoryHitRate: number;
        totalSize: number;
    };
    /**
     * Cleanup expired entries
     */
    cleanup(): Promise<number>;
    private createCacheKey;
    private isEntryValid;
    private setMemoryCache;
    private findLeastRecentlyUsed;
    private getFromFileCache;
    private readFileEntry;
    private setFileCache;
    private getFromRedisCache;
    private setRedisCache;
    private calculateHitRate;
    private calculateTotalSize;
    close(): Promise<void>;
}
/**
 * Specialized semantic search cache
 */
export declare class SemanticSearchCache {
    private embeddingCache;
    private segmentCache;
    private resultCache;
    constructor(projectPath: string);
    initialize(): Promise<void>;
    getEmbedding(content: string, contentHash: string): Promise<number[] | null>;
    setEmbedding(content: string, embedding: number[], contentHash: string): Promise<void>;
    getSegments(filePath: string, contentHash: string): Promise<any[] | null>;
    setSegments(filePath: string, segments: any[], contentHash: string): Promise<void>;
    getSearchResults(query: string, queryHash: string): Promise<any | null>;
    setSearchResults(query: string, results: any, queryHash: string): Promise<void>;
    invalidateFile(filePath: string): Promise<void>;
    getStats(): {
        embeddings: {
            memoryEntries: number;
            memoryHitRate: number;
            totalSize: number;
        };
        segments: {
            memoryEntries: number;
            memoryHitRate: number;
            totalSize: number;
        };
        results: {
            memoryEntries: number;
            memoryHitRate: number;
            totalSize: number;
        };
    };
    close(): Promise<void>;
}
//# sourceMappingURL=multi-level-cache.d.ts.map