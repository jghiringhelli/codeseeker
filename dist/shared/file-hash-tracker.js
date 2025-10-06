"use strict";
/**
 * File Hash Tracker - Redis-based file change detection
 * Tracks file hashes to enable intelligent sync decisions
 * Supports project-level and session-level tracking
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileHashTracker = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const ioredis_1 = __importDefault(require("ioredis"));
class FileHashTracker {
    redis;
    initialized = false;
    constructor(redisConnection) {
        this.redis = redisConnection || new ioredis_1.default({
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
        // Add error handler to prevent unhandled errors
        this.redis.on('error', (err) => {
            console.warn('Redis connection error in FileHashTracker:', err.message);
        });
    }
    /**
     * Initialize Redis connection and ensure ready state
     */
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.redis.ping();
            this.initialized = true;
        }
        catch (error) {
            console.warn('FileHashTracker: Redis not available, operating without hash tracking');
            this.initialized = false;
        }
    }
    /**
     * Get Redis key for file hash storage
     */
    getFileHashKey(projectId) {
        return `codemind:file_hashes:${projectId}`;
    }
    /**
     * Get Redis key for sync metadata
     */
    getSyncMetaKey(projectId) {
        return `codemind:sync_meta:${projectId}`;
    }
    /**
     * Calculate file hash (SHA-256)
     */
    calculateFileHash(filePath) {
        try {
            const content = fs.readFileSync(filePath);
            return crypto.createHash('sha256').update(content).digest('hex');
        }
        catch (error) {
            // File doesn't exist or can't be read
            return '';
        }
    }
    /**
     * Get file stats safely
     */
    getFileStats(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                lastModified: stats.mtime.getTime()
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Store file hash information in Redis
     */
    async storeFileHash(projectId, filePath, syncComponents = {}) {
        await this.initialize();
        const hash = this.calculateFileHash(filePath);
        const stats = this.getFileStats(filePath);
        if (!stats) {
            // File doesn't exist, remove from tracking
            await this.removeFileHash(projectId, filePath);
            return;
        }
        const fileInfo = {
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
    async getFileHash(projectId, filePath) {
        await this.initialize();
        const key = this.getFileHashKey(projectId);
        const data = await this.redis.hget(key, filePath);
        return data ? JSON.parse(data) : null;
    }
    /**
     * Remove file hash from tracking
     */
    async removeFileHash(projectId, filePath) {
        await this.initialize();
        const key = this.getFileHashKey(projectId);
        await this.redis.hdel(key, filePath);
    }
    /**
     * Get all tracked files for a project
     */
    async getTrackedFiles(projectId) {
        await this.initialize();
        const key = this.getFileHashKey(projectId);
        const data = await this.redis.hgetall(key);
        return Object.values(data).map(json => JSON.parse(json));
    }
    /**
     * Check if file has changed since last sync
     */
    async hasFileChanged(projectId, filePath) {
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
    async analyzeSyncNeeds(projectId, projectFiles, strategy = { mode: 'incremental' }) {
        await this.initialize();
        const trackedFiles = await this.getTrackedFiles(projectId);
        const trackedFilePaths = new Set(trackedFiles.map(f => f.filePath));
        const newFiles = [];
        const modifiedFiles = [];
        const unchangedFiles = [];
        const deletedFiles = [];
        // Check for new and modified files
        for (const filePath of projectFiles) {
            if (trackedFilePaths.has(filePath)) {
                const hasChanged = await this.hasFileChanged(projectId, filePath);
                if (hasChanged) {
                    modifiedFiles.push(filePath);
                }
                else {
                    unchangedFiles.push(filePath);
                }
            }
            else {
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
        let reason = 'unchanged';
        if (strategy.forceSync) {
            shouldSync = true;
            reason = 'forced';
        }
        else if (strategy.sessionStart && changedFiles.length > 0) {
            shouldSync = true;
            reason = 'session_start';
        }
        else if (newFiles.length > 0) {
            shouldSync = true;
            reason = 'new';
        }
        else if (modifiedFiles.length > 0) {
            shouldSync = true;
            reason = 'modified';
        }
        else if (deletedFiles.length > 0) {
            shouldSync = true;
            reason = 'deleted';
        }
        else if (strategy.timeThreshold && await this.isTimeThresholdExceeded(projectId, strategy.timeThreshold)) {
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
    async isTimeThresholdExceeded(projectId, thresholdHours) {
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
    async updateSyncMetadata(projectId, metadata) {
        await this.initialize();
        const metaKey = this.getSyncMetaKey(projectId);
        const updates = {};
        if (metadata.lastSyncTime)
            updates.lastSyncTime = metadata.lastSyncTime.toString();
        if (metadata.syncStrategy)
            updates.syncStrategy = metadata.syncStrategy;
        if (metadata.filesProcessed)
            updates.filesProcessed = metadata.filesProcessed.toString();
        if (metadata.syncDuration)
            updates.syncDuration = metadata.syncDuration.toString();
        if (Object.keys(updates).length > 0) {
            await this.redis.hmset(metaKey, updates);
        }
    }
    /**
     * Get sync metadata
     */
    async getSyncMetadata(projectId) {
        await this.initialize();
        const metaKey = this.getSyncMetaKey(projectId);
        return await this.redis.hgetall(metaKey);
    }
    /**
     * Mark file as synced with specific components
     */
    async markFileSynced(projectId, filePath, components) {
        const existing = await this.getFileHash(projectId, filePath);
        if (existing) {
            // Update existing entry
            existing.syncedAt = Date.now();
            existing.embedding = components.embedding ?? existing.embedding;
            existing.graph = components.graph ?? existing.graph;
            existing.analysis = components.analysis ?? existing.analysis;
            const key = this.getFileHashKey(projectId);
            await this.redis.hset(key, filePath, JSON.stringify(existing));
        }
        else {
            // Store new entry
            await this.storeFileHash(projectId, filePath, components);
        }
    }
    /**
     * Get files that need specific component updates
     */
    async getFilesNeedingComponent(projectId, component) {
        const trackedFiles = await this.getTrackedFiles(projectId);
        return trackedFiles
            .filter(file => !file[component])
            .map(file => file.filePath);
    }
    /**
     * Clear all tracking data for a project
     */
    async clearProject(projectId) {
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
    async getSyncStats(projectId) {
        const trackedFiles = await this.getTrackedFiles(projectId);
        const metadata = await this.getSyncMetadata(projectId);
        const componentStats = trackedFiles.reduce((stats, file) => {
            if (file.embedding)
                stats.withEmbeddings++;
            if (file.graph)
                stats.withGraph++;
            if (file.analysis)
                stats.withAnalysis++;
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
    async cleanup() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}
exports.FileHashTracker = FileHashTracker;
exports.default = FileHashTracker;
//# sourceMappingURL=file-hash-tracker.js.map