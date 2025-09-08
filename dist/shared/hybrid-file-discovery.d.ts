/**
 * Hybrid File Discovery System
 * Combines vector search (intent-based) + semantic graph (structure-based) for intelligent file discovery
 */
export interface FileDiscoveryRequest {
    query: string;
    projectPath: string;
    projectId: string;
    intent?: 'search' | 'refactor' | 'test' | 'debug' | 'security' | 'optimize';
    maxFiles?: number;
    includeRelated?: boolean;
}
export interface DiscoveredFile {
    filePath: string;
    contentType: 'code' | 'config' | 'documentation' | 'test' | 'schema';
    language?: string;
    relevanceScore: number;
    discoveryPhase: 'vector' | 'graph' | 'both';
    relationships?: string[];
}
export interface FileDiscoveryResult {
    primaryFiles: DiscoveredFile[];
    relatedFiles: DiscoveredFile[];
    totalFiles: number;
    phases: {
        vectorResults: number;
        graphExpansions: number;
    };
    graphContext?: {
        relationshipTypes: string[];
        impactLevel: 'low' | 'medium' | 'high';
    };
}
export declare class HybridFileDiscovery {
    private vectorSearch;
    private semanticGraph;
    private logger;
    constructor();
    initialize(): Promise<void>;
    /**
     * Two-phase file discovery: Vector search + Graph expansion
     */
    discoverFiles(request: FileDiscoveryRequest): Promise<FileDiscoveryResult>;
    /**
     * Phase 1: Vector-based file discovery using semantic embeddings
     */
    private vectorBasedDiscovery;
    /**
     * Phase 2: Graph-based relationship expansion
     */
    private graphBasedExpansion;
    /**
     * Find semantic graph nodes that correspond to a file path
     */
    private findGraphNodesForFile;
    /**
     * Get related nodes based on user intent
     */
    private getRelatedNodesByIntent;
    /**
     * Map intent to relevant relationship types for graph traversal
     */
    private getRelationshipTypesForIntent;
    /**
     * Map intent to graph traversal depth
     */
    private getTraversalDepthForIntent;
    /**
     * Convert graph node back to file information
     */
    private convertGraphNodeToFile;
    /**
     * Merge vector and graph results, removing duplicates
     */
    private mergeAndDeduplicate;
    /**
     * Infer content type from file path
     */
    private inferContentType;
    /**
     * Generate query embedding for vector search
     */
    private generateQueryEmbedding;
    close(): Promise<void>;
}
//# sourceMappingURL=hybrid-file-discovery.d.ts.map