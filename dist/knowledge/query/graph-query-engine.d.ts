/**
 * Graph Query Engine for Semantic Knowledge Graph
 *
 * Provides powerful querying and traversal capabilities for the knowledge graph
 * with support for complex queries, graph algorithms, and semantic search.
 */
import { KnowledgeNode, KnowledgeTriad, NodeType, RelationType, SemanticCluster } from '../graph/types';
import { SemanticKnowledgeGraph } from '../graph/knowledge-graph';
export interface QueryResult<T = any> {
    data: T;
    metadata: {
        executionTime: number;
        nodesTraversed: number;
        triadsExamined: number;
        queryComplexity: number;
    };
}
export interface PathResult {
    path: KnowledgeNode[];
    relationships: KnowledgeTriad[];
    totalWeight: number;
    confidence: number;
}
export interface GraphPattern {
    name: string;
    nodes: Array<{
        id?: string;
        type?: NodeType;
        name?: string;
        constraints?: Record<string, any>;
    }>;
    relationships: Array<{
        from: number;
        to: number;
        type: RelationType;
        constraints?: Record<string, any>;
    }>;
}
export interface CypherQuery {
    query: string;
    parameters?: Record<string, any>;
}
export declare class GraphQueryEngine {
    private knowledgeGraph;
    private logger;
    private cache;
    private cacheTimeout;
    constructor(knowledgeGraph: SemanticKnowledgeGraph);
    findNode(nodeId: string): Promise<QueryResult<KnowledgeNode | null>>;
    findNodesByType(type: NodeType, limit?: number): Promise<QueryResult<KnowledgeNode[]>>;
    findRelatedNodes(nodeId: string, relationTypes: RelationType[], direction?: 'incoming' | 'outgoing' | 'both', depth?: number): Promise<QueryResult<KnowledgeNode[]>>;
    findShortestPath(fromNodeId: string, toNodeId: string, relationTypes?: RelationType[], maxDepth?: number): Promise<QueryResult<PathResult | null>>;
    findAllPaths(fromNodeId: string, toNodeId: string, relationTypes?: RelationType[], maxDepth?: number, maxPaths?: number): Promise<QueryResult<PathResult[]>>;
    findPattern(pattern: GraphPattern): Promise<QueryResult<Array<Record<string, KnowledgeNode>>>>;
    executeCypher(cypherQuery: CypherQuery): Promise<QueryResult<any[]>>;
    analyzeNodeCentrality(nodeId: string): Promise<QueryResult<{
        betweennessCentrality: number;
        closenessCentrality: number;
        degreeCentrality: number;
        eigenvectorCentrality: number;
    }>>;
    findCommunities(algorithm?: 'louvain' | 'modularity'): Promise<QueryResult<SemanticCluster[]>>;
    semanticSearch(query: string, searchType?: 'nodes' | 'relationships' | 'both', limit?: number): Promise<QueryResult<Array<{
        item: KnowledgeNode | KnowledgeTriad;
        similarity: number;
    }>>>;
    createSubgraph(nodeFilter: (node: KnowledgeNode) => boolean, triadFilter: (triad: KnowledgeTriad) => boolean): Promise<QueryResult<{
        nodes: KnowledgeNode[];
        triads: KnowledgeTriad[];
    }>>;
    private dijkstraShortestPath;
    private reconstructPath;
    private depthFirstSearchAllPaths;
    private matchPatternFromNode;
    private nodeMatchesPattern;
    private parseCypherQuery;
    private calculateBetweennessCentrality;
    private calculateClosenessCentrality;
    private calculateDegreeCentrality;
    private calculateEigenvectorCentrality;
    private louvainCommunityDetection;
    private modularityCommunityDetection;
    private calculateSemanticSimilarity;
    private isCacheValid;
    private getCachedResult;
    private cacheResult;
    clearCache(): void;
}
//# sourceMappingURL=graph-query-engine.d.ts.map