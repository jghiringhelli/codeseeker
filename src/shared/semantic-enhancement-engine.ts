/**
 * Semantic Enhancement Engine
 * Powers CLI cycle with semantic search and relationship traversal
 * Now a thin wrapper around the unified SemanticSearchManager
 */

import { Logger } from '../utils/logger';
import { SemanticSearchService } from '../cli/services/search/semantic-search';
import { SearchQuery, SearchResponse } from '../core/interfaces/search-interfaces';
import { SearchServiceFactory } from '../core/factories/search-service-factory';

// Legacy interfaces for backward compatibility
export interface SemanticSearchResult {
  filePath: string;
  relevanceScore: number;
  content: string;
  lastModified: number;
  hash: string;
  matchReason: string;
}

export interface RelatedFileContext {
  filePath: string;
  relationshipType: string;
  content: string;
  hash: string;
  distance: number;
}

export interface EnhancementContext {
  query: string;
  primaryFiles: SemanticSearchResult[];
  relatedFiles: RelatedFileContext[];
  totalFiles: number;
  contextSize: number;
  cacheHitRate: number;
  generatedAt: number;
}

/**
 * Legacy wrapper for SemanticSearchManager
 * Maintains backward compatibility while delegating to unified manager
 */
export class SemanticEnhancementEngine {
  private logger = Logger.getInstance();
  private semanticSearchManager: SemanticSearchService;

  constructor() {
    const searchFactory = SearchServiceFactory.getInstance();
    this.semanticSearchManager = searchFactory.createSemanticSearchService();
  }

  /**
   * Main enhancement workflow using unified semantic search manager
   */
  async enhanceQuery(
    query: string,
    maxPrimaryFiles: number = 8,
    maxRelatedFiles: number = 15,
    maxContextSize: number = 100000,
    projectId?: string
  ): Promise<EnhancementContext> {
    const startTime = Date.now();
    this.logger.info(`🔍 Enhancing query with unified semantic search: "${query}"`);

    try {
      // Use unified semantic search manager
      const searchQuery: SearchQuery = {
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
    } catch (error) {
      this.logger.error('❌ Semantic enhancement failed:', error);
      throw error;
    }
  }

  /**
   * Update context after Claude's processing
   */
  async updateContextAfterProcessing(
    modifiedFiles: string[],
    context: EnhancementContext,
    projectId?: string
  ): Promise<void> {
    this.logger.info(`📝 Updating context after processing ${modifiedFiles.length} modified files`);

    if (projectId) {
      // Delegate to unified semantic search manager
      await this.semanticSearchManager.updateFiles(projectId, modifiedFiles);
    } else {
      this.logger.warn('No project ID provided, skipping semantic search updates');
    }
  }

  /**
   * Initialize semantic search for a project
   */
  async initializeProjectSemanticSearch(
    projectId: string,
    files: string[],
    progressCallback?: (progress: number, current: string, detail: string) => void
  ): Promise<{ success: number; errors: number; chunks: number; skipped: number }> {
    // Extract project path from the first file path (legacy compatibility)
    const projectPath = files.length > 0 ? files[0].split('/').slice(0, -1).join('/') : process.cwd();

    await this.semanticSearchManager.initializeProject(projectId, projectPath);

    const serviceStats = await this.semanticSearchManager.getStats(projectId);
    const stats = serviceStats.indexStats || { totalFiles: 0, totalChunks: 0, projectSize: 0 };
    return {
      success: stats.totalFiles,
      errors: 0, // New implementation doesn't track errors this way
      chunks: stats.totalChunks,
      skipped: 0
    };
  }

  /**
   * Get semantic search statistics
   */
  async getSemanticSearchStats(projectId?: string): Promise<{
    totalChunks: number;
    totalFiles: number;
    avgChunksPerFile: number;
    storageSize: string;
  }> {
    const serviceStats = await this.semanticSearchManager.getStats(projectId);
    const stats = serviceStats.indexStats || { totalFiles: 0, totalChunks: 0, projectSize: 0 };
    return {
      totalChunks: stats.totalChunks,
      totalFiles: stats.totalFiles,
      avgChunksPerFile: stats.totalFiles > 0 ? Math.round(stats.totalChunks / stats.totalFiles) : 0,
      storageSize: `${Math.round((stats.projectSize || 0) / 1024)}KB`
    };
  }

  /**
   * Convert search response to legacy format for compatibility
   */
  private convertToLegacyFormat(searchResponse: SearchResponse, maxContextSize: number): EnhancementContext {
    let totalSize = 0;
    const primaryFiles: SemanticSearchResult[] = [];
    const relatedFiles: RelatedFileContext[] = [];

    // Convert search results to legacy format
    for (const result of searchResponse.results) {
      if (totalSize + result.chunk.content.length > maxContextSize) {
        break;
      }

      const legacyFile: SemanticSearchResult = {
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
      cacheHitRate: searchResponse.results.length > 0 ? 1.0 : 0.5, // Estimate based on results
      generatedAt: Date.now()
    };
  }
}

export default SemanticEnhancementEngine;