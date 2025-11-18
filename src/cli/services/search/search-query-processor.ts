/**
 * Search Query Processor Service - Single Responsibility
 * Handles search query processing and similarity calculations
 */

import { ISearchQueryProcessor, IEmbeddingGenerator, ISearchIndexStorage, SearchQuery, SearchResponse, SemanticSearchResult } from '../../../core/interfaces/search-interfaces';

export class SearchQueryProcessor implements ISearchQueryProcessor {
  constructor(
    private embeddingGenerator: IEmbeddingGenerator,
    private indexStorage: ISearchIndexStorage
  ) {}

  async processQuery(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingGenerator.generateQueryEmbedding(query.text);

      // Execute similarity search
      const results = await this.executeSimilaritySearch(queryEmbedding, query);

      // Get index statistics
      const indexStats = await this.indexStorage.getIndexStats(query.projectId);

      const processingTime = Date.now() - startTime;

      return {
        query: query.text,
        results,
        totalResults: results.length,
        processingTime,
        searchStats: {
          indexedFiles: indexStats.totalFiles,
          totalChunks: indexStats.totalChunks,
          matchesFound: results.length
        }
      };
    } catch (error) {
      console.error('Search query processing failed:', error);
      return {
        query: query.text,
        results: [],
        totalResults: 0,
        processingTime: Date.now() - startTime,
        searchStats: {
          indexedFiles: 0,
          totalChunks: 0,
          matchesFound: 0
        }
      };
    }
  }

  async executeSimilaritySearch(queryEmbedding: number[], query: SearchQuery): Promise<SemanticSearchResult[]> {
    // Retrieve candidate chunks from storage
    const candidateResults = await this.indexStorage.retrieveChunks(query);

    // Calculate similarity scores
    const scoredResults = candidateResults.map(result => {
      if (!result.embedding) {
        return { ...result, relevanceScore: 0, matchReason: 'no_embedding' };
      }

      const similarity = this.calculateCosineSimilarity(queryEmbedding, result.embedding);

      return {
        ...result,
        relevanceScore: similarity,
        matchReason: this.generateMatchReason(similarity, result, query)
      };
    });

    // Filter by minimum similarity
    const minSimilarity = query.minSimilarity || 0.1;
    const filteredResults = scoredResults.filter(result => result.relevanceScore >= minSimilarity);

    // Sort by relevance score
    filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply result limit
    const maxResults = query.maxResults || 10;
    return filteredResults.slice(0, maxResults);
  }

  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      console.warn('Vector length mismatch in similarity calculation');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  private generateMatchReason(similarity: number, result: SemanticSearchResult, query: SearchQuery): string {
    if (similarity > 0.8) {
      return 'high_semantic_similarity';
    } else if (similarity > 0.6) {
      return 'medium_semantic_similarity';
    } else if (similarity > 0.4) {
      return 'low_semantic_similarity';
    }

    // Check for keyword matches as fallback
    const contentLower = result.chunk.content.toLowerCase();
    const queryLower = query.text.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const matchingWords = queryWords.filter(word => contentLower.includes(word));
    if (matchingWords.length > 0) {
      return `keyword_match: ${matchingWords.join(', ')}`;
    }

    return 'weak_similarity';
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - remove common words
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);

    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }
}