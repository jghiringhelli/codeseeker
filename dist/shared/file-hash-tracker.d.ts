/**
 * File Hash Tracker - Redis-based file change detection
 * Tracks file hashes to enable intelligent sync decisions
 * Supports project-level and session-level tracking
 */
import Redis from 'ioredis';
export interface FileHashInfo {
    filePath: string;
    hash: string;
    lastModified: number;
    size: number;
    syncedAt: number;
    embedding?: boolean;
    graph?: boolean;
    analysis?: boolean;
}
export interface SyncRecommendation {
    shouldSync: boolean;
    reason: 'unchanged' | 'modified' | 'new' | 'deleted' | 'forced' | 'time_threshold' | 'session_start';
    changedFiles: string[];
    newFiles: string[];
    deletedFiles: string[];
    modifiedFiles: string[];
    stats: {
        totalFiles: number;
        unchangedFiles: number;
        changedFiles: number;
        newFiles: number;
        deletedFiles: number;
    };
}
export interface SyncStrategy {
    mode: 'incremental' | 'full' | 'selective';
    timeThreshold?: number;
    forceSync?: boolean;
    sessionStart?: boolean;
    includeEmbeddings?: boolean;
    includeGraph?: boolean;
    includeAnalysis?: boolean;
}
export declare class FileHashTracker {
    private redis;
    private initialized;
    constructor(redisConnection?: Redis);
    /**
     * Initialize Redis connection and ensure ready state
     */
    initialize(): Promise<void>;
    /**
     * Get Redis key for file hash storage
     */
    private getFileHashKey;
    /**
     * Get Redis key for sync metadata
     */
    private getSyncMetaKey;
    /**
     * Calculate file hash (SHA-256)
     */
    private calculateFileHash;
    /**
     * Get file stats safely
     */
    private getFileStats;
    /**
     * Store file hash information in Redis
     */
    storeFileHash(projectId: string, filePath: string, syncComponents?: {
        embedding?: boolean;
        graph?: boolean;
        analysis?: boolean;
    }): Promise<void>;
    /**
     * Get stored file hash information
     */
    getFileHash(projectId: string, filePath: string): Promise<FileHashInfo | null>;
    /**
     * Remove file hash from tracking
     */
    removeFileHash(projectId: string, filePath: string): Promise<void>;
    /**
     * Get all tracked files for a project
     */
    getTrackedFiles(projectId: string): Promise<FileHashInfo[]>;
    /**
     * Check if file has changed since last sync
     */
    hasFileChanged(projectId: string, filePath: string): Promise<boolean>;
    /**
     * Analyze project files and provide sync recommendation
     */
    analyzeSyncNeeds(projectId: string, projectFiles: string[], strategy?: SyncStrategy): Promise<SyncRecommendation>;
    /**
     * Check if time threshold for sync has been exceeded
     */
    isTimeThresholdExceeded(projectId: string, thresholdHours: number): Promise<boolean>;
    /**
     * Update sync metadata
     */
    updateSyncMetadata(projectId: string, metadata: {
        lastSyncTime?: number;
        syncStrategy?: string;
        filesProcessed?: number;
        syncDuration?: number;
    }): Promise<void>;
    /**
     * Get sync metadata
     */
    getSyncMetadata(projectId: string): Promise<Record<string, string>>;
    /**
     * Mark file as synced with specific components
     */
    markFileSynced(projectId: string, filePath: string, components: {
        embedding?: boolean;
        graph?: boolean;
        analysis?: boolean;
    }): Promise<void>;
    /**
     * Get files that need specific component updates
     */
    getFilesNeedingComponent(projectId: string, component: 'embedding' | 'graph' | 'analysis'): Promise<string[]>;
    /**
     * Clear all tracking data for a project
     */
    clearProject(projectId: string): Promise<void>;
    /**
     * Get sync statistics for dashboard
     */
    getSyncStats(projectId: string): Promise<{
        totalTrackedFiles: number;
        lastSyncTime: number | null;
        syncStrategy: string | null;
        componentStats: {
            withEmbeddings: number;
            withGraph: number;
            withAnalysis: number;
        };
    }>;
    /**
     * Cleanup - close Redis connection
     */
    cleanup(): Promise<void>;
}
export default FileHashTracker;
//# sourceMappingURL=file-hash-tracker.d.ts.map