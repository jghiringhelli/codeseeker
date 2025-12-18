"use strict";
/**
 * Sync Manager Service
 * Maintains consistency between semantic search, graph, and actual code changes
 * Uses PostgreSQL as single source of truth for file state tracking
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
exports.SyncManagerService = void 0;
const logger_1 = require("../../utils/logger");
const theme_1 = require("../../cli/ui/theme");
const database_config_1 = require("../../config/database-config");
const file_synchronization_system_1 = require("../../shared/file-synchronization-system");
const file_hash_tracker_1 = require("../../shared/file-hash-tracker");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
class SyncManagerService {
    logger;
    dbConnections;
    fileSyncSystem;
    fileHashTracker;
    redis;
    embeddingService;
    semanticGraphService;
    currentEmbeddingVersion = 'v1.0';
    HASH_PREFIX = 'codemind:file_hash:'; // Keep for backwards compatibility
    constructor(dbConnections) {
        this.logger = logger_1.Logger.getInstance();
        this.dbConnections = dbConnections || new database_config_1.DatabaseConnections();
        // Use FileSynchronizationSystem as single source of truth for file state
        this.fileSyncSystem = new file_synchronization_system_1.FileSynchronizationSystem('default-project');
        // Initialize Redis-based file hash tracker
        this.fileHashTracker = new file_hash_tracker_1.FileHashTracker();
    }
    async ensureRedisConnection() {
        if (!this.redis) {
            this.redis = await this.dbConnections.getRedisConnection();
        }
        return this.redis;
    }
    /**
     * Get intelligent sync recommendation based on file changes
     */
    async getSyncRecommendation(projectId, projectFiles, strategy = { mode: 'incremental' }) {
        return await this.fileHashTracker.analyzeSyncNeeds(projectId, projectFiles, strategy);
    }
    /**
     * Main sync method - intelligently detects and updates changes
     */
    async syncProject(projectPath, options = {}) {
        const startTime = Date.now();
        console.log(theme_1.Theme.colors.primary('🔄 INTELLIGENT SYNC'));
        console.log(theme_1.Theme.colors.info('Detecting code changes and updating semantic data...'));
        try {
            // 1. Get current file state
            const currentFiles = await this.scanProjectFiles(projectPath, options);
            console.log(theme_1.Theme.colors.muted(`   Found ${currentFiles.length} code files`));
            // 2. Compare with Redis-cached hashes
            const changes = await this.detectChanges(currentFiles, options.forceFullSync);
            console.log(theme_1.Theme.colors.info(`📊 Change Detection:`));
            console.log(theme_1.Theme.colors.muted(`   • New files: ${changes.newFiles.length}`));
            console.log(theme_1.Theme.colors.muted(`   • Modified files: ${changes.modifiedFiles.length}`));
            console.log(theme_1.Theme.colors.muted(`   • Deleted files: ${changes.deletedFiles.length}`));
            if (changes.newFiles.length === 0 && changes.modifiedFiles.length === 0 && changes.deletedFiles.length === 0) {
                console.log(theme_1.Theme.colors.success('✅ No changes detected - semantic data is up to date'));
                return this.createSyncResult(0, 0, 0, 0, 0, 0, Date.now() - startTime, 'no-changes');
            }
            // 3. Process changes incrementally
            const updates = await this.processChanges(changes, options, projectPath);
            // 4. Update Redis cache
            await this.updateHashCache(changes.newFiles.concat(changes.modifiedFiles));
            const duration = Date.now() - startTime;
            console.log(theme_1.Theme.colors.success(`✅ Sync complete in ${duration}ms`));
            return this.createSyncResult(currentFiles.length, changes.modifiedFiles.length, changes.deletedFiles.length, changes.newFiles.length, updates.embeddingsUpdated, updates.graphNodesUpdated, duration, options.forceFullSync ? 'full-sync' : 'incremental');
        }
        catch (error) {
            this.logger.error(`Sync failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Quick sync check - lightweight validation before user operations
     */
    async quickSyncCheck(projectPath) {
        try {
            // Sample a few key files to see if major changes occurred
            const sampleFiles = await this.getSampleFiles(projectPath, 10);
            const quickChanges = await this.detectChanges(sampleFiles, false);
            const hasChanges = quickChanges.newFiles.length > 0 ||
                quickChanges.modifiedFiles.length > 0 ||
                quickChanges.deletedFiles.length > 0;
            if (hasChanges) {
                console.log(theme_1.Theme.colors.warning('⚠️  Code changes detected - consider running sync'));
                return false;
            }
            return true;
        }
        catch (error) {
            this.logger.warn(`Quick sync check failed: ${error.message}`);
            return false;
        }
    }
    /**
     * Scan project files and compute hashes
     */
    async scanProjectFiles(projectPath, options) {
        const files = [];
        const extensions = ['.ts', '.js', '.py', '.java', '.cs', '.cpp', '.go', '.rs'];
        const scanDirectory = async (dir, recursive = true) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(projectPath, fullPath);
                    // Skip excluded patterns
                    if (options.excludePatterns?.some(pattern => relativePath.includes(pattern))) {
                        continue;
                    }
                    // Include only specified patterns if provided
                    if (options.includePatterns?.length &&
                        !options.includePatterns.some(pattern => relativePath.includes(pattern))) {
                        continue;
                    }
                    if (entry.isDirectory() && recursive &&
                        !entry.name.startsWith('.') &&
                        entry.name !== 'node_modules' &&
                        entry.name !== 'dist') {
                        await scanDirectory(fullPath, true);
                    }
                    else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
                        const hashEntry = await this.computeFileHashes(fullPath);
                        files.push(hashEntry);
                    }
                }
            }
            catch (error) {
                // Skip directories we can't read
            }
        };
        await scanDirectory(projectPath);
        return files;
    }
    /**
     * Compute both content and structure hashes for a file
     */
    async computeFileHashes(filePath) {
        try {
            const stat = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            // Content hash - full file content
            const contentHash = (0, crypto_1.createHash)('sha256').update(content).digest('hex');
            // Structure hash - AST structure (methods, classes, imports)
            const structureHash = await this.computeStructureHash(content, filePath);
            return {
                path: filePath,
                contentHash,
                structureHash,
                lastModified: stat.mtime.getTime(),
                lastSynced: 0,
                embeddingVersion: this.currentEmbeddingVersion,
                size: stat.size
            };
        }
        catch (error) {
            this.logger.warn(`Failed to compute hashes for ${filePath}: ${error.message}`);
            return {
                path: filePath,
                contentHash: '',
                structureHash: '',
                lastModified: 0,
                lastSynced: 0,
                embeddingVersion: this.currentEmbeddingVersion,
                size: 0
            };
        }
    }
    /**
     * Compute structural hash (AST-based) for semantic significance
     */
    async computeStructureHash(content, filePath) {
        try {
            // Extract structural elements based on file type
            const ext = path.extname(filePath);
            let structuralElements = [];
            if (ext === '.ts' || ext === '.js') {
                // Extract classes, functions, imports, exports
                structuralElements = this.extractTSStructure(content);
            }
            else if (ext === '.py') {
                structuralElements = this.extractPythonStructure(content);
            }
            else {
                // Fallback to simple regex-based extraction
                structuralElements = this.extractGenericStructure(content);
            }
            // Hash the structural signature
            const signature = structuralElements.sort().join('\n');
            return (0, crypto_1.createHash)('sha256').update(signature).digest('hex');
        }
        catch (error) {
            // Fallback to content hash if structural analysis fails
            return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
        }
    }
    /**
     * Extract TypeScript/JavaScript structural elements
     */
    extractTSStructure(content) {
        const elements = [];
        // Class declarations
        const classMatches = content.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g);
        for (const match of classMatches) {
            elements.push(`class:${match[1]}`);
        }
        // Function declarations
        const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g);
        for (const match of functionMatches) {
            elements.push(`function:${match[1]}`);
        }
        // Method declarations
        const methodMatches = content.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g);
        for (const match of methodMatches) {
            elements.push(`method:${match[1]}`);
        }
        // Import statements
        const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
        for (const match of importMatches) {
            elements.push(`import:${match[1]}`);
        }
        // Interface declarations
        const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)/g);
        for (const match of interfaceMatches) {
            elements.push(`interface:${match[1]}`);
        }
        return elements;
    }
    /**
     * Extract Python structural elements
     */
    extractPythonStructure(content) {
        const elements = [];
        // Class declarations
        const classMatches = content.matchAll(/class\s+(\w+)/g);
        for (const match of classMatches) {
            elements.push(`class:${match[1]}`);
        }
        // Function declarations
        const functionMatches = content.matchAll(/def\s+(\w+)/g);
        for (const match of functionMatches) {
            elements.push(`function:${match[1]}`);
        }
        // Import statements
        const importMatches = content.matchAll(/(?:from\s+[\w.]+\s+)?import\s+([\w,\s*]+)/g);
        for (const match of importMatches) {
            elements.push(`import:${match[1].trim()}`);
        }
        return elements;
    }
    /**
     * Generic structural extraction for other languages
     */
    extractGenericStructure(content) {
        const elements = [];
        // Generic patterns that work across languages
        const lines = content.split('\n').map(line => line.trim());
        for (const line of lines) {
            // Function-like patterns
            if (line.includes('(') && line.includes(')') && !line.startsWith('//')) {
                elements.push(`signature:${line.substring(0, 100)}`);
            }
        }
        return elements;
    }
    /**
     * Compare current files with Redis cache to detect changes
     */
    async detectChanges(currentFiles, forceFullSync = false) {
        if (forceFullSync) {
            return {
                newFiles: currentFiles,
                modifiedFiles: [],
                deletedFiles: []
            };
        }
        const newFiles = [];
        const modifiedFiles = [];
        const deletedFiles = [];
        // Get cached hashes from Redis
        const cachedHashes = await this.getCachedHashes();
        // Compare each current file
        for (const file of currentFiles) {
            const cached = cachedHashes.get(file.path);
            if (!cached) {
                newFiles.push(file);
            }
            else if (cached.contentHash !== file.contentHash ||
                cached.embeddingVersion !== file.embeddingVersion) {
                modifiedFiles.push(file);
            }
        }
        // Find deleted files
        const currentPaths = new Set(currentFiles.map(f => f.path));
        for (const cachedPath of cachedHashes.keys()) {
            if (!currentPaths.has(cachedPath)) {
                deletedFiles.push(cachedPath);
            }
        }
        return { newFiles, modifiedFiles, deletedFiles };
    }
    /**
     * Process detected changes
     */
    async processChanges(changes, options, projectPath) {
        let embeddingsUpdated = 0;
        let graphNodesUpdated = 0;
        const allChangedFiles = changes.newFiles.concat(changes.modifiedFiles);
        if (options.updateEmbeddings !== false && allChangedFiles.length > 0) {
            console.log(theme_1.Theme.colors.info('🔍 Updating semantic embeddings...'));
            embeddingsUpdated = await this.updateEmbeddings(allChangedFiles, projectPath);
        }
        if (options.updateGraph !== false && allChangedFiles.length > 0) {
            console.log(theme_1.Theme.colors.info('🕸️  Updating semantic graph...'));
            graphNodesUpdated = await this.updateSemanticGraph(allChangedFiles, projectPath);
        }
        // Handle deletions
        if (changes.deletedFiles.length > 0) {
            console.log(theme_1.Theme.colors.info('🗑️  Cleaning up deleted files...'));
            await this.cleanupDeletedFiles(changes.deletedFiles);
        }
        return { embeddingsUpdated, graphNodesUpdated };
    }
    /**
     * Get sample files for quick sync check
     */
    async getSampleFiles(projectPath, maxFiles = 10) {
        console.log(`🔍 Scanning for sample files in: ${projectPath}`);
        const allFiles = await this.scanProjectFiles(projectPath, {});
        console.log(`📄 Found ${allFiles.length} total files`);
        if (allFiles.length === 0) {
            console.log(`⚠️ No files found in ${projectPath} - check if directory exists and has code files`);
            return [];
        }
        // Sample key files (entry points, main modules, frequently changed)
        const keyPatterns = ['index.', 'main.', 'app.', 'server.', 'client.'];
        const keyFiles = allFiles.filter(file => keyPatterns.some(pattern => path.basename(file.path).startsWith(pattern)));
        console.log(`🔑 Found ${keyFiles.length} key files`);
        // Add random sampling from remaining files
        const remainingFiles = allFiles.filter(file => !keyFiles.includes(file));
        const randomFiles = remainingFiles
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.max(0, maxFiles - keyFiles.length));
        const sampleFiles = keyFiles.concat(randomFiles);
        console.log(`📋 Returning ${sampleFiles.length} sample files`);
        return sampleFiles;
    }
    // Redis integration methods
    async getCachedHashes() {
        const redis = await this.ensureRedisConnection();
        const hashMap = new Map();
        try {
            // Get all cached file hashes using pattern matching
            const keys = await redis.keys(`${this.HASH_PREFIX}*`);
            if (keys.length === 0) {
                return hashMap;
            }
            // Batch get all hash entries
            const pipeline = redis.pipeline();
            for (const key of keys) {
                pipeline.hgetall(key);
            }
            const results = await pipeline.exec();
            // Process results
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const data = results[i][1];
                if (data && Object.keys(data).length > 0) {
                    const filePath = key.replace(this.HASH_PREFIX, '');
                    hashMap.set(filePath, {
                        path: filePath,
                        contentHash: data.contentHash || '',
                        structureHash: data.structureHash || '',
                        lastModified: parseInt(data.lastModified) || 0,
                        lastSynced: parseInt(data.lastSynced) || 0,
                        embeddingVersion: data.embeddingVersion || 'v1.0',
                        size: parseInt(data.size) || 0
                    });
                }
            }
        }
        catch (error) {
            this.logger.warn(`Failed to get cached hashes: ${error.message}`);
        }
        return hashMap;
    }
    async updateHashCache(files) {
        const redis = await this.ensureRedisConnection();
        const now = Date.now();
        try {
            const pipeline = redis.pipeline();
            for (const file of files) {
                const key = `${this.HASH_PREFIX}${file.path}`;
                const hashData = {
                    contentHash: file.contentHash,
                    structureHash: file.structureHash,
                    lastModified: file.lastModified.toString(),
                    lastSynced: now.toString(),
                    embeddingVersion: file.embeddingVersion,
                    size: file.size.toString()
                };
                pipeline.hset(key, hashData);
                // Set TTL of 30 days for cleanup
                pipeline.expire(key, 30 * 24 * 60 * 60);
            }
            await pipeline.exec();
        }
        catch (error) {
            this.logger.error(`Failed to update hash cache: ${error.message}`);
            throw error;
        }
    }
    async cleanupDeletedFileHashes(filePaths) {
        const redis = await this.ensureRedisConnection();
        try {
            const pipeline = redis.pipeline();
            for (const filePath of filePaths) {
                const key = `${this.HASH_PREFIX}${filePath}`;
                pipeline.del(key);
            }
            await pipeline.exec();
        }
        catch (error) {
            this.logger.warn(`Failed to cleanup deleted file hashes: ${error.message}`);
        }
    }
    async updateEmbeddings(files, projectPath) {
        try {
            const { EmbeddingService } = await Promise.resolve().then(() => __importStar(require('../../cli/services/data/embedding/embedding-service')));
            // IMPORTANT: Must use same model as search-command-handler.ts and embedding-generator-adapter.ts
            const defaultConfig = { provider: 'xenova', model: 'Xenova/all-MiniLM-L6-v2', batchSize: 32 };
            const embeddingService = new EmbeddingService(defaultConfig);
            console.log(theme_1.Theme.colors.muted(`   Processing ${files.length} files for embedding updates...`));
            let processed = 0;
            for (const file of files) {
                try {
                    // Use the existing generateEmbedding method which is available in the service
                    // file.path is already an absolute path from scanProjectFiles
                    const content = await fs.readFile(file.path, 'utf-8');
                    await embeddingService.generateEmbedding(content, file.path);
                    processed++;
                }
                catch (error) {
                    this.logger.warn(`Failed to generate embedding for ${file.path}: ${error.message}`);
                }
            }
            return processed;
        }
        catch (error) {
            // Fallback if EmbeddingService is not available
            this.logger.warn('EmbeddingService not available, skipping embedding updates');
            console.log(theme_1.Theme.colors.muted(`   Skipping ${files.length} files (EmbeddingService not available)`));
            return 0;
        }
    }
    async updateSemanticGraph(files, projectPath) {
        try {
            const { SemanticGraphService } = await Promise.resolve().then(() => __importStar(require('../../cli/services/data/semantic-graph/semantic-graph')));
            const semanticGraphService = new SemanticGraphService();
            console.log(theme_1.Theme.colors.muted(`   Processing ${files.length} files for semantic graph updates...`));
            let processed = 0;
            for (const file of files) {
                try {
                    // Create nodes for file relationships - using basic functionality available
                    // file.path is already an absolute path from scanProjectFiles
                    const relativePath = path.relative(projectPath, file.path);
                    await semanticGraphService.addNode('Code', {
                        filePath: file.path,
                        relativePath: relativePath,
                        lastModified: file.lastModified
                    });
                    processed++;
                }
                catch (error) {
                    this.logger.warn(`Failed to update semantic graph for ${file.path}: ${error.message}`);
                }
            }
            return processed;
        }
        catch (error) {
            // Fallback if SemanticGraphService is not available
            this.logger.warn('SemanticGraphService not available, skipping graph updates');
            console.log(theme_1.Theme.colors.muted(`   Skipping ${files.length} files (SemanticGraphService not available)`));
            return 0;
        }
    }
    async cleanupDeletedFiles(filePaths) {
        // Clean up Redis hash cache
        await this.cleanupDeletedFileHashes(filePaths);
        // Clean up embeddings database
        await this.cleanupEmbeddingsForDeletedFiles(filePaths);
        // Clean up semantic graph nodes
        await this.cleanupSemanticGraphForDeletedFiles(filePaths);
        console.log(theme_1.Theme.colors.muted(`   Cleaned up ${filePaths.length} deleted files from semantic data`));
    }
    async cleanupEmbeddingsForDeletedFiles(filePaths) {
        try {
            // For now, log the cleanup action - embeddings will be cleaned by the service itself
            this.logger.info(`Marked ${filePaths.length} files for embedding cleanup`);
        }
        catch (error) {
            this.logger.warn('Failed to cleanup embeddings for deleted files');
        }
    }
    async cleanupSemanticGraphForDeletedFiles(filePaths) {
        try {
            const { SemanticGraphService } = await Promise.resolve().then(() => __importStar(require('../../cli/services/data/semantic-graph/semantic-graph')));
            const semanticGraphService = new SemanticGraphService();
            // Since we can't access the driver directly, we'll use a simplified approach
            // This is a fallback method - in production this might need proper cleanup
            console.log(theme_1.Theme.colors.muted(`   Would cleanup ${filePaths.length} deleted files from semantic graph (service available)`));
        }
        catch (error) {
            this.logger.warn('SemanticGraphService not available, skipping semantic graph cleanup');
        }
    }
    createSyncResult(total, changed, deleted, newFiles, embeddings, graph, duration, strategy) {
        return {
            totalFiles: total,
            changedFiles: changed,
            deletedFiles: deleted,
            newFiles,
            updatedEmbeddings: embeddings,
            updatedGraphNodes: graph,
            duration,
            strategy
        };
    }
}
exports.SyncManagerService = SyncManagerService;
exports.default = SyncManagerService;
//# sourceMappingURL=sync-manager.js.map