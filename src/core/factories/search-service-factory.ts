/**
 * Search Service Factory - Dependency Injection
 * Creates and wires up search services following Dependency Inversion Principle
 */

import { DatabaseConnections } from '../../config/database-config';
import { ContentChunker } from '../../cli/services/search/content-chunker';
import { SearchIndexStorage } from '../../cli/services/search/search-index-storage';
import { SearchQueryProcessor } from '../../cli/services/search/search-query-processor';
import { SemanticSearchService } from '../../cli/services/search/semantic-search';
import { EmbeddingGeneratorAdapter } from '../../cli/services/search/embedding-generator-adapter';
import {
  IContentChunker,
  IEmbeddingGenerator,
  ISearchIndexStorage,
  ISearchQueryProcessor
} from '../interfaces/search-interfaces';

export class SearchServiceFactory {
  private static instance: SearchServiceFactory;
  private dbConnections: DatabaseConnections;

  private constructor() {
    this.dbConnections = new DatabaseConnections();
  }

  static getInstance(): SearchServiceFactory {
    if (!SearchServiceFactory.instance) {
      SearchServiceFactory.instance = new SearchServiceFactory();
    }
    return SearchServiceFactory.instance;
  }

  /**
   * Create content chunker service
   */
  createContentChunker(): IContentChunker {
    return new ContentChunker();
  }

  /**
   * Create embedding generator service
   */
  createEmbeddingGenerator(): IEmbeddingGenerator {
    return new EmbeddingGeneratorAdapter();
  }

  /**
   * Create search index storage service
   */
  createSearchIndexStorage(): ISearchIndexStorage {
    return new SearchIndexStorage(this.dbConnections);
  }

  /**
   * Create search query processor service
   */
  createSearchQueryProcessor(): ISearchQueryProcessor {
    const embeddingGenerator = this.createEmbeddingGenerator();
    const indexStorage = this.createSearchIndexStorage();

    return new SearchQueryProcessor(embeddingGenerator, indexStorage);
  }

  /**
   * Create fully configured search service with all dependencies injected
   */
  createSemanticSearchService(): SemanticSearchService {
    const contentChunker = this.createContentChunker();
    const embeddingGenerator = this.createEmbeddingGenerator();
    const indexStorage = this.createSearchIndexStorage();
    const queryProcessor = this.createSearchQueryProcessor();

    return new SemanticSearchService(
      contentChunker,
      embeddingGenerator,
      indexStorage,
      queryProcessor
    );
  }

  /**
   * Create search service with custom dependencies (for testing)
   */
  createSemanticSearchServiceWithDependencies(
    contentChunker: IContentChunker,
    embeddingGenerator: IEmbeddingGenerator,
    indexStorage: ISearchIndexStorage,
    queryProcessor: ISearchQueryProcessor
  ): SemanticSearchService {
    return new SemanticSearchService(
      contentChunker,
      embeddingGenerator,
      indexStorage,
      queryProcessor
    );
  }

  /**
   * Get database connections instance
   */
  getDatabaseConnections(): DatabaseConnections {
    return this.dbConnections;
  }
}