"use strict";
/**
 * Semantic Enhancement Engine
 * Powers CLI cycle with semantic search and relationship traversal
 * Now a thin wrapper around the unified SemanticSearchManager
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticEnhancementEngine = void 0;
const logger_1 = require("../utils/logger");
const semantic_search_manager_1 = __importDefault(require("./semantic-search-manager"));
/**
 * Legacy wrapper for SemanticSearchManager
 * Maintains backward compatibility while delegating to unified manager
 */
class SemanticEnhancementEngine {
    logger = logger_1.Logger.getInstance();
    semanticSearchManager;
    constructor() {
        this.semanticSearchManager = new semantic_search_manager_1.default();
    }
    /**
     * Main enhancement workflow using unified semantic search manager
     */
    async enhanceQuery(query, maxPrimaryFiles = 8, maxRelatedFiles = 15, maxContextSize = 100000, projectId) {
        const startTime = Date.now();
        this.logger.info(`🔍 Enhancing query with unified semantic search: "${query}"`);
        try {
            // Use unified semantic search manager
            const searchQuery = {
                text: query,
                projectId,
                maxResults: maxPrimaryFiles + maxRelatedFiles,
                minSimilarity: 0.3,
                includeChunks: true
            };
            const searchResponse = await this.semanticSearchManager.search(searchQuery);
            // Convert to legacy format for compatibility
            const context = this.convertToLegacyFormat(searchResponse, maxContextSize);
            const duration = Date.now() - startTime;
            this.logger.info(`✅ Context enhancement complete (${duration}ms): ${context.totalFiles} files, ${context.contextSize} chars`);
            return context;
        }
        catch (error) {
            this.logger.error('❌ Semantic enhancement failed:', error);
            throw error;
        }
    }
    /**
     * Update context after Claude's processing
     */
    async updateContextAfterProcessing(modifiedFiles, context, projectId) {
        this.logger.info(`📝 Updating context after processing ${modifiedFiles.length} modified files`);
        if (projectId) {
            // Delegate to unified semantic search manager
            await this.semanticSearchManager.updateFiles(projectId, modifiedFiles);
        }
        else {
            this.logger.warn('No project ID provided, skipping semantic search updates');
        }
    }
    /**
     * Initialize semantic search for a project
     */
    async initializeProjectSemanticSearch(projectId, files, progressCallback) {
        return await this.semanticSearchManager.initializeProject(projectId, files, progressCallback);
    }
    /**
     * Get semantic search statistics
     */
    async getSemanticSearchStats(projectId) {
        return await this.semanticSearchManager.getIndexStats(projectId);
    }
    /**
     * Convert search response to legacy format for compatibility
     */
    convertToLegacyFormat(searchResponse, maxContextSize) {
        let totalSize = 0;
        const primaryFiles = [];
        const relatedFiles = [];
        // Convert search results to legacy format
        for (const result of searchResponse.results) {
            if (totalSize + result.chunk.content.length > maxContextSize) {
                break;
            }
            const legacyFile = {
                filePath: result.chunk.filePath,
                relevanceScore: result.relevanceScore,
                content: result.chunk.content,
                lastModified: Date.now(),
                hash: result.chunk.hash,
                matchReason: result.matchReason
            };
            primaryFiles.push(legacyFile);
            totalSize += result.chunk.content.length;
        }
        return {
            query: searchResponse.query,
            primaryFiles,
            relatedFiles, // Empty for now - could be populated from Neo4j in future
            totalFiles: primaryFiles.length,
            contextSize: totalSize,
            cacheHitRate: searchResponse.usedFallback ? 0.5 : 1.0,
            generatedAt: Date.now()
        };
    }
}
exports.SemanticEnhancementEngine = SemanticEnhancementEngine;
exports.default = SemanticEnhancementEngine;
//# sourceMappingURL=semantic-enhancement-engine.js.map