/**
 * Database Update Manager
 * SOLID Principles: Single Responsibility - Handle database updates across all systems
 *
 * This manager coordinates updates to:
 * - Vector Store (semantic search embeddings) - SQLite or PostgreSQL
 * - Graph Store (knowledge graph relationships) - Graphology or Neo4j
 * - Cache Store (caching layer) - LRU-cache or Redis
 *
 * Uses storage abstraction to work with either embedded or server mode.
 * Used after each Claude Code execution to keep databases in sync with code changes.
 */
export interface GraphUpdateResult {
    nodesCreated: number;
    nodesUpdated: number;
    relationshipsCreated: number;
}
export interface CacheUpdateResult {
    filesUpdated: number;
    hashesUpdated: number;
}
export interface DatabaseUpdateResult {
    recordsUpdated: number;
    recordsInserted: number;
}
export declare class DatabaseUpdateManager {
    private logger;
    private dbConnections;
    private projectId;
    private projectPath;
    private useEmbedded;
    private vectorStore?;
    private graphStore?;
    private cacheStore?;
    private projectStore?;
    constructor(projectId?: string, projectPath?: string);
    /**
     * Initialize storage interfaces (lazy loading)
     */
    private initStorage;
    /**
     * Set project context for updates
     */
    setProject(projectId: string, projectPath: string): void;
    /**
     * Update graph with new/modified file nodes and relationships
     * Uses storage abstraction - embedded uses Graphology, server uses Neo4j
     */
    updateGraphDatabase(files: string[]): Promise<{
        nodesCreated: number;
        relationshipsCreated: number;
    }>;
    /**
     * Embedded mode: Update graph using Graphology store
     */
    private updateGraphDatabaseEmbedded;
    /**
     * Server mode: Update graph using Neo4j
     */
    private updateGraphDatabaseNeo4j;
    /**
     * Test graph connection
     */
    testGraphConnection(): Promise<void>;
    /**
     * Update properties on existing node
     */
    updateNodeProperties(filePath: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Clean up old graph data
     */
    cleanupOldGraphData(_olderThanDays: number): Promise<{
        nodesDeleted: number;
        relationshipsDeleted: number;
    }>;
    /**
     * Update cache with file hashes and metadata
     * Uses storage abstraction - embedded uses LRU-cache, server uses Redis
     */
    updateRedisCache(files: string[]): Promise<{
        filesUpdated: number;
        hashesUpdated: number;
    }>;
    /**
     * Embedded mode: Update cache using LRU-cache store
     */
    private updateCacheEmbedded;
    /**
     * Server mode: Update cache using Redis
     */
    private updateCacheRedis;
    /**
     * Test cache connection
     */
    testRedisConnection(): Promise<void>;
    /**
     * Update cache hash for a file
     */
    updateRedisHash(filePath: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Clean up old cache data
     */
    cleanupOldCacheData(_olderThanDays: number): Promise<{
        keysDeleted: number;
    }>;
    /**
     * Update vector store with file embeddings and metadata
     * Uses storage abstraction - embedded uses SQLite, server uses PostgreSQL
     */
    updateMainDatabase(files: string[]): Promise<{
        recordsUpdated: number;
    }>;
    /**
     * Embedded mode: Update vector store using SQLite
     */
    private updateVectorStoreEmbedded;
    /**
     * Server mode: Update vector store using PostgreSQL
     */
    private updateVectorStorePostgres;
    /**
     * Test vector store connection
     */
    testMainDatabaseConnection(): Promise<void>;
    /**
     * Update file record with metadata
     */
    updateFileRecord(filePath: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Clean up old database records
     */
    cleanupOldMainData(olderThanDays: number): Promise<{
        recordsDeleted: number;
    }>;
    private computeHash;
    private determineFileType;
    private extractClasses;
    private extractFunctions;
    private extractImports;
    close(): Promise<void>;
}
//# sourceMappingURL=database-update-manager.d.ts.map