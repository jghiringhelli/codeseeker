/**
 * Hash-based Change Detection for Deduplication
 * Uses Redis hash keys efficiently with file paths as keys and content hashes as values
 * Hash comparison is the definitive check for file changes
 */
import { DatabaseConnections } from '../../../config/database-config';
export interface FileChangeInfo {
    path: string;
    contentHash: string;
    lastModified: Date;
    size?: number;
}
export interface ChangedFiles {
    added: FileChangeInfo[];
    modified: FileChangeInfo[];
    deleted: FileChangeInfo[];
    unchanged: number;
}
export declare class HashChangeDetector {
    private logger;
    private dbConnections;
    constructor(dbConnections?: DatabaseConnections);
    /**
     * Detect changed files using Redis hash structure
     * More efficient than storing JSON blobs
     */
    detectChanges(projectId: string): Promise<ChangedFiles>;
    /**
     * Update Redis cache with current file states
     * Uses Redis hash for efficient storage and retrieval
     */
    private updateCache;
    /**
     * Get file change statistics
     */
    getChangeStats(projectId: string): Promise<{
        totalFiles: number;
        lastScan: Date | null;
        cacheSize: number;
    }>;
    /**
     * Clear cache for a project
     */
    clearCache(projectId: string): Promise<void>;
    /**
     * Check if a specific file has changed
     */
    hasFileChanged(projectId: string, filePath: string, currentHash: string): Promise<boolean>;
    /**
     * Batch check multiple files for changes
     */
    checkMultipleFiles(projectId: string, files: Array<{
        path: string;
        hash: string;
    }>): Promise<Map<string, boolean>>;
}
//# sourceMappingURL=hash-change-detector.d.ts.map