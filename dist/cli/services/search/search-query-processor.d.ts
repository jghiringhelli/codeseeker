/**
 * Search Query Processor Service - Single Responsibility
 * Handles search query processing and similarity calculations
 */
import { ISearchQueryProcessor, IEmbeddingGenerator, ISearchIndexStorage, SearchQuery, SearchResponse, SemanticSearchResult } from '../../../core/interfaces/search-interfaces';
export declare class SearchQueryProcessor implements ISearchQueryProcessor {
    private embeddingGenerator;
    private indexStorage;
    constructor(embeddingGenerator: IEmbeddingGenerator, indexStorage: ISearchIndexStorage);
    processQuery(query: SearchQuery): Promise<SearchResponse>;
    executeSimilaritySearch(queryEmbedding: number[], query: SearchQuery): Promise<SemanticSearchResult[]>;
    private calculateCosineSimilarity;
    private generateMatchReason;
    private extractKeywords;
}
//# sourceMappingURL=search-query-processor.d.ts.map