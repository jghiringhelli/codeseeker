"use strict";
/**
 * File Watcher Service
 * Real-time file system monitoring for automatic sync triggering
 * Provides intelligent debouncing and change filtering
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcherService = void 0;
const events_1 = require("events");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const logger_1 = require("../../../utils/logger");
const theme_1 = require("../../ui/theme");
class FileWatcherService extends events_1.EventEmitter {
    logger;
    syncManager;
    watchers = new Map();
    pendingChanges = new Map();
    debounceTimer = null;
    syncTimer = null;
    options;
    isWatching = false;
    constructor(syncManager, options = {}) {
        super();
        this.logger = logger_1.Logger.getInstance();
        this.syncManager = syncManager;
        this.options = {
            enabled: true,
            debounceMs: 2000, // 2 second debounce
            syncDelayMs: 5000, // 5 second delay before auto-sync
            autoSync: true,
            excludePatterns: [
                'node_modules',
                '.git',
                'dist',
                'build',
                '.DS_Store',
                '*.log',
                '*.tmp'
            ],
            includePatterns: [
                '*.ts',
                '*.js',
                '*.py',
                '*.java',
                '*.cs',
                '*.cpp',
                '*.go',
                '*.rs'
            ],
            ...options
        };
    }
    /**
     * Start watching a project directory
     */
    async startWatching(projectPath) {
        if (!this.options.enabled) {
            console.log(theme_1.Theme.colors.muted('📁 File watcher disabled'));
            return;
        }
        if (this.isWatching) {
            console.log(theme_1.Theme.colors.warning('⚠️  File watcher already running'));
            return;
        }
        try {
            console.log(theme_1.Theme.colors.info(`👁️  Starting file watcher for: ${projectPath}`));
            // Watch the main project directory
            const watcher = (0, fs_1.watch)(projectPath, {
                recursive: true,
                persistent: false
            }, (eventType, filename) => {
                if (filename) {
                    this.handleFileChange(eventType, path.join(projectPath, filename));
                }
            });
            watcher.on('error', (error) => {
                this.logger.error(`File watcher error: ${error.message}`);
                this.emit('watcherError', error);
            });
            this.watchers.set(projectPath, watcher);
            this.isWatching = true;
            console.log(theme_1.Theme.colors.success('✅ File watcher started'));
            console.log(theme_1.Theme.colors.muted(`   Debounce: ${this.options.debounceMs}ms`));
            console.log(theme_1.Theme.colors.muted(`   Auto-sync: ${this.options.autoSync ? 'enabled' : 'disabled'}`));
        }
        catch (error) {
            this.logger.error(`Failed to start file watcher: ${error.message}`);
            throw error;
        }
    }
    /**
     * Stop watching all directories
     */
    async stopWatching() {
        if (!this.isWatching) {
            return;
        }
        console.log(theme_1.Theme.colors.info('⏹️  Stopping file watcher...'));
        // Clear any pending timers
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
        }
        // Close all watchers
        for (const [path, watcher] of this.watchers) {
            try {
                watcher.close();
            }
            catch (error) {
                this.logger.warn(`Error closing watcher for ${path}: ${error.message}`);
            }
        }
        this.watchers.clear();
        this.pendingChanges.clear();
        this.isWatching = false;
        console.log(theme_1.Theme.colors.success('✅ File watcher stopped'));
    }
    /**
     * Handle individual file change events
     */
    handleFileChange(eventType, filePath) {
        // Skip if file doesn't match our criteria
        if (!this.shouldWatchFile(filePath)) {
            return;
        }
        const changeType = this.mapEventType(eventType);
        const changeEvent = {
            type: changeType,
            filePath,
            timestamp: Date.now()
        };
        // Add to pending changes (overwrites previous change for same file)
        this.pendingChanges.set(filePath, changeEvent);
        // Emit immediate event for listeners
        this.emit('fileChange', changeEvent);
        // Reset debounce timer
        this.resetDebounceTimer();
    }
    /**
     * Check if a file should be watched based on include/exclude patterns
     */
    shouldWatchFile(filePath) {
        const fileName = path.basename(filePath);
        const relativePath = path.relative(process.cwd(), filePath);
        // Check exclude patterns first
        if (this.options.excludePatterns?.some(pattern => {
            return relativePath.includes(pattern) || fileName.includes(pattern);
        })) {
            return false;
        }
        // Check include patterns
        if (this.options.includePatterns?.some(pattern => {
            if (pattern.startsWith('*.')) {
                return fileName.endsWith(pattern.substring(1));
            }
            return relativePath.includes(pattern) || fileName.includes(pattern);
        })) {
            return true;
        }
        return false;
    }
    /**
     * Map file system event types to our change types
     */
    mapEventType(eventType) {
        switch (eventType) {
            case 'rename':
                // Note: rename events are tricky - could be create or delete
                // We'll treat as modified for simplicity
                return 'modified';
            case 'change':
            default:
                return 'modified';
        }
    }
    /**
     * Reset the debounce timer
     */
    resetDebounceTimer() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.processPendingChanges();
        }, this.options.debounceMs);
    }
    /**
     * Process all pending changes after debounce period
     */
    processPendingChanges() {
        if (this.pendingChanges.size === 0) {
            return;
        }
        const changes = Array.from(this.pendingChanges.values());
        const changeCount = changes.length;
        console.log(theme_1.Theme.colors.info(`🔄 Detected ${changeCount} file change(s)`));
        changes.forEach(change => {
            console.log(theme_1.Theme.colors.muted(`   ${change.type}: ${path.relative(process.cwd(), change.filePath)}`));
        });
        // Emit batch change event
        this.emit('batchChange', changes);
        // Clear pending changes
        this.pendingChanges.clear();
        // Schedule auto-sync if enabled
        if (this.options.autoSync) {
            this.scheduleAutoSync();
        }
        else {
            console.log(theme_1.Theme.colors.warning('⚠️  Auto-sync disabled - run "/sync run" to update semantic data'));
        }
    }
    /**
     * Schedule automatic sync after file changes
     */
    scheduleAutoSync() {
        if (this.syncTimer) {
            clearTimeout(this.syncTimer);
        }
        console.log(theme_1.Theme.colors.info(`⏰ Auto-sync scheduled in ${this.options.syncDelayMs / 1000}s...`));
        this.syncTimer = setTimeout(async () => {
            try {
                console.log(theme_1.Theme.colors.primary('🔄 Auto-sync triggered by file changes'));
                const projectPath = process.cwd(); // Assume current working directory
                const result = await this.syncManager.syncProject(projectPath, {
                    forceFullSync: false,
                    maxConcurrency: 3 // Lower concurrency for background sync
                });
                if (result.changedFiles === 0 && result.newFiles === 0) {
                    console.log(theme_1.Theme.colors.success('✅ Auto-sync: No changes detected'));
                }
                else {
                    const duration = Math.round(result.duration / 1000 * 100) / 100;
                    console.log(theme_1.Theme.colors.success(`✅ Auto-sync completed in ${duration}s`));
                    console.log(theme_1.Theme.colors.muted(`   Updated: ${result.changedFiles + result.newFiles} files`));
                }
                this.emit('autoSyncComplete', result);
            }
            catch (error) {
                console.log(theme_1.Theme.colors.error(`❌ Auto-sync failed: ${error.message}`));
                this.emit('autoSyncError', error);
            }
            this.syncTimer = null;
        }, this.options.syncDelayMs);
    }
    /**
     * Get current watcher status
     */
    getStatus() {
        return {
            isWatching: this.isWatching,
            watchedPaths: Array.from(this.watchers.keys()),
            pendingChanges: this.pendingChanges.size,
            options: this.options
        };
    }
    /**
     * Update watcher options
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log(theme_1.Theme.colors.info('📝 File watcher options updated'));
    }
    /**
     * Force process any pending changes immediately
     */
    flushPendingChanges() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.processPendingChanges();
    }
}
exports.FileWatcherService = FileWatcherService;
exports.default = FileWatcherService;
//# sourceMappingURL=file-watcher-service.js.map