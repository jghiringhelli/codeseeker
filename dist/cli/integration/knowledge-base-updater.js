"use strict";
/**
 * Knowledge Base Updater - Single Responsibility: Updating all knowledge base systems
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
exports.KnowledgeBaseUpdater = void 0;
const database_config_1 = require("../../config/database-config");
class KnowledgeBaseUpdater {
    async update(analysis) {
        console.log('📚 Updating comprehensive knowledge base...');
        try {
            const updateTasks = [
                this.updateAnalysisRepository(analysis),
                this.updateSemanticSearch(analysis),
                this.updateSemanticGraph(analysis),
                this.updateRedisCache(analysis),
                this.updateProjectIntelligence(analysis)
            ];
            await Promise.allSettled(updateTasks);
            console.log('🎉 Knowledge base comprehensively updated across all systems');
        }
        catch (error) {
            console.error('❌ Failed to update knowledge base:', error);
            throw error;
        }
    }
    async updateAnalysisRepository(analysis) {
        const { analysisRepo } = await Promise.resolve().then(() => __importStar(require('../../shared/analysis-repository')));
        await analysisRepo.storeAnalysis(analysis.projectId || 'unknown', 'claude-code-integration', {
            timestamp: new Date(),
            analysis: analysis,
            summary: analysis.summary || 'Claude Code integration analysis',
            fileCount: analysis.filesAnalyzed || 0,
            hasIssues: analysis.issues?.length > 0 || false
        });
    }
    async updateSemanticSearch(analysis) {
        const changedFiles = analysis.filesModified || [];
        if (changedFiles.length === 0)
            return;
        try {
            const { EmbeddingService } = await Promise.resolve().then(() => __importStar(require('../services/data/embedding/embedding-service')));
            // IMPORTANT: Must use same model as search-command-handler.ts and embedding-generator-adapter.ts
            const embeddingService = new EmbeddingService({
                provider: 'xenova',
                model: 'Xenova/all-MiniLM-L6-v2',
                batchSize: 100
            });
            await embeddingService.generateProjectEmbeddings(analysis.projectId, changedFiles);
            console.log('✅ Semantic search embeddings updated');
        }
        catch (error) {
            console.warn('⚠️ Failed to update semantic embeddings:', error.message);
        }
    }
    async updateSemanticGraph(analysis) {
        const changedFiles = analysis.filesModified || [];
        if (changedFiles.length === 0 || !analysis.projectPath)
            return;
        try {
            const { SemanticGraphService } = await Promise.resolve().then(() => __importStar(require('../services/data/semantic-graph/semantic-graph')));
            const semanticGraph = new SemanticGraphService();
            // Update semantic graph with new file relationships
            for (const file of changedFiles) {
                const nodeId = await semanticGraph.addNode('Code', {
                    name: file,
                    path: file,
                    projectId: analysis.projectId,
                    lastModified: new Date().toISOString()
                });
                console.log(`Added/updated semantic node for ${file}: ${nodeId}`);
            }
            console.log('✅ Semantic graph relationships updated');
        }
        catch (error) {
            console.warn('⚠️ Failed to update semantic graph:', error.message);
        }
    }
    async updateRedisCache(analysis) {
        try {
            const dbConnections = new database_config_1.DatabaseConnections();
            const redis = await dbConnections.getRedisConnection();
            const cacheKey = `analysis:${analysis.projectId}:latest`;
            await redis.setex(cacheKey, 3600, JSON.stringify({
                timestamp: new Date(),
                analysis: analysis,
                filesModified: analysis.filesModified || []
            }));
            for (const file of analysis.filesModified || []) {
                const fileCacheKey = `file:${analysis.projectId}:${file}`;
                await redis.setex(fileCacheKey, 1800, JSON.stringify({
                    lastModified: new Date(),
                    analyzed: true,
                    projectId: analysis.projectId
                }));
            }
            console.log('✅ Redis cache updated');
        }
        catch (error) {
            console.warn('⚠️ Failed to update Redis cache:', error.message);
        }
    }
    async updateProjectIntelligence(analysis) {
        try {
            const { projectIntelligence } = await Promise.resolve().then(() => __importStar(require('../../shared/project-intelligence')));
            await projectIntelligence.updateProjectIntelligence(analysis.projectId, {
                name: analysis.projectName || 'Unknown Project',
                type: analysis.projectType || 'unknown',
                languages: analysis.languages || [],
                frameworks: analysis.frameworks || [],
                patterns: analysis.patterns || [],
                complexity: analysis.complexity || 1,
                lastAnalysis: analysis
            });
            console.log('✅ Project intelligence updated');
        }
        catch (error) {
            console.warn('⚠️ Failed to update project intelligence:', error.message);
        }
    }
}
exports.KnowledgeBaseUpdater = KnowledgeBaseUpdater;
//# sourceMappingURL=knowledge-base-updater.js.map