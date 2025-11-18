/**
 * Graph Analysis Service
 * Single Responsibility: Analyze code relationships and extract graph context
 * Interfaces with semantic graph tools and provides structured analysis
 */
export interface GraphContext {
    classes: Array<{
        name: string;
        filePath: string;
        type: string;
        description: string;
    }>;
    relationships: Array<{
        from: string;
        to: string;
        type: string;
        strength: number;
    }>;
    relationshipDetails: Array<{
        from: string;
        to: string;
        type: string;
    }>;
    packageStructure: string[];
}
export declare class GraphAnalysisService {
    /**
     * Perform graph analysis based on semantic search results
     */
    performGraphAnalysis(query: string, semanticResults: any[]): Promise<GraphContext>;
    /**
     * Extract class name from file path
     */
    private extractClassNameFromFile;
    /**
     * Extract package name from file path
     */
    private extractPackageFromFile;
    /**
     * Generate class description based on file path and type
     */
    private generateClassDescription;
    /**
     * Generate relationships based on query context and common patterns
     */
    private generateRelationships;
}
//# sourceMappingURL=graph-analysis-service.d.ts.map