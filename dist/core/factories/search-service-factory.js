"use strict";
/**
 * Search Service Factory - Dependency Injection
 * Creates and wires up search services following Dependency Inversion Principle
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchServiceFactory = void 0;
const database_config_1 = require("../../config/database-config");
const content_chunker_1 = require("../../cli/services/search/content-chunker");
const search_index_storage_1 = require("../../cli/services/search/search-index-storage");
const search_query_processor_1 = require("../../cli/services/search/search-query-processor");
const semantic_search_1 = require("../../cli/services/search/semantic-search");
const embedding_generator_adapter_1 = require("../../cli/services/search/embedding-generator-adapter");
class SearchServiceFactory {
    static instance;
    dbConnections;
    constructor() {
        this.dbConnections = new database_config_1.DatabaseConnections();
    }
    static getInstance() {
        if (!SearchServiceFactory.instance) {
            SearchServiceFactory.instance = new SearchServiceFactory();
        }
        return SearchServiceFactory.instance;
    }
    /**
     * Create content chunker service
     */
    createContentChunker() {
        return new content_chunker_1.ContentChunker();
    }
    /**
     * Create embedding generator service
     */
    createEmbeddingGenerator() {
        return new embedding_generator_adapter_1.EmbeddingGeneratorAdapter();
    }
    /**
     * Create search index storage service
     */
    createSearchIndexStorage() {
        return new search_index_storage_1.SearchIndexStorage(this.dbConnections);
    }
    /**
     * Create search query processor service
     */
    createSearchQueryProcessor() {
        const embeddingGenerator = this.createEmbeddingGenerator();
        const indexStorage = this.createSearchIndexStorage();
        return new search_query_processor_1.SearchQueryProcessor(embeddingGenerator, indexStorage);
    }
    /**
     * Create fully configured search service with all dependencies injected
     */
    createSemanticSearchService() {
        const contentChunker = this.createContentChunker();
        const embeddingGenerator = this.createEmbeddingGenerator();
        const indexStorage = this.createSearchIndexStorage();
        const queryProcessor = this.createSearchQueryProcessor();
        return new semantic_search_1.SemanticSearchService(contentChunker, embeddingGenerator, indexStorage, queryProcessor);
    }
    /**
     * Create search service with custom dependencies (for testing)
     */
    createSemanticSearchServiceWithDependencies(contentChunker, embeddingGenerator, indexStorage, queryProcessor) {
        return new semantic_search_1.SemanticSearchService(contentChunker, embeddingGenerator, indexStorage, queryProcessor);
    }
    /**
     * Get database connections instance
     */
    getDatabaseConnections() {
        return this.dbConnections;
    }
}
exports.SearchServiceFactory = SearchServiceFactory;
//# sourceMappingURL=search-service-factory.js.map