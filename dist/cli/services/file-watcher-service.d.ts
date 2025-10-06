/**
 * File Watcher Service
 * Real-time file system monitoring for automatic sync triggering
 * Provides intelligent debouncing and change filtering
 */
import { EventEmitter } from 'events';
import { SyncManagerService } from './sync-manager-service';
export interface FileChangeEvent {
    type: 'created' | 'modified' | 'deleted';
    filePath: string;
    timestamp: number;
}
export interface WatcherOptions {
    enabled?: boolean;
    debounceMs?: number;
    excludePatterns?: string[];
    includePatterns?: string[];
    autoSync?: boolean;
    syncDelayMs?: number;
}
export declare class FileWatcherService extends EventEmitter {
    private logger;
    private syncManager;
    private watchers;
    private pendingChanges;
    private debounceTimer;
    private syncTimer;
    private options;
    private isWatching;
    constructor(syncManager: SyncManagerService, options?: WatcherOptions);
    /**
     * Start watching a project directory
     */
    startWatching(projectPath: string): Promise<void>;
    /**
     * Stop watching all directories
     */
    stopWatching(): Promise<void>;
    /**
     * Handle individual file change events
     */
    private handleFileChange;
    /**
     * Check if a file should be watched based on include/exclude patterns
     */
    private shouldWatchFile;
    /**
     * Map file system event types to our change types
     */
    private mapEventType;
    /**
     * Reset the debounce timer
     */
    private resetDebounceTimer;
    /**
     * Process all pending changes after debounce period
     */
    private processPendingChanges;
    /**
     * Schedule automatic sync after file changes
     */
    private scheduleAutoSync;
    /**
     * Get current watcher status
     */
    getStatus(): {
        isWatching: boolean;
        watchedPaths: string[];
        pendingChanges: number;
        options: WatcherOptions;
    };
    /**
     * Update watcher options
     */
    updateOptions(newOptions: Partial<WatcherOptions>): void;
    /**
     * Force process any pending changes immediately
     */
    flushPendingChanges(): void;
}
export default FileWatcherService;
//# sourceMappingURL=file-watcher-service.d.ts.map