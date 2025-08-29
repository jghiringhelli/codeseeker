/**
 * Semantic Knowledge Graph Implementation
 *
 * Core knowledge graph engine that manages triads (subject-predicate-object)
 * representing semantic relationships between code entities.
 */
import { KnowledgeNode, KnowledgeTriad, GraphQuery, GraphAnalysis, GraphMutation, ArchitecturalInsight, SemanticCluster, TraversalQuery } from './types';
export declare class SemanticKnowledgeGraph {
    private projectPath;
    private logger;
    private db;
    private nodes;
    private triads;
    private nodeIndex;
    private relationIndex;
    constructor(projectPath: string);
    private initializeDatabase;
    private initializeIndexes;
    private createKnowledgeGraphTables;
    addNode(node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
    addTriad(triad: Omit<KnowledgeTriad, 'id' | 'createdAt'>): Promise<string>;
    queryNodes(query: GraphQuery): Promise<KnowledgeNode[]>;
    queryTriads(query: GraphQuery): Promise<KnowledgeTriad[]>;
    traverse(query: TraversalQuery): Promise<{
        nodes: KnowledgeNode[];
        paths: Array<{
            startNode: string;
            endNode: string;
            path: KnowledgeTriad[];
            depth: number;
        }>;
    }>;
    private traverseFromNode;
    analyzeGraph(): Promise<GraphAnalysis>;
    findSemanticClusters(minClusterSize?: number): Promise<SemanticCluster[]>;
    detectArchitecturalInsights(): Promise<ArchitecturalInsight[]>;
    mutateGraph(mutation: GraphMutation): Promise<void>;
    private generateNodeId;
    private generateTriadId;
    private matchesMetadata;
    private matchesNodeFilter;
    private calculateCentralityScores;
    private findStronglyConnectedComponents;
    private dfsComponent;
    private calculateClusteringCoefficient;
    private getNeighbors;
    private hasConnection;
    private expandSemanticCluster;
    private calculateClusterCoherence;
    private detectDesignPatterns;
    private detectAntiPatterns;
    private detectCouplingIssues;
    private detectRefactoringOpportunities;
    private groupDuplicates;
    private removeNode;
    private removeTriad;
    private updateNode;
    private updateTriad;
    getNodeCount(): Promise<number>;
    getTriadCount(): Promise<number>;
    exportGraph(): Promise<{
        nodes: KnowledgeNode[];
        triads: KnowledgeTriad[];
    }>;
    importGraph(data: {
        nodes: KnowledgeNode[];
        triads: KnowledgeTriad[];
    }): Promise<void>;
    findRelationships(nodeType: string, relationTypes: string | string[]): Promise<any[]>;
    findPatterns(patterns: string[]): Promise<any[]>;
    getNodeDependencies(nodeId: string): Promise<any[]>;
    findSimilarNodes(description: string, threshold: number): Promise<any[]>;
    getTestDependencies(nodeId: string): Promise<any[]>;
    findSimilarTestPatterns(requirements: string): Promise<any[]>;
    detectArchitecturalPatterns(codebasePath: string): Promise<any[]>;
    analyzeDependencyGraph(modules: string[]): Promise<any[]>;
    findSimilarImplementations(specification: string): Promise<any[]>;
    findSecurityRelationships(codeFiles: string[]): Promise<any[]>;
    getSecurityDependencies(dependencies: string[]): Promise<any[]>;
    findSimilarSecurityIssues(vulnerabilityReports: string[]): Promise<any[]>;
    findPerformanceRelationships(codeFiles: string[]): Promise<any[]>;
    getPerformanceDependencies(architecture: string): Promise<any[]>;
    findSimilarPerformanceIssues(metrics: string[]): Promise<any[]>;
    findQualityRelationships(codeFiles: string[]): Promise<any[]>;
    getQualityDependencies(modules: string[]): Promise<any[]>;
    findSimilarQualityIssues(metrics: string[]): Promise<any[]>;
    query(params: any): Promise<any>;
}
export declare const KnowledgeGraph: typeof SemanticKnowledgeGraph;
export default SemanticKnowledgeGraph;
//# sourceMappingURL=knowledge-graph.d.ts.map