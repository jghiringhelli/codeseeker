/**
 * Database Update Manager
 * SOLID Principles: Single Responsibility - Handle database updates across all systems
 *
 * This manager coordinates updates to:
 * - PostgreSQL (semantic search embeddings)
 * - Neo4j (knowledge graph relationships)
 * - Redis (caching layer)
 *
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
    constructor(projectId?: string, projectPath?: string);
    /**
     * Set project context for updates
     */
    setProject(projectId: string, projectPath: string): void;
    /**
     * Update Neo4j graph with new/modified file nodes and relationships
     */
    updateGraphDatabase(files: string[]): Promise<{
        nodesCreated: number;
        relationshipsCreated: number;
    }>;
    /**
     * Test Neo4j connection
     */
    testGraphConnection(): Promise<void>;
    /**
     * Update properties on existing node
     */
    updateNodeProperties(filePath: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Clean up old graph data
     */
    cleanupOldGraphData(olderThanDays: number): Promise<{
        nodesDeleted: number;
        relationshipsDeleted: number;
    }>;
    /**
     * Update Redis cache with file hashes and metadata
     */
    updateRedisCache(files: string[]): Promise<{
        filesUpdated: number;
        hashesUpdated: number;
    }>;
    /**
     * Test Redis connection
     */
    testRedisConnection(): Promise<void>;
    /**
     * Update Redis hash for a file
     */
    updateRedisHash(filePath: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Clean up old cache data
     */
    cleanupOldCacheData(olderThanDays: number): Promise<{
        keysDeleted: number;
    }>;
    /**
     * Update PostgreSQL with file embeddings and metadata
     */
    updateMainDatabase(files: string[]): Promise<{
        recordsUpdated: number;
    }>;
    /**
     * Test PostgreSQL connection
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