export interface VectorSearchRequest {
    query: string;
    projectPath: string;
    limit: number;
    crossProject: boolean;
    useSemanticSearch: boolean;
    contextWeight?: number;
    similarityThreshold?: number;
}
export interface VectorSearchResult {
    query: string;
    matches: SemanticMatch[];
    searchTime: number;
    indexStats: IndexStatistics;
    searchMetadata: SearchMetadata;
}
export interface SemanticMatch {
    file: string;
    line: number;
    column?: number;
    codeSnippet: string;
    similarity: number;
    context?: string;
    relevanceScore: number;
    matchType: MatchType;
    embedding?: number[];
    metadata: MatchMetadata;
}
export interface MatchMetadata {
    function?: string;
    class?: string;
    language: string;
    complexity: number;
    linesOfCode: number;
    symbols: string[];
    comments: string[];
}
export interface IndexStatistics {
    totalFiles: number;
    indexedBlocks: number;
    embeddingDimensions: number;
    indexSize: number;
    lastUpdated: Date;
}
export interface SearchMetadata {
    queryProcessingTime: number;
    indexSearchTime: number;
    resultRankingTime: number;
    totalResults: number;
    filteredResults: number;
}
export declare enum MatchType {
    EXACT = "exact",
    FUZZY = "fuzzy",
    SEMANTIC = "semantic",
    CONTEXTUAL = "contextual",
    STRUCTURAL = "structural"
}
export declare class VectorSearch {
    private logger;
    private astAnalyzer;
    private index;
    private embeddingCache;
    private readonly EMBEDDING_DIMENSION;
    constructor();
    search(request: VectorSearchRequest): Promise<VectorSearchResult>;
    private buildIndex;
    private getIndexableFiles;
    private extractCodeBlocks;
    private createCodeBlock;
    private generateBlockId;
    private tokenizeCode;
    private isStopWord;
    private extractSemanticFeatures;
    private extractKeywords;
    private extractDomainKeywords;
    private extractFunctionNames;
    private extractVariableNames;
    private extractConcepts;
    private extractCodePatterns;
    private estimateComplexity;
    private extractBlockContext;
    private findParentFunction;
    private findParentClass;
    private findSignificantCodeBlocks;
    private extractBlocksFallback;
    private isSignificantContent;
    private generateEmbedding;
    private createSimpleEmbedding;
    private createQueryEmbedding;
    private tokenizeText;
    private searchIndex;
    private cosineSimilarity;
    private calculateTextSimilarity;
    private calculateContextScore;
    private determineMatchType;
    private hasStructuralSimilarity;
    private calculateRelevanceScore;
    private createCodeSnippet;
    private createMatchContext;
    private detectLanguageFromPath;
    private rankResults;
    private shouldRebuildIndex;
    private getIndexStatistics;
    clearIndex(): Promise<void>;
    rebuildIndex(projectPath: string): Promise<void>;
}
export default VectorSearch;
//# sourceMappingURL=search-engine.d.ts.map