/**
 * Sync Manager Service
 * Maintains consistency between semantic search, graph, and actual code changes
 * Uses PostgreSQL as single source of truth for file state tracking
 */
import { DatabaseConnections } from '../../config/database-config';
import { SyncRecommendation, SyncStrategy } from '../../shared/file-hash-tracker';
export interface FileHashEntry {
    path: string;
    contentHash: string;
    structureHash: string;
    lastModified: number;
    lastSynced: number;
    embeddingVersion: string;
    size: number;
}
export interface SyncResult {
    totalFiles: number;
    changedFiles: number;
    deletedFiles: number;
    newFiles: number;
    updatedEmbeddings: number;
    updatedGraphNodes: number;
    duration: number;
    strategy: string;
}
export interface SyncOptions {
    forceFullSync?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxConcurrency?: number;
    updateEmbeddings?: boolean;
    updateGraph?: boolean;
}
export declare class SyncManagerService {
    private logger;
    private dbConnections;
    private fileSyncSystem;
    private fileHashTracker;
    private redis;
    private embeddingService;
    private semanticGraphService;
    private currentEmbeddingVersion;
    private readonly HASH_PREFIX;
    constructor(dbConnections?: DatabaseConnections);
    private ensureRedisConnection;
    /**
     * Get intelligent sync recommendation based on file changes
     */
    getSyncRecommendation(projectId: string, projectFiles: string[], strategy?: SyncStrategy): Promise<SyncRecommendation>;
    /**
     * Main sync method - intelligently detects and updates changes
     */
    syncProject(projectPath: string, options?: SyncOptions): Promise<SyncResult>;
    /**
     * Quick sync check - lightweight validation before user operations
     */
    quickSyncCheck(projectPath: string): Promise<boolean>;
    /**
     * Scan project files and compute hashes
     */
    private scanProjectFiles;
    /**
     * Compute both content and structure hashes for a file
     */
    private computeFileHashes;
    /**
     * Compute structural hash (AST-based) for semantic significance
     */
    private computeStructureHash;
    /**
     * Extract TypeScript/JavaScript structural elements
     */
    private extractTSStructure;
    /**
     * Extract Python structural elements
     */
    private extractPythonStructure;
    /**
     * Generic structural extraction for other languages
     */
    private extractGenericStructure;
    /**
     * Compare current files with Redis cache to detect changes
     */
    private detectChanges;
    /**
     * Process detected changes
     */
    private processChanges;
    /**
     * Get sample files for quick sync check
     */
    getSampleFiles(projectPath: string, maxFiles?: number): Promise<FileHashEntry[]>;
    private getCachedHashes;
    private updateHashCache;
    private cleanupDeletedFileHashes;
    private updateEmbeddings;
    private updateSemanticGraph;
    private cleanupDeletedFiles;
    private cleanupEmbeddingsForDeletedFiles;
    private cleanupSemanticGraphForDeletedFiles;
    private createSyncResult;
}
export default SyncManagerService;
//# sourceMappingURL=sync-manager-service.d.ts.map