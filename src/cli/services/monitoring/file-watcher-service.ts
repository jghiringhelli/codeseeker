/**
 * File Watcher Service
 * Real-time file system monitoring for automatic sync triggering
 * Provides intelligent debouncing and change filtering
 */

import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'fs';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { Theme } from '../../ui/theme';
import { SyncManagerService } from '../../../services/managers/sync-manager';

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

export class FileWatcherService extends EventEmitter {
  private logger: Logger;
  private syncManager: SyncManagerService;
  private watchers: Map<string, FSWatcher> = new Map();
  private pendingChanges: Map<string, FileChangeEvent> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private options: WatcherOptions;
  private isWatching: boolean = false;

  constructor(syncManager: SyncManagerService, options: WatcherOptions = {}) {
    super();
    this.logger = Logger.getInstance();
    this.syncManager = syncManager;
    this.options = {
      enabled: true,
      debounceMs: 2000,        // 2 second debounce
      syncDelayMs: 5000,       // 5 second delay before auto-sync
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
  async startWatching(projectPath: string): Promise<void> {
    if (!this.options.enabled) {
      console.log(Theme.colors.muted('📁 File watcher disabled'));
      return;
    }

    if (this.isWatching) {
      console.log(Theme.colors.warning('⚠️  File watcher already running'));
      return;
    }

    try {
      console.log(Theme.colors.info(`👁️  Starting file watcher for: ${projectPath}`));

      // Watch the main project directory
      const watcher = watch(projectPath, {
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

      console.log(Theme.colors.success('✅ File watcher started'));
      console.log(Theme.colors.muted(`   Debounce: ${this.options.debounceMs}ms`));
      console.log(Theme.colors.muted(`   Auto-sync: ${this.options.autoSync ? 'enabled' : 'disabled'}`));

    } catch (error) {
      this.logger.error(`Failed to start file watcher: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop watching all directories
   */
  async stopWatching(): Promise<void> {
    if (!this.isWatching) {
      return;
    }

    console.log(Theme.colors.info('⏹️  Stopping file watcher...'));

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
      } catch (error) {
        this.logger.warn(`Error closing watcher for ${path}: ${error.message}`);
      }
    }

    this.watchers.clear();
    this.pendingChanges.clear();
    this.isWatching = false;

    console.log(Theme.colors.success('✅ File watcher stopped'));
  }

  /**
   * Handle individual file change events
   */
  private handleFileChange(eventType: string, filePath: string): void {
    // Skip if file doesn't match our criteria
    if (!this.shouldWatchFile(filePath)) {
      return;
    }

    const changeType = this.mapEventType(eventType);
    const changeEvent: FileChangeEvent = {
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
  private shouldWatchFile(filePath: string): boolean {
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
  private mapEventType(eventType: string): 'created' | 'modified' | 'deleted' {
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
  private resetDebounceTimer(): void {
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
  private processPendingChanges(): void {
    if (this.pendingChanges.size === 0) {
      return;
    }

    const changes = Array.from(this.pendingChanges.values());
    const changeCount = changes.length;

    console.log(Theme.colors.info(`🔄 Detected ${changeCount} file change(s)`));
    changes.forEach(change => {
      console.log(Theme.colors.muted(`   ${change.type}: ${path.relative(process.cwd(), change.filePath)}`));
    });

    // Emit batch change event
    this.emit('batchChange', changes);

    // Clear pending changes
    this.pendingChanges.clear();

    // Schedule auto-sync if enabled
    if (this.options.autoSync) {
      this.scheduleAutoSync();
    } else {
      console.log(Theme.colors.warning('⚠️  Auto-sync disabled - run "/sync run" to update semantic data'));
    }
  }

  /**
   * Schedule automatic sync after file changes
   */
  private scheduleAutoSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    console.log(Theme.colors.info(`⏰ Auto-sync scheduled in ${this.options.syncDelayMs! / 1000}s...`));

    this.syncTimer = setTimeout(async () => {
      try {
        console.log(Theme.colors.primary('🔄 Auto-sync triggered by file changes'));

        const projectPath = process.cwd(); // Assume current working directory
        const result = await this.syncManager.syncProject(projectPath, {
          forceFullSync: false,
          maxConcurrency: 3 // Lower concurrency for background sync
        });

        if (result.changedFiles === 0 && result.newFiles === 0) {
          console.log(Theme.colors.success('✅ Auto-sync: No changes detected'));
        } else {
          const duration = Math.round(result.duration / 1000 * 100) / 100;
          console.log(Theme.colors.success(`✅ Auto-sync completed in ${duration}s`));
          console.log(Theme.colors.muted(`   Updated: ${result.changedFiles + result.newFiles} files`));
        }

        this.emit('autoSyncComplete', result);

      } catch (error) {
        console.log(Theme.colors.error(`❌ Auto-sync failed: ${error.message}`));
        this.emit('autoSyncError', error);
      }

      this.syncTimer = null;
    }, this.options.syncDelayMs);
  }

  /**
   * Get current watcher status
   */
  getStatus(): {
    isWatching: boolean;
    watchedPaths: string[];
    pendingChanges: number;
    options: WatcherOptions;
  } {
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
  updateOptions(newOptions: Partial<WatcherOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log(Theme.colors.info('📝 File watcher options updated'));
  }

  /**
   * Force process any pending changes immediately
   */
  flushPendingChanges(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.processPendingChanges();
  }
}

export default FileWatcherService;