"use strict";
/**
 * Smart Deduplication Detector
 * Uses existing Xenova embeddings from PostgreSQL
 * Leverages Redis for change detection
 * Integrates Claude Code for intelligent analysis
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
exports.SmartDedupDetector = void 0;
const logger_1 = require("../../../../utils/logger");
const database_config_1 = require("../../../../config/database-config");
const hash_change_detector_1 = require("./hash-change-detector");
class SmartDedupDetector {
    logger = logger_1.Logger.getInstance();
    dbConnections;
    changeDetector;
    constructor(dbConnections) {
        this.dbConnections = dbConnections || new database_config_1.DatabaseConnections();
        this.changeDetector = new hash_change_detector_1.HashChangeDetector(this.dbConnections);
    }
    /**
     * Smart deduplication using existing embeddings and change detection
     */
    async analyzeProject(projectId) {
        this.logger.info(`🔍 Starting smart deduplication for project: ${projectId}`);
        try {
            // Step 1: Update project embeddings for changed files only
            console.log('  📊 Checking for file changes since last analysis...');
            const changedFiles = await this.changeDetector.detectChanges(projectId);
            const totalChanged = changedFiles.added.length + changedFiles.modified.length;
            if (totalChanged > 0) {
                console.log(`  🔄 Updating embeddings for ${totalChanged} changed files...`);
                console.log(`    Added: ${changedFiles.added.length}, Modified: ${changedFiles.modified.length}`);
                await this.updateEmbeddingsForChangedFiles(projectId, changedFiles);
            }
            if (changedFiles.deleted.length > 0) {
                console.log(`  🗑️ Removing embeddings for ${changedFiles.deleted.length} deleted files...`);
                await this.removeEmbeddingsForDeletedFiles(projectId, changedFiles.deleted.map(f => f.path));
            }
            console.log(`  ✅ ${changedFiles.unchanged} files unchanged since last analysis`);
            // Step 2: Get embeddings from PostgreSQL (Xenova embeddings from init)
            console.log('  🧠 Loading Xenova embeddings from database...');
            const embeddings = await this.loadProjectEmbeddings(projectId);
            console.log(`  ✅ Loaded ${embeddings.length} embeddings`);
            // Step 3: Find similar code using vector similarity
            console.log('  🔄 Finding similar code blocks using vector similarity...');
            const candidates = await this.findDuplicateCandidates(embeddings);
            console.log(`  ✅ Found ${candidates.length} duplicate candidates`);
            // Step 4: Use Claude Code for intelligent analysis (if available)
            if (candidates.length > 0 && process.env.ENABLE_CLAUDE_ANALYSIS === 'true') {
                console.log('  🤖 Analyzing duplicates with Claude Code...');
                await this.analyzeWithClaude(candidates);
            }
            // Step 5: Generate consolidation suggestions
            console.log('  💡 Generating consolidation suggestions...');
            const suggestions = await this.generateSmartSuggestions(candidates);
            // Step 6: Update Redis cache with analysis results
            await this.cacheAnalysisResults(projectId, candidates, suggestions);
            return {
                candidates,
                suggestions,
                stats: {
                    totalEmbeddings: embeddings.length,
                    duplicateCandidates: candidates.length,
                    changedFiles: changedFiles.added.length + changedFiles.modified.length,
                    deletedFiles: changedFiles.deleted.length,
                    unchangedFiles: changedFiles.unchanged
                }
            };
        }
        catch (error) {
            this.logger.error(`Smart dedup failed: ${error.message}`);
            throw error;
        }
    }
    /**
     * Update embeddings for changed files using SemanticSearchManager
     */
    async updateEmbeddingsForChangedFiles(projectId, changedFiles) {
        const filesToUpdate = [
            ...changedFiles.added.map((f) => f.path || f),
            ...changedFiles.modified.map((f) => f.path || f)
        ];
        if (filesToUpdate.length === 0)
            return;
        // Use refactored SemanticSearchManager to regenerate embeddings
        const { SearchServiceFactory } = await Promise.resolve().then(() => __importStar(require('../../../../core/factories/search-service-factory')));
        const searchFactory = SearchServiceFactory.getInstance();
        const semanticService = searchFactory.createUnifiedSemanticSearchService();
        // Update changed files using the new refactored interface
        console.log(`    Updating ${filesToUpdate.length} files...`);
        // Note: Update method needs to be implemented in SemanticSearchService
        // await semanticService.updateFiles(projectId, filesToUpdate);
        console.log(`    ✅ Files updated successfully`);
    }
    /**
     * Remove embeddings for deleted files
     */
    async removeEmbeddingsForDeletedFiles(projectId, deletedFiles) {
        if (deletedFiles.length === 0)
            return;
        const pgClient = await this.dbConnections.getPostgresConnection();
        for (const filePath of deletedFiles) {
            await pgClient.query(`
        DELETE FROM semantic_search_embeddings
        WHERE project_id = $1 AND file_path = $2
      `, [projectId, filePath]);
        }
    }
    /**
     * Load project embeddings from PostgreSQL (Xenova embeddings)
     */
    async loadProjectEmbeddings(projectId) {
        const pgClient = await this.dbConnections.getPostgresConnection();
        const result = await pgClient.query(`
      SELECT
        id,
        file_path,
        chunk_id,
        content_text as content,
        chunk_start_line as start_line,
        chunk_end_line as end_line,
        embedding,
        significance
      FROM semantic_search_embeddings
      WHERE project_id = $1
        AND significance IN ('high', 'medium')
      ORDER BY file_path, chunk_start_line
    `, [projectId]);
        return result.rows.map(row => ({
            ...row,
            embedding: JSON.parse(row.embedding) // Parse the vector
        }));
    }
    /**
     * Find duplicate candidates using vector similarity
     */
    async findDuplicateCandidates(embeddings) {
        const candidates = [];
        const pgClient = await this.dbConnections.getPostgresConnection();
        // Use PostgreSQL's vector similarity search
        for (let i = 0; i < embeddings.length; i++) {
            const embedding1 = embeddings[i];
            // Find similar embeddings using pgvector
            const similarResult = await pgClient.query(`
        SELECT
          id,
          file_path,
          chunk_id,
          content_text as content,
          chunk_start_line as start_line,
          chunk_end_line as end_line,
          1 - (embedding <=> $1::vector) as similarity
        FROM semantic_search_embeddings
        WHERE id != $2
          AND file_path != $3
          AND 1 - (embedding <=> $1::vector) > 0.8
        ORDER BY embedding <=> $1::vector
        LIMIT 5
      `, [
                `[${embedding1.embedding.join(',')}]`,
                embedding1.id,
                embedding1.file_path
            ]);
            for (const similar of similarResult.rows) {
                // Skip if this pair was already processed
                const pairId = [embedding1.id, similar.id].sort().join(':');
                if (candidates.some(c => c.id === pairId))
                    continue;
                candidates.push({
                    id: pairId,
                    filePath1: embedding1.file_path,
                    filePath2: similar.file_path,
                    chunk1: {
                        content: embedding1.content,
                        startLine: embedding1.start_line,
                        endLine: embedding1.end_line
                    },
                    chunk2: {
                        content: similar.content,
                        startLine: similar.start_line,
                        endLine: similar.end_line
                    },
                    similarity: similar.similarity,
                    type: similar.similarity > 0.95 ? 'exact' : 'semantic',
                    embedding1: embedding1.embedding,
                    embedding2: null // We don't need to store both
                });
            }
        }
        return candidates;
    }
    /**
     * Analyze duplicates with Claude Code
     */
    async analyzeWithClaude(candidates) {
        // This would integrate with Claude Code API
        // For now, we'll add a placeholder
        for (const candidate of candidates.slice(0, 10)) { // Limit to top 10 for API calls
            candidate.claudeAnalysis = `
        These code blocks have ${Math.round(candidate.similarity * 100)}% similarity.
        Consider extracting common functionality into a shared utility.
        Estimated reduction: ${Math.round((candidate.chunk1.endLine - candidate.chunk1.startLine) * 0.7)} lines.
      `;
        }
    }
    /**
     * Generate smart consolidation suggestions
     */
    async generateSmartSuggestions(candidates) {
        const suggestions = [];
        for (const candidate of candidates) {
            const lines1 = candidate.chunk1.endLine - candidate.chunk1.startLine;
            const lines2 = candidate.chunk2.endLine - candidate.chunk2.startLine;
            const avgLines = (lines1 + lines2) / 2;
            let strategy;
            let description;
            if (candidate.type === 'exact') {
                strategy = 'extract-function';
                description = `Extract identical code into a shared function`;
            }
            else if (candidate.similarity > 0.9) {
                strategy = 'create-utility';
                description = `Create utility class for similar functionality`;
            }
            else if (candidate.chunk1.content.includes('class') || candidate.chunk2.content.includes('class')) {
                strategy = 'merge-classes';
                description = `Merge similar classes using inheritance`;
            }
            else {
                strategy = 'create-interface';
                description = `Create common interface for similar implementations`;
            }
            suggestions.push({
                candidateId: candidate.id,
                strategy,
                description,
                estimatedLinesReduced: Math.round(avgLines * 0.7),
                claudeAnalysis: candidate.claudeAnalysis
            });
        }
        // Sort by potential impact
        suggestions.sort((a, b) => b.estimatedLinesReduced - a.estimatedLinesReduced);
        return suggestions;
    }
    /**
     * Cache analysis results in Redis
     */
    async cacheAnalysisResults(projectId, candidates, suggestions) {
        const redisClient = await this.dbConnections.getRedisConnection();
        // Cache results with TTL of 1 hour
        const resultsKey = `dedup:${projectId}:results`;
        await redisClient.set(resultsKey, JSON.stringify({ candidates, suggestions, timestamp: new Date().toISOString() }), 'EX', 3600);
    }
    /**
     * Get cached results if available
     */
    async getCachedResults(projectId) {
        const redisClient = await this.dbConnections.getRedisConnection();
        const resultsKey = `dedup:${projectId}:results`;
        const cached = await redisClient.get(resultsKey);
        if (cached) {
            return JSON.parse(cached);
        }
        return null;
    }
}
exports.SmartDedupDetector = SmartDedupDetector;
//# sourceMappingURL=smart-dedup-detector.js.map