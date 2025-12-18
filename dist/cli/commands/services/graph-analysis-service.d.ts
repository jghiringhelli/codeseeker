/**
 * Graph Analysis Service - Queries Persisted Neo4j Graph
 * Single Responsibility: Query existing Neo4j graph to find relationships between semantic search results
 *
 * Strategy: "Seed + Expand"
 * 1. Take top N files from semantic search (seeds)
 * 2. Look up corresponding ENTITY nodes in Neo4j by filePath
 * 3. Get direct relationships between seed nodes
 * 4. Optionally expand 1-hop to include important dependencies
 */
export interface GraphContext {
    classes: Array<{
        name: string;
        filePath: string;
        type: string;
        description: string;
        confidence: number;
        startLine?: number;
        endLine?: number;
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
    private dbConnections;
    private logger;
    private projectPath;
    private projectId?;
    constructor(projectPath: string, projectId?: string);
    /**
     * Set project ID for scoped queries
     */
    setProjectId(projectId: string): void;
    /**
     * Main entry point: Perform graph analysis using persisted Neo4j graph
     * Uses "Seed + Expand" strategy
     */
    performGraphAnalysis(_query: string, semanticResults: any[]): Promise<GraphContext>;
    /**
     * Resolve project ID from database by project path
     * Queries both :Project and :PROJECT labels for compatibility
     */
    private resolveProjectId;
    /**
     * Step 1: Look up nodes by file path from Neo4j graph
     * Current schema: Project-[:CONTAINS]->File-[:DEFINES]->Class/Function
     * File nodes have `path` property, entities have `name`, `startLine`, `endLine`
     */
    private lookupNodesFromFiles;
    /**
     * Step 2: Get relationships between seed nodes
     * Current schema: File-[:DEFINES]->Class/Function
     * Returns DEFINES relationships between files and their entities
     */
    private getRelationshipsBetweenNodes;
    /**
     * Step 3: One-hop expansion - find important neighbors not in seed set
     * Current schema: File-[:DEFINES]->Class/Function
     * Expands to find other files that define related entities
     */
    private expandOneHop;
    /**
     * Convert Neo4j entities to GraphContext classes format
     */
    private convertToClasses;
    /**
     * Generate description for a node
     */
    private generateDescription;
    /**
     * Extract package names from nodes
     */
    private extractPackages;
    /**
     * Calculate graph insights
     */
    private calculateInsights;
    /**
     * Parse metadata JSON safely
     */
    private parseMetadata;
    /**
     * Fallback: Create basic analysis from semantic results when graph unavailable
     */
    private createBasicAnalysis;
    /**
     * Extract class name from file path
     */
    private extractClassNameFromFile;
}
//# sourceMappingURL=graph-analysis-service.d.ts.map