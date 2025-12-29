/**
 * Graph Analysis Service - Queries Persisted Knowledge Graph
 * Single Responsibility: Query existing knowledge graph to find relationships between semantic search results
 *
 * Strategy: "Seed + Expand"
 * 1. Take top N files from semantic search (seeds)
 * 2. Look up corresponding ENTITY nodes in graph by filePath
 * 3. Get direct relationships between seed nodes
 * 4. Optionally expand 1-hop to include important dependencies
 *
 * Storage Mode Support:
 * - Embedded mode: Uses Graphology graph store (no Docker required)
 * - Server mode: Uses Neo4j (for production)
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
    private graphStore?;
    private useEmbedded;
    constructor(projectPath: string, projectId?: string);
    /**
     * Initialize the graph store (for embedded mode)
     */
    private initializeGraphStore;
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
     * Uses storage abstraction - embedded mode uses SQLite project store, server mode uses Neo4j
     */
    private resolveProjectId;
    /**
     * Step 1: Look up nodes by file path from knowledge graph
     * Uses storage abstraction - embedded mode uses Graphology, server mode uses Neo4j
     */
    private lookupNodesFromFiles;
    /**
     * Embedded mode: Look up nodes using Graphology graph store
     */
    private lookupNodesEmbedded;
    /**
     * Server mode: Look up nodes using Neo4j
     */
    private lookupNodesNeo4j;
    /**
     * Step 2: Get relationships between seed nodes
     * Uses storage abstraction - embedded mode uses Graphology, server mode uses Neo4j
     */
    private getRelationshipsBetweenNodes;
    /**
     * Embedded mode: Get relationships using Graphology graph store
     */
    private getRelationshipsEmbedded;
    /**
     * Server mode: Get relationships using Neo4j
     */
    private getRelationshipsNeo4j;
    /**
     * Step 3: One-hop expansion - find important neighbors not in seed set
     * Uses storage abstraction - embedded mode uses Graphology, server mode uses Neo4j
     */
    private expandOneHop;
    /**
     * Embedded mode: One-hop expansion using Graphology graph store
     */
    private expandOneHopEmbedded;
    /**
     * Server mode: One-hop expansion using Neo4j
     */
    private expandOneHopNeo4j;
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