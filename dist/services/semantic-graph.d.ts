/**
 * Semantic Graph Service - Neo4j Integration
 * Provides intelligent graph-based search and analysis for CodeMind
 */
export interface GraphNode {
    id: string;
    labels: string[];
    properties: Record<string, any>;
}
export interface GraphRelationship {
    id: string;
    type: string;
    startNodeId: string;
    endNodeId: string;
    properties: Record<string, any>;
}
export interface SemanticSearchResult {
    node: GraphNode;
    relatedNodes: Array<{
        node: GraphNode;
        relationship: string;
    }>;
    relevanceScore: number;
}
export interface ImpactAnalysisResult {
    affectedNodes: GraphNode[];
    relationships: GraphRelationship[];
    impact: {
        codeFiles: number;
        documentation: number;
        tests: number;
        uiComponents: number;
    };
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}
export interface CrossReferenceResult {
    concept: GraphNode;
    relatedCode: GraphNode[];
    relatedDocs: GraphNode[];
    relatedUI: GraphNode[];
    relatedTests: GraphNode[];
}
export type NodeType = 'Code' | 'Documentation' | 'BusinessConcept' | 'UIComponent' | 'TestCase';
export type RelationshipType = 'IMPORTS' | 'USES' | 'IMPLEMENTS' | 'DESCRIBES' | 'TESTS' | 'DEFINES' | 'RELATES_TO' | 'DEPENDS_ON';
export interface SearchContext {
    includeTypes?: NodeType[];
    maxDepth?: number;
    domain?: string;
    language?: string;
}
export declare class SemanticGraphService {
    private driver;
    private logger;
    constructor(uri?: string, username?: string, password?: string);
    initialize(): Promise<void>;
    close(): Promise<void>;
    addNode(type: NodeType, properties: Record<string, any>): Promise<string>;
    addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void>;
    batchCreateNodes(nodes: Array<{
        type: NodeType;
        properties: Record<string, any>;
    }>): Promise<string[]>;
    semanticSearch(query: string, context?: SearchContext): Promise<SemanticSearchResult[]>;
    findRelated(nodeId: string, maxDepth?: number, relationshipTypes?: RelationshipType[]): Promise<GraphNode[]>;
    analyzeImpact(nodeId: string, maxDepth?: number): Promise<ImpactAnalysisResult>;
    findCrossReferences(conceptName: string): Promise<CrossReferenceResult>;
    getGraphStatistics(): Promise<any>;
    private ensureIndexes;
    private convertNeo4jNode;
    private convertNeo4jRelationship;
    private calculateRelevanceScore;
    private calculateRiskLevel;
}
export default SemanticGraphService;
//# sourceMappingURL=semantic-graph.d.ts.map