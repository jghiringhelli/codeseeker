/**
 * File Hash Tracker - Redis-based file change detection
 * Tracks file hashes to enable intelligent sync decisions
 * Supports project-level and session-level tracking
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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
  timeThreshold?: number; // Hours since last sync
  forceSync?: boolean;
  sessionStart?: boolean;
  includeEmbeddings?: boolean;
  includeGraph?: boolean;
  includeAnalysis?: boolean;
}

export class FileHashTracker {
  private redis: Redis;
  private initialized = false;

  constructor(redisConnection?: Redis) {
    this.redis = redisConnection || new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      reconnectOnError: (err) => {
        // Don't reconnect on ECONNREFUSED
        if (err.message.includes('ECONNREFUSED')) {
          return false;
        }
        return true;
      }
    });

    // Add silent error handler to prevent unhandled errors flooding console
    this.redis.on('error', () => {
      // Silent - Redis errors are expected when database is unavailable
    });
  }

  /**
   * Initialize Redis connection and ensure ready state
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.redis.ping();
      this.initialized = true;
    } catch (error: any) {
      console.warn('FileHashTracker: Redis not available, operating without hash tracking');
      this.initialized = false;
    }
  }

  /**
   * Get Redis key for file hash storage
   */
  private getFileHashKey(projectId: string): string {
    return `codeseeker:file_hashes:${projectId}`;
  }

  /**
   * Get Redis key for sync metadata
   */
  private getSyncMetaKey(projectId: string): string {
    return `codeseeker:sync_meta:${projectId}`;
  }

  /**
   * Calculate file hash (SHA-256)
   */
  private calculateFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      // File doesn't exist or can't be read
      return '';
    }
  }

  /**
   * Get file stats safely
   */
  private getFileStats(filePath: string): { size: number; lastModified: number } | null {
    try {
      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        lastModified: stats.mtime.getTime()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Store file hash information in Redis
   */
  async storeFileHash(projectId: string, filePath: string, syncComponents: {
    embedding?: boolean;
    graph?: boolean;
    analysis?: boolean;
  } = {}): Promise<void> {
    await this.initialize();

    const hash = this.calculateFileHash(filePath);
    const stats = this.getFileStats(filePath);

    if (!stats) {
      // File doesn't exist, remove from tracking
      await this.removeFileHash(projectId, filePath);
      return;
    }

    const fileInfo: FileHashInfo = {
      filePath,
      hash,
      lastModified: stats.lastModified,
      size: stats.size,
      syncedAt: Date.now(),
      embedding: syncComponents.embedding || false,
      graph: syncComponents.graph || false,
      analysis: syncComponents.analysis || false
    };

    const key = this.getFileHashKey(projectId);
    await this.redis.hset(key, filePath, JSON.stringify(fileInfo));
  }

  /**
   * Get stored file hash information
   */
  async getFileHash(projectId: string, filePath: string): Promise<FileHashInfo | null> {
    await this.initialize();

    const key = this.getFileHashKey(projectId);
    const data = await this.redis.hget(key, filePath);

    return data ? JSON.parse(data) : null;
  }

  /**
   * Remove file hash from tracking
   */
  async removeFileHash(projectId: string, filePath: string): Promise<void> {
    await this.initialize();

    const key = this.getFileHashKey(projectId);
    await this.redis.hdel(key, filePath);
  }

  /**
   * Get all tracked files for a project
   */
  async getTrackedFiles(projectId: string): Promise<FileHashInfo[]> {
    await this.initialize();

    const key = this.getFileHashKey(projectId);
    const data = await this.redis.hgetall(key);

    return Object.values(data).map(json => JSON.parse(json));
  }

  /**
   * Check if file has changed since last sync
   */
  async hasFileChanged(projectId: string, filePath: string): Promise<boolean> {
    const stored = await this.getFileHash(projectId, filePath);

    if (!stored) {
      // New file
      return true;
    }

    const currentHash = this.calculateFileHash(filePath);
    const currentStats = this.getFileStats(filePath);

    if (!currentStats) {
      // File was deleted
      return true;
    }

    // Check hash and modification time
    return stored.hash !== currentHash || stored.lastModified !== currentStats.lastModified;
  }

  /**
   * Analyze project files and provide sync recommendation
   */
  async analyzeSyncNeeds(
    projectId: string,
    projectFiles: string[],
    strategy: SyncStrategy = { mode: 'incremental' }
  ): Promise<SyncRecommendation> {
    await this.initialize();

    const trackedFiles = await this.getTrackedFiles(projectId);
    const trackedFilePaths = new Set(trackedFiles.map(f => f.filePath));

    const newFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const unchangedFiles: string[] = [];
    const deletedFiles: string[] = [];

    // Check for new and modified files
    for (const filePath of projectFiles) {
      if (trackedFilePaths.has(filePath)) {
        const hasChanged = await this.hasFileChanged(projectId, filePath);
        if (hasChanged) {
          modifiedFiles.push(filePath);
        } else {
          unchangedFiles.push(filePath);
        }
      } else {
        newFiles.push(filePath);
      }
    }

    // Check for deleted files
    for (const tracked of trackedFiles) {
      if (!projectFiles.includes(tracked.filePath)) {
        deletedFiles.push(tracked.filePath);
        await this.removeFileHash(projectId, tracked.filePath);
      }
    }

    const changedFiles = [...newFiles, ...modifiedFiles];
    const stats = {
      totalFiles: projectFiles.length,
      unchangedFiles: unchangedFiles.length,
      changedFiles: changedFiles.length,
      newFiles: newFiles.length,
      deletedFiles: deletedFiles.length
    };

    // Determine sync recommendation
    let shouldSync = false;
    let reason: SyncRecommendation['reason'] = 'unchanged';

    if (strategy.forceSync) {
      shouldSync = true;
      reason = 'forced';
    } else if (strategy.sessionStart && changedFiles.length > 0) {
      shouldSync = true;
      reason = 'session_start';
    } else if (newFiles.length > 0) {
      shouldSync = true;
      reason = 'new';
    } else if (modifiedFiles.length > 0) {
      shouldSync = true;
      reason = 'modified';
    } else if (deletedFiles.length > 0) {
      shouldSync = true;
      reason = 'deleted';
    } else if (strategy.timeThreshold && await this.isTimeThresholdExceeded(projectId, strategy.timeThreshold)) {
      shouldSync = true;
      reason = 'time_threshold';
    }

    return {
      shouldSync,
      reason,
      changedFiles,
      newFiles,
      deletedFiles,
      modifiedFiles,
      stats
    };
  }

  /**
   * Check if time threshold for sync has been exceeded
   */
  async isTimeThresholdExceeded(projectId: string, thresholdHours: number): Promise<boolean> {
    const metaKey = this.getSyncMetaKey(projectId);
    const lastSyncTime = await this.redis.hget(metaKey, 'lastSyncTime');

    if (!lastSyncTime) {
      return true; // Never synced
    }

    const lastSync = parseInt(lastSyncTime);
    const thresholdMs = thresholdHours * 60 * 60 * 1000;

    return (Date.now() - lastSync) > thresholdMs;
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(projectId: string, metadata: {
    lastSyncTime?: number;
    syncStrategy?: string;
    filesProcessed?: number;
    syncDuration?: number;
  }): Promise<void> {
    await this.initialize();

    const metaKey = this.getSyncMetaKey(projectId);
    const updates: Record<string, string> = {};

    if (metadata.lastSyncTime) updates.lastSyncTime = metadata.lastSyncTime.toString();
    if (metadata.syncStrategy) updates.syncStrategy = metadata.syncStrategy;
    if (metadata.filesProcessed) updates.filesProcessed = metadata.filesProcessed.toString();
    if (metadata.syncDuration) updates.syncDuration = metadata.syncDuration.toString();

    if (Object.keys(updates).length > 0) {
      await this.redis.hmset(metaKey, updates);
    }
  }

  /**
   * Get sync metadata
   */
  async getSyncMetadata(projectId: string): Promise<Record<string, string>> {
    await this.initialize();

    const metaKey = this.getSyncMetaKey(projectId);
    return await this.redis.hgetall(metaKey);
  }

  /**
   * Mark file as synced with specific components
   */
  async markFileSynced(projectId: string, filePath: string, components: {
    embedding?: boolean;
    graph?: boolean;
    analysis?: boolean;
  }): Promise<void> {
    const existing = await this.getFileHash(projectId, filePath);

    if (existing) {
      // Update existing entry
      existing.syncedAt = Date.now();
      existing.embedding = components.embedding ?? existing.embedding;
      existing.graph = components.graph ?? existing.graph;
      existing.analysis = components.analysis ?? existing.analysis;

      const key = this.getFileHashKey(projectId);
      await this.redis.hset(key, filePath, JSON.stringify(existing));
    } else {
      // Store new entry
      await this.storeFileHash(projectId, filePath, components);
    }
  }

  /**
   * Get files that need specific component updates
   */
  async getFilesNeedingComponent(projectId: string, component: 'embedding' | 'graph' | 'analysis'): Promise<string[]> {
    const trackedFiles = await this.getTrackedFiles(projectId);

    return trackedFiles
      .filter(file => !file[component])
      .map(file => file.filePath);
  }

  /**
   * Clear all tracking data for a project
   */
  async clearProject(projectId: string): Promise<void> {
    await this.initialize();

    const fileHashKey = this.getFileHashKey(projectId);
    const metaKey = this.getSyncMetaKey(projectId);

    await Promise.all([
      this.redis.del(fileHashKey),
      this.redis.del(metaKey)
    ]);
  }

  /**
   * Get sync statistics for dashboard
   */
  async getSyncStats(projectId: string): Promise<{
    totalTrackedFiles: number;
    lastSyncTime: number | null;
    syncStrategy: string | null;
    componentStats: {
      withEmbeddings: number;
      withGraph: number;
      withAnalysis: number;
    };
  }> {
    const trackedFiles = await this.getTrackedFiles(projectId);
    const metadata = await this.getSyncMetadata(projectId);

    const componentStats = trackedFiles.reduce((stats, file) => {
      if (file.embedding) stats.withEmbeddings++;
      if (file.graph) stats.withGraph++;
      if (file.analysis) stats.withAnalysis++;
      return stats;
    }, { withEmbeddings: 0, withGraph: 0, withAnalysis: 0 });

    return {
      totalTrackedFiles: trackedFiles.length,
      lastSyncTime: metadata.lastSyncTime ? parseInt(metadata.lastSyncTime) : null,
      syncStrategy: metadata.syncStrategy || null,
      componentStats
    };
  }

  /**
   * Cleanup - close Redis connection
   */
  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export default FileHashTracker;