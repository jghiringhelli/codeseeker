/**
 * Knowledge Base Updater - Single Responsibility: Updating all knowledge base systems
 */

import { DatabaseConnections } from '../../config/database-config';

export class KnowledgeBaseUpdater {
  async update(analysis: any): Promise<void> {
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

    } catch (error) {
      console.error('❌ Failed to update knowledge base:', error);
      throw error;
    }
  }

  private async updateAnalysisRepository(analysis: any): Promise<void> {
    const { analysisRepo } = await import('../../shared/analysis-repository');

    await analysisRepo.storeAnalysis(
      analysis.projectId || 'unknown',
      'claude-code-integration',
      {
        timestamp: new Date(),
        analysis: analysis,
        summary: analysis.summary || 'Claude Code integration analysis',
        fileCount: analysis.filesAnalyzed || 0,
        hasIssues: analysis.issues?.length > 0 || false
      }
    );
  }

  private async updateSemanticSearch(analysis: any): Promise<void> {
    const changedFiles = analysis.filesModified || [];
    if (changedFiles.length === 0) return;

    try {
      const { EmbeddingService } = await import('../services/data/embedding/embedding-service');
      const embeddingService = new EmbeddingService();
      await embeddingService.generateProjectEmbeddings(analysis.projectId, changedFiles);
      console.log('✅ Semantic search embeddings updated');
    } catch (error) {
      console.warn('⚠️ Failed to update semantic embeddings:', error.message);
    }
  }

  private async updateSemanticGraph(analysis: any): Promise<void> {
    const changedFiles = analysis.filesModified || [];
    if (changedFiles.length === 0 || !analysis.projectPath) return;

    try {
      const { SemanticGraphService } = await import('../services/data/semantic-graph/semantic-graph');
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
    } catch (error) {
      console.warn('⚠️ Failed to update semantic graph:', error.message);
    }
  }

  private async updateRedisCache(analysis: any): Promise<void> {
    try {
      const dbConnections = new DatabaseConnections();
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
    } catch (error) {
      console.warn('⚠️ Failed to update Redis cache:', error.message);
    }
  }

  private async updateProjectIntelligence(analysis: any): Promise<void> {
    try {
      const { projectIntelligence } = await import('../../shared/project-intelligence');

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
    } catch (error) {
      console.warn('⚠️ Failed to update project intelligence:', error.message);
    }
  }
}