/**
 * Semantic Knowledge Graph Implementation - SOLID Principles Compliant
 *
 * Core knowledge graph engine that manages triads (subject-predicate-object)
 * representing semantic relationships between code entities.
 *
 * Follows SOLID principles:
 * - Single Responsibility: Core coordination and facade only
 * - Dependency Inversion: Depends on abstractions through injected services and managers
 * - Open/Closed: Extensible through service and manager interfaces
 */
import { KnowledgeNode, KnowledgeTriad, NodeType, RelationType, GraphQuery, GraphAnalysis, GraphMutation, ArchitecturalInsight, SemanticCluster, TraversalQuery } from './types';
import { IGraphDatabaseService } from './services/graph-database-service';
import { IGraphAnalyzer } from './services/graph-analyzer';
import { IArchitecturalInsightDetector } from './services/architectural-insight-detector';
import { IGraphUtilityService } from './services/graph-utility-service';
import { IGraphStateManager } from './managers/graph-state-manager';
import { IGraphQueryManager } from './managers/graph-query-manager';
import { IGraphTraversalManager } from './managers/graph-traversal-manager';
import { IGraphMutationManager } from './managers/graph-mutation-manager';
/**
 * Main Knowledge Graph class - now acts as a coordinator/facade
 * Most functionality is delegated to specialized managers and services
 */
export declare class SemanticKnowledgeGraph {
    private projectPath;
    private databaseService?;
    private analyzer?;
    private insightDetector?;
    private utilityService?;
    private stateManager?;
    private queryManager?;
    private traversalManager?;
    private mutationManager?;
    private logger;
    constructor(projectPath: string, databaseService?: IGraphDatabaseService, analyzer?: IGraphAnalyzer, insightDetector?: IArchitecturalInsightDetector, utilityService?: IGraphUtilityService, stateManager?: IGraphStateManager, queryManager?: IGraphQueryManager, traversalManager?: IGraphTraversalManager, mutationManager?: IGraphMutationManager);
    private initializeGraph;
    addNode(node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
    addTriad(triad: Omit<KnowledgeTriad, 'id' | 'createdAt'>): Promise<string>;
    queryNodes(query: GraphQuery): Promise<KnowledgeNode[]>;
    queryTriads(query: GraphQuery): Promise<KnowledgeTriad[]>;
    traverse(query: TraversalQuery): Promise<{
        nodes: KnowledgeNode[];
        path: string[];
    }>;
    analyzeGraph(): Promise<GraphAnalysis>;
    findSemanticClusters(minClusterSize?: number): Promise<SemanticCluster[]>;
    detectArchitecturalInsights(): Promise<ArchitecturalInsight[]>;
    mutateGraph(mutation: GraphMutation): Promise<void>;
    findNodeById(id: string): Promise<KnowledgeNode | undefined>;
    findTriadById(id: string): Promise<KnowledgeTriad | undefined>;
    findNodesByType(type: NodeType): Promise<KnowledgeNode[]>;
    findTriadsByRelation(relation: RelationType): Promise<KnowledgeTriad[]>;
    findConnectedNodes(nodeId: string): Promise<string[]>;
    findShortestPath(startId: string, endId: string): Promise<string[]>;
    optimizeGraph(): Promise<{
        orphanedNodes: string[];
        duplicateTriads: string[];
        weakConnections: string[];
    }>;
    validateGraph(): Promise<{
        isValid: boolean;
        errors: string[];
    }>;
    getGraphStatistics(): Promise<{
        totalNodes: number;
        totalTriads: number;
        averageDegree: number;
        maxDegree: number;
        nodeTypeDistribution: Record<string, number>;
        relationTypeDistribution: Record<string, number>;
    }>;
    getMemoryUsage(): {
        nodes: number;
        triads: number;
        indexes: number;
        total: number;
    };
    close(): Promise<void>;
    query(params: any): Promise<any>;
    removeNode(nodeId: string): Promise<void>;
    private removeTriad;
    private updateNode;
    private updateTriad;
    private generateNodeId;
    private generateTriadId;
    private matchesMetadata;
    private matchesNodeFilter;
    private calculateCentralityScores;
    private findStronglyConnectedComponents;
    private calculateClusteringCoefficient;
    private hasConnection;
    private expandSemanticCluster;
    private detectDesignPatterns;
    private detectAntiPatterns;
    private detectCouplingIssues;
    private detectRefactoringOpportunities;
    findArchitectureComplexity(filePaths: string[]): Promise<any[]>;
    findSemanticRelationships(codeFiles: string[]): Promise<any[]>;
    findPerformanceRelationships(codeFiles: string[]): Promise<any[]>;
    getPerformanceDependencies(architecture: string): Promise<any[]>;
    findSimilarPerformanceIssues(metrics: string[]): Promise<any[]>;
    findQualityRelationships(codeFiles: string[]): Promise<any[]>;
    getQualityDependencies(modules: string[]): Promise<any[]>;
    findSimilarQualityIssues(metrics: string[]): Promise<any[]>;
}
export declare const KnowledgeGraph: typeof SemanticKnowledgeGraph;
export default SemanticKnowledgeGraph;
//# sourceMappingURL=knowledge-graph.d.ts.map