"use strict";
/**
 * Refactored Semantic Search Manager - SOLID Principles Compliant
 * Uses dependency injection and delegates to focused services
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
exports.SemanticSearchManagerRefactored = void 0;
const fs = __importStar(require("fs/promises"));
const logger_1 = require("../../utils/logger");
class SemanticSearchManagerRefactored {
    contentChunker;
    embeddingGenerator;
    indexStorage;
    queryProcessor;
    logger = logger_1.Logger.getInstance();
    constructor(contentChunker, embeddingGenerator, indexStorage, queryProcessor) {
        this.contentChunker = contentChunker;
        this.embeddingGenerator = embeddingGenerator;
        this.indexStorage = indexStorage;
        this.queryProcessor = queryProcessor;
    }
    /**
     * Initialize project for semantic search
     */
    async initializeProject(projectId, projectPath) {
        this.logger.info(`🔍 Initializing semantic search for project: ${projectId}`);
        try {
            // Scan all relevant files in the project
            const filePaths = await this.scanProjectFiles(projectPath);
            // Process files in batches to avoid memory issues
            const batchSize = 50;
            for (let i = 0; i < filePaths.length; i += batchSize) {
                const batch = filePaths.slice(i, i + batchSize);
                await this.processBatch(projectId, batch);
            }
            this.logger.info(`✅ Semantic search initialization complete: ${filePaths.length} files processed`);
        }
        catch (error) {
            this.logger.error(`❌ Semantic search initialization failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Update specific files in the search index
     */
    async updateFiles(projectId, filePaths) {
        this.logger.info(`🔄 Updating ${filePaths.length} files in search index`);
        try {
            await this.processBatch(projectId, filePaths);
            this.logger.info(`✅ File updates complete`);
        }
        catch (error) {
            this.logger.error(`❌ File update failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Remove files from the search index
     */
    async removeFiles(projectId, filePaths) {
        this.logger.info(`🗑️ Removing ${filePaths.length} files from search index`);
        try {
            await this.indexStorage.removeChunks(projectId, filePaths);
            this.logger.info(`✅ File removal complete`);
        }
        catch (error) {
            this.logger.error(`❌ File removal failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Perform semantic search
     */
    async search(query) {
        this.logger.info(`🔍 Performing semantic search: "${query.text}"`);
        try {
            const response = await this.queryProcessor.processQuery(query);
            this.logger.info(`✅ Search complete: ${response.totalResults} results in ${response.processingTime}ms`);
            return response;
        }
        catch (error) {
            this.logger.error(`❌ Search failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Get search index statistics
     */
    async getIndexStats(projectId) {
        return await this.indexStorage.getIndexStats(projectId);
    }
    // Private helper methods
    async processBatch(projectId, filePaths) {
        const allChunks = [];
        const allEmbeddings = [];
        for (const filePath of filePaths) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const fileHash = this.calculateFileHash(content);
                // Use injected chunker service
                const chunks = await this.contentChunker.createSemanticChunks(filePath, content, fileHash);
                // Use injected embedding generator
                const embeddings = await this.embeddingGenerator.generateEmbeddings(chunks);
                allChunks.push(...chunks);
                allEmbeddings.push(...embeddings);
            }
            catch (error) {
                this.logger.warn(`⚠️ Failed to process file ${filePath}: ${error.message}`);
            }
        }
        if (allChunks.length > 0) {
            // Use injected storage service
            await this.indexStorage.storeChunks(projectId, allChunks, allEmbeddings);
        }
    }
    async scanProjectFiles(projectPath) {
        const files = [];
        const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.rs', '.go', '.cpp', '.c', '.cs'];
        const scanDirectory = async (dirPath) => {
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = `${dirPath}/${entry.name}`;
                    if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                        await scanDirectory(fullPath);
                    }
                    else if (entry.isFile() && this.shouldIncludeFile(entry.name, supportedExtensions)) {
                        files.push(fullPath);
                    }
                }
            }
            catch (error) {
                this.logger.warn(`⚠️ Failed to scan directory ${dirPath}: ${error.message}`);
            }
        };
        await scanDirectory(projectPath);
        return files;
    }
    shouldSkipDirectory(dirName) {
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.venv', 'venv', 'coverage'];
        return skipDirs.includes(dirName) || dirName.startsWith('.');
    }
    shouldIncludeFile(fileName, supportedExtensions) {
        const ext = '.' + fileName.split('.').pop();
        return supportedExtensions.includes(ext) && !fileName.includes('.test.') && !fileName.includes('.spec.');
    }
    calculateFileHash(content) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(content).digest('hex');
    }
}
exports.SemanticSearchManagerRefactored = SemanticSearchManagerRefactored;
//# sourceMappingURL=semantic-search-manager-refactored.js.map