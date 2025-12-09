/**
 * Enhanced Graph Analysis Service with Knowledge Graph Integration
 * Single Responsibility: Analyze code relationships using sophisticated knowledge graph
 * Interfaces with SemanticKnowledgeGraph for proper Neo4j-based analysis
 */
export interface GraphContext {
    classes: Array<{
        name: string;
        filePath: string;
        type: string;
        description: string;
        confidence: number;
        relationships: Array<{
            target: string;
            relation: string;
            confidence: number;
        }>;
    }>;
    relationships: Array<{
        from: string;
        to: string;
        type: string;
        strength: number;
        fromPath?: string;
        toPath?: string;
        fromMethod?: string;
        toMethod?: string;
        line?: number;
    }>;
    relationshipDetails: Array<{
        from: string;
        to: string;
        type: string;
        fromPath?: string;
        toPath?: string;
        fromMethod?: string;
        toMethod?: string;
        line?: number;
    }>;
    packageStructure: string[];
    graphInsights: {
        totalNodes: number;
        totalRelationships: number;
        architecturalPatterns: string[];
        qualityMetrics: {
            coupling: number;
            cohesion: number;
            complexity: number;
        };
    };
}
export declare class GraphAnalysisService {
    private knowledgeGraph;
    private logger;
    private projectPath;
    constructor(projectPath: string);
    /**
     * Perform sophisticated graph analysis using knowledge graph
     * Falls back to basic analysis if knowledge graph doesn't produce results
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
     * Generate relationships based on actual class structure
     * Note: This no longer uses hardcoded keyword detection.
     * Relationships are derived from actual class types detected in the codebase.
     */
    private generateRelationships;
    /**
     * Build knowledge graph from semantic search results
     */
    private buildKnowledgeGraph;
    /**
     * Convert semantic result types to knowledge graph node types
     */
    private mapToNodeType;
    /**
     * Add structural relationships based on file analysis
     */
    private addStructuralRelationships;
    /**
     * Extract import statements from file content
     */
    private extractImports;
    /**
     * Extract source location (file path and line numbers) for a class/function
     */
    private extractSourceLocation;
    /**
     * Extract method calls from file content (simple version for backward compatibility)
     */
    private extractMethodCalls;
    /**
     * Extract method calls with full context (caller method, target class, line number)
     */
    private extractMethodCallsWithContext;
    /**
     * Extract query terms for knowledge graph search
     */
    private extractQueryTerms;
    /**
     * Convert knowledge graph nodes to GraphContext classes
     */
    private convertNodesToClasses;
    /**
     * Get relationships for a specific node
     */
    private getNodeRelationships;
    /**
     * Extract relationships from knowledge graph nodes
     */
    private extractRelationships;
    /**
     * Extract class-based relationships from nodes (using actual class names)
     */
    private extractClassBasedRelationships;
    /**
     * Extract a human-readable name from node ID or metadata
     */
    private extractNameFromMetadata;
    /**
     * Generate architectural insights from graph analysis
     */
    private generateGraphInsights;
    /**
     * Extract packages from semantic results
     */
    private extractPackages;
    /**
     * Fallback to basic analysis if knowledge graph fails
     */
    private performBasicAnalysis;
}
//# sourceMappingURL=graph-analysis-service.d.ts.map