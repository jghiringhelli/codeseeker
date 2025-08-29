/**
 * Enhanced RAG (Retrieval-Augmented Generation) System
 * Wrapper around VectorSearchEngine for backward compatibility
 */
export declare class VectorSearch {
    private engine;
    constructor();
    search(params: {
        query?: string;
        projectPath: string;
        buildSemanticContext?: boolean;
        includeRelationships?: boolean;
    }): Promise<any>;
}
export default VectorSearch;
//# sourceMappingURL=enhanced-rag-system.d.ts.map