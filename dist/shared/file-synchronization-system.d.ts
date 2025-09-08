/**
 * File Synchronization System
 * Maintains perfect sync between project files and database indexes using hash tracking
 */
export interface FileHashEntry {
    filePath: string;
    contentHash: string;
    lastModified: Date;
    fileSize: number;
    language: string;
    contentType: 'code' | 'config' | 'documentation' | 'test' | 'schema' | 'deployment';
}
export interface SyncResult {
    totalFiles: number;
    newFiles: number;
    modifiedFiles: number;
    deletedFiles: number;
    unchangedFiles: number;
    errors: Array<{
        filePath: string;
        error: string;
    }>;
}
export interface FileContent {
    filePath: string;
    content: string;
    metadata: {
        hash: string;
        size: number;
        language: string;
        contentType: string;
        lastModified: Date;
    };
}
export declare class FileSynchronizationSystem {
    private logger;
    private databaseAPI;
    private localHashCacheFile;
    private localHashCache;
    constructor(projectPath: string);
    initialize(): Promise<void>;
    private timeout;
    private delay;
    /**
     * Main synchronization method: ensures all project files are perfectly indexed
     */
    synchronizeProject(projectPath: string, projectId: string): Promise<SyncResult>;
    /**
     * Get file content from database (avoiding filesystem reads when possible)
     */
    getFileContent(projectId: string, filePath: string): Promise<FileContent | null>;
    /**
     * Check if a file is in sync (hash matches database)
     */
    isFileInSync(projectId: string, filePath: string): Promise<boolean>;
    /**
     * Force refresh a specific file in all indexes
     */
    refreshFile(projectPath: string, projectId: string, filePath: string): Promise<void>;
    /**
     * Discover all relevant files in the project
     */
    private discoverProjectFiles;
    /**
     * Get all file hashes from database for comparison
     */
    private getDatabaseFileHashes;
    /**
     * Sync a single file with the database
     */
    private syncSingleFile;
    /**
     * Index a completely new file
     */
    private indexNewFile;
    /**
     * Update an existing file in all indexes
     */
    private updateExistingFile;
    /**
     * Remove files that no longer exist from the database
     */
    private removeDeletedFiles;
    /**
     * Calculate hash for a file
     */
    private calculateFileHash;
    /**
     * Calculate hash for content string
     */
    private calculateContentHash;
    /**
     * Detect programming language from file extension
     */
    private detectLanguage;
    /**
     * Detect content type from file path
     */
    private detectContentType;
    /**
     * Ensure file index tables exist
     */
    private ensureFileIndexTables;
    /**
     * Insert or update file in the index table
     */
    private upsertFileIndex;
    /**
     * Update related indexes (semantic search, graph, tree navigation)
     */
    private updateRelatedIndexes;
    /**
     * Update vector embedding for semantic search
     */
    private updateVectorEmbedding;
    /**
     * Update Neo4j graph relationships
     */
    private updateGraphRelationships;
    /**
     * Update tree navigation data
     */
    private updateTreeNavigationData;
    /**
     * Remove from related indexes
     */
    private removeFromRelatedIndexes;
    /**
     * Load local hash cache from filesystem
     */
    private loadLocalHashCache;
    /**
     * Save local hash cache to filesystem
     */
    private saveLocalHashCache;
    /**
     * Get single file hash from database
     */
    private getDatabaseFileHash;
    close(): Promise<void>;
}
//# sourceMappingURL=file-synchronization-system.d.ts.map