/**
 * Semantic Enhancement Engine
 * Powers CLI cycle with semantic search and relationship traversal
 * Now a thin wrapper around the unified SemanticSearchManager
 */

import { Logger } from '../utils/logger';
import SemanticSearchManager, { SearchQuery, SearchResponse } from './semantic-search-manager';

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
  private semanticSearchManager: SemanticSearchManager;

  constructor() {
    this.semanticSearchManager = new SemanticSearchManager();
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
    return await this.semanticSearchManager.initializeProject(projectId, files, progressCallback);
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
    return await this.semanticSearchManager.getIndexStats(projectId);
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
      cacheHitRate: searchResponse.usedFallback ? 0.5 : 1.0,
      generatedAt: Date.now()
    };
  }
}

export default SemanticEnhancementEngine;