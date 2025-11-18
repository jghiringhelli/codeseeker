"use strict";
/**
 * Improved Change Detection for Deduplication
 * Uses Redis hash keys efficiently with file paths as keys and content hashes as values
 * Hash comparison is the definitive check for file changes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImprovedChangeDetector = void 0;
const database_config_1 = require("../../../config/database-config");
const logger_1 = require("../../../utils/logger");
class ImprovedChangeDetector {
    logger = logger_1.Logger.getInstance();
    dbConnections;
    constructor(dbConnections) {
        this.dbConnections = dbConnections || new database_config_1.DatabaseConnections();
    }
    /**
     * Detect changed files using Redis hash structure
     * More efficient than storing JSON blobs
     */
    async detectChanges(projectId) {
        const redisClient = await this.dbConnections.getRedisConnection();
        const pgClient = await this.dbConnections.getPostgresConnection();
        // Redis hash key for this project's file tracking
        const projectHashKey = `dedup:${projectId}:files`;
        // Get current files from database
        const currentFilesResult = await pgClient.query(`
      SELECT DISTINCT
        file_path,
        content_hash,
        updated_at,
        LENGTH(content_text) as size
      FROM semantic_search_embeddings
      WHERE project_id = $1
      ORDER BY file_path
    `, [projectId]);
        const added = [];
        const modified = [];
        const deleted = [];
        let unchanged = 0;
        // Process current files
        const currentFileMap = new Map();
        for (const row of currentFilesResult.rows) {
            const fileInfo = {
                path: row.file_path,
                contentHash: row.content_hash,
                lastModified: new Date(row.updated_at),
                size: row.size
            };
            currentFileMap.set(row.file_path, fileInfo);
            // Check if file exists in Redis cache
            const cachedHash = await redisClient.hget(projectHashKey, row.file_path);
            if (!cachedHash) {
                // New file
                added.push(fileInfo);
            }
            else if (cachedHash !== row.content_hash) {
                // Modified file - hash comparison is definitive
                modified.push(fileInfo);
            }
            else {
                // Same hash = unchanged file, regardless of timestamp
                unchanged++;
            }
        }
        // Check for deleted files
        const allCachedFiles = await redisClient.hkeys(projectHashKey);
        for (const cachedPath of allCachedFiles) {
            if (!currentFileMap.has(cachedPath)) {
                const cachedHash = await redisClient.hget(projectHashKey, cachedPath);
                if (cachedHash) {
                    deleted.push({
                        path: cachedPath,
                        contentHash: cachedHash,
                        lastModified: new Date(), // We don't track timestamps anymore
                        size: undefined
                    });
                }
            }
        }
        // Update Redis cache with current state
        await this.updateCache(projectId, currentFileMap);
        // Log summary
        this.logger.info(`Change detection complete for ${projectId}:`, {
            added: added.length,
            modified: modified.length,
            deleted: deleted.length,
            unchanged
        });
        return { added, modified, deleted, unchanged };
    }
    /**
     * Update Redis cache with current file states
     * Uses Redis hash for efficient storage and retrieval
     */
    async updateCache(projectId, fileMap) {
        const redisClient = await this.dbConnections.getRedisConnection();
        const projectHashKey = `dedup:${projectId}:files`;
        // Use pipeline for efficient batch updates
        const pipeline = redisClient.pipeline();
        // Clear old hash and set new values
        pipeline.del(projectHashKey);
        for (const [path, info] of fileMap) {
            // Store only the hash - it's the definitive change indicator
            pipeline.hset(projectHashKey, path, info.contentHash);
        }
        // Set expiry (7 days)
        pipeline.expire(projectHashKey, 7 * 24 * 60 * 60);
        // Update last scan timestamp
        const timestampKey = `dedup:${projectId}:last_scan`;
        pipeline.set(timestampKey, new Date().toISOString(), 'EX', 7 * 24 * 60 * 60);
        await pipeline.exec();
    }
    /**
     * Get file change statistics
     */
    async getChangeStats(projectId) {
        const redisClient = await this.dbConnections.getRedisConnection();
        const projectHashKey = `dedup:${projectId}:files`;
        const timestampKey = `dedup:${projectId}:last_scan`;
        const [totalFiles, lastScanStr, cacheInfo] = await Promise.all([
            redisClient.hlen(projectHashKey),
            redisClient.get(timestampKey),
            redisClient.memory('USAGE', projectHashKey)
        ]);
        return {
            totalFiles,
            lastScan: lastScanStr ? new Date(lastScanStr) : null,
            cacheSize: cacheInfo || 0
        };
    }
    /**
     * Clear cache for a project
     */
    async clearCache(projectId) {
        const redisClient = await this.dbConnections.getRedisConnection();
        const keysToDelete = [
            `dedup:${projectId}:files`,
            `dedup:${projectId}:last_scan`,
            `dedup:${projectId}:results`
        ];
        await redisClient.del(...keysToDelete);
        this.logger.info(`Cleared dedup cache for project: ${projectId}`);
    }
    /**
     * Check if a specific file has changed
     */
    async hasFileChanged(projectId, filePath, currentHash) {
        const redisClient = await this.dbConnections.getRedisConnection();
        const projectHashKey = `dedup:${projectId}:files`;
        const cachedHash = await redisClient.hget(projectHashKey, filePath);
        if (!cachedHash) {
            return true; // New file
        }
        // Hash comparison is the only definitive check
        return cachedHash !== currentHash;
    }
    /**
     * Batch check multiple files for changes
     */
    async checkMultipleFiles(projectId, files) {
        const redisClient = await this.dbConnections.getRedisConnection();
        const projectHashKey = `dedup:${projectId}:files`;
        const results = new Map();
        // Use pipeline for efficiency
        const pipeline = redisClient.pipeline();
        for (const file of files) {
            pipeline.hget(projectHashKey, file.path);
        }
        const cachedValues = await pipeline.exec();
        files.forEach((file, index) => {
            const [error, cachedHash] = cachedValues[index];
            if (error || !cachedHash) {
                results.set(file.path, true); // New or error = changed
            }
            else {
                // Direct hash comparison
                results.set(file.path, cachedHash !== file.hash);
            }
        });
        return results;
    }
}
exports.ImprovedChangeDetector = ImprovedChangeDetector;
//# sourceMappingURL=improved-change-detector.js.map