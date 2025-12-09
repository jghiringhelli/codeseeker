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

import {
  KnowledgeNode,
  KnowledgeTriad,
  NodeType,
  RelationType,
  GraphQuery,
  GraphAnalysis,
  GraphMutation,
  ArchitecturalInsight,
  SemanticCluster,
  TraversalQuery,
  TriadSource,
  EvidenceType
} from './types';
import { Logger } from '../../../utils/logger';

// Service imports
import { IGraphDatabaseService, GraphDatabaseService } from './services/graph-database-service';
import { IGraphAnalyzer, GraphAnalyzer } from './services/graph-analyzer';
import { IArchitecturalInsightDetector, ArchitecturalInsightDetector } from './services/architectural-insight-detector';
import { IGraphUtilityService, GraphUtilityService } from './services/graph-utility-service';

// Manager imports
import { IGraphStateManager, GraphStateManager } from './managers/graph-state-manager';
import { IGraphQueryManager, GraphQueryManager } from './managers/graph-query-manager';
import { IGraphTraversalManager, GraphTraversalManager } from './managers/graph-traversal-manager';
import { IGraphMutationManager, GraphMutationManager } from './managers/graph-mutation-manager';

/**
 * Main Knowledge Graph class - now acts as a coordinator/facade
 * Most functionality is delegated to specialized managers and services
 */
export class SemanticKnowledgeGraph {
  private logger: Logger;

  constructor(
    private projectPath: string,
    private databaseService?: IGraphDatabaseService,
    private analyzer?: IGraphAnalyzer,
    private insightDetector?: IArchitecturalInsightDetector,
    private utilityService?: IGraphUtilityService,
    private stateManager?: IGraphStateManager,
    private queryManager?: IGraphQueryManager,
    private traversalManager?: IGraphTraversalManager,
    private mutationManager?: IGraphMutationManager
  ) {
    this.logger = Logger.getInstance().child('KnowledgeGraph');

    // Initialize services with defaults if not provided
    this.databaseService = databaseService || new GraphDatabaseService(projectPath);
    this.analyzer = analyzer || new GraphAnalyzer();
    this.insightDetector = insightDetector || new ArchitecturalInsightDetector();
    this.utilityService = utilityService || new GraphUtilityService();

    // Initialize managers with defaults if not provided
    this.stateManager = stateManager || new GraphStateManager();
    this.queryManager = queryManager || new GraphQueryManager();
    this.traversalManager = traversalManager || new GraphTraversalManager();
    this.mutationManager = mutationManager || new GraphMutationManager();

    this.initializeGraph();
  }

  private async initializeGraph(): Promise<void> {
    try {
      // Initialize database
      await this.databaseService!.initializeDatabase();

      // Initialize state manager
      this.stateManager!.initializeIndexes();

      // Load existing data
      await this.stateManager!.loadState(this.databaseService!);

      this.logger.debug(`Knowledge graph initialized with ${this.stateManager!.getNodeCount()} nodes and ${this.stateManager!.getTriadCount()} triads`);
    } catch (error) {
      // Don't log error - database service handles its own notification
      this.logger.debug('Knowledge graph running in fallback mode (database unavailable)');
    }
  }

  // Node Management - Delegate to StateManager
  async addNode(node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.stateManager!.addNode(node, this.utilityService!, this.databaseService!);
  }

  // Triad Management - Delegate to StateManager
  async addTriad(triad: Omit<KnowledgeTriad, 'id' | 'createdAt'>): Promise<string> {
    return this.stateManager!.addTriad(triad, this.utilityService!, this.databaseService!);
  }

  // Query Operations - Delegate to QueryManager
  async queryNodes(query: GraphQuery): Promise<KnowledgeNode[]> {
    return this.queryManager!.queryNodes(query, this.databaseService!, this.stateManager!);
  }

  async queryTriads(query: GraphQuery): Promise<KnowledgeTriad[]> {
    return this.queryManager!.queryTriads(query, this.databaseService!, this.stateManager!);
  }

  // Traversal Operations - Delegate to TraversalManager
  async traverse(query: TraversalQuery): Promise<{ nodes: KnowledgeNode[]; path: string[] }> {
    return this.traversalManager!.traverse(query, this.stateManager!);
  }

  // Analysis Operations - Delegate to Analyzer Service
  async analyzeGraph(): Promise<GraphAnalysis> {
    return this.analyzer!.analyzeGraph(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  async findSemanticClusters(minClusterSize = 3): Promise<SemanticCluster[]> {
    return this.analyzer!.findSemanticClusters(this.stateManager!.getNodes(), this.stateManager!.getTriads(), minClusterSize);
  }

  async detectArchitecturalInsights(): Promise<ArchitecturalInsight[]> {
    return this.insightDetector!.detectArchitecturalInsights(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  // Mutation Operations - Delegate to MutationManager
  async mutateGraph(mutation: GraphMutation): Promise<void> {
    return this.mutationManager!.mutateGraph(mutation, this.stateManager!, this.databaseService!);
  }

  // Convenience methods for common operations
  async findNodeById(id: string): Promise<KnowledgeNode | undefined> {
    return this.queryManager!.findNodeById(id, this.stateManager!);
  }

  async findTriadById(id: string): Promise<KnowledgeTriad | undefined> {
    return this.queryManager!.findTriadById(id, this.stateManager!);
  }

  async findNodesByType(type: NodeType): Promise<KnowledgeNode[]> {
    return this.queryManager!.findNodesByType(type, this.stateManager!);
  }

  async findTriadsByRelation(relation: RelationType): Promise<KnowledgeTriad[]> {
    return this.queryManager!.findTriadsByRelation(relation, this.stateManager!);
  }

  async findConnectedNodes(nodeId: string): Promise<string[]> {
    return this.queryManager!.findConnectedNodes(nodeId, this.stateManager!);
  }

  async findShortestPath(startId: string, endId: string): Promise<string[]> {
    return this.queryManager!.findShortestPath(startId, endId, this.stateManager!);
  }

  // Advanced operations
  async optimizeGraph(): Promise<{ orphanedNodes: string[]; duplicateTriads: string[]; weakConnections: string[] }> {
    return this.mutationManager!.optimizeGraph(this.stateManager!);
  }

  async validateGraph(): Promise<{ isValid: boolean; errors: string[] }> {
    return this.stateManager!.validateState();
  }

  async getGraphStatistics(): Promise<{
    totalNodes: number;
    totalTriads: number;
    averageDegree: number;
    maxDegree: number;
    nodeTypeDistribution: Record<string, number>;
    relationTypeDistribution: Record<string, number>;
  }> {
    return this.queryManager!.getQueryStats(this.stateManager!);
  }

  // Memory management
  getMemoryUsage(): { nodes: number; triads: number; indexes: number; total: number } {
    return this.stateManager!.getMemoryUsage();
  }

  // Lifecycle management
  async close(): Promise<void> {
    if (this.databaseService) {
      await this.databaseService.closeConnection();
      this.logger.info('Knowledge graph services closed');
    }
  }

  // Backward compatibility method for general queries
  async query(params: any): Promise<any> {
    // General query method for backward compatibility
    if (params.type === 'nodes') {
      return this.queryNodes(params as GraphQuery);
    } else if (params.type === 'triads') {
      return this.queryTriads(params as GraphQuery);
    } else if (params.type === 'traverse') {
      return this.traverse(params as TraversalQuery);
    }
    return [];
  }

  // Legacy method implementations for backward compatibility
  async removeNode(nodeId: string): Promise<void> {
    // Find and remove all related triads first
    const relatedTriads = Array.from(this.stateManager!.getTriads().values())
      .filter(triad => triad.subject === nodeId || triad.object === nodeId);

    for (const triad of relatedTriads) {
      await this.stateManager!.removeTriad(triad.id);
    }

    await this.stateManager!.removeNode(nodeId);
    this.logger.debug(`Removed node ${nodeId} and ${relatedTriads.length} related triads`);
  }

  private async removeTriad(triadId: string): Promise<void> {
    await this.stateManager!.removeTriad(triadId);
  }

  private async updateNode(nodeId: string, updates: Partial<KnowledgeNode>): Promise<void> {
    await this.stateManager!.updateNode(nodeId, updates);
  }

  private async updateTriad(triadId: string, updates: Partial<KnowledgeTriad>): Promise<void> {
    await this.stateManager!.updateTriad(triadId, updates);
  }

  private generateNodeId(type: NodeType, name: string, namespace?: string): string {
    return this.utilityService!.generateNodeId(type, name, namespace);
  }

  private generateTriadId(subject: string, predicate: RelationType, object: string): string {
    return this.utilityService!.generateTriadId(subject, predicate, object);
  }

  private matchesMetadata(nodeMetadata: any, queryMetadata: any): boolean {
    return Object.entries(queryMetadata).every(([key, value]) => {
      return nodeMetadata[key] === value;
    });
  }

  private matchesNodeFilter(node: KnowledgeNode, filters?: any): boolean {
    if (!filters) return true;

    if (filters.types && !filters.types.includes(node.type)) return false;
    if (filters.names && !filters.names.some((name: string) => node.name?.includes(name))) return false;
    if (filters.namespaces && node.metadata?.namespace && !filters.namespaces.includes(node.metadata.namespace)) return false;

    return true;
  }

  private async calculateCentralityScores(): Promise<Record<string, number>> {
    return this.analyzer!.calculateCentralityScores(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  private async findStronglyConnectedComponents(): Promise<string[][]> {
    return this.analyzer!.findStronglyConnectedComponents(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  private calculateClusteringCoefficient(): number {
    return this.utilityService!.calculateClusteringCoefficient(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  private hasConnection(node1: string, node2: string): boolean {
    return this.utilityService!.hasConnection(node1, node2, this.stateManager!.getTriads());
  }

  private async expandSemanticCluster(startNodeId: string, visited: Set<string>): Promise<SemanticCluster> {
    return this.traversalManager!.expandSemanticCluster(startNodeId, visited, this.stateManager!, this.utilityService!);
  }

  private async detectDesignPatterns(): Promise<ArchitecturalInsight[]> {
    return this.insightDetector!.detectDesignPatterns(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  private async detectAntiPatterns(): Promise<ArchitecturalInsight[]> {
    return this.insightDetector!.detectAntiPatterns(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  private async detectCouplingIssues(): Promise<ArchitecturalInsight[]> {
    return this.insightDetector!.detectCouplingIssues(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  private async detectRefactoringOpportunities(): Promise<ArchitecturalInsight[]> {
    return this.insightDetector!.detectRefactoringOpportunities(this.stateManager!.getNodes(), this.stateManager!.getTriads());
  }

  // Additional convenience methods that were in the original
  async findArchitectureComplexity(filePaths: string[]): Promise<any[]> {
    this.logger.info(`Finding architecture complexity for files: ${filePaths.join(', ')}`);
    // This could be implemented using the graph analysis
    const analysis = await this.analyzeGraph();
    return [{
      complexity: analysis.centralityScores,
      distribution: analysis.nodeTypeDistribution
    }];
  }

  async findSemanticRelationships(codeFiles: string[]): Promise<any[]> {
    this.logger.info(`Finding semantic relationships in files: ${codeFiles.join(', ')}`);
    const clusters = await this.findSemanticClusters();
    return clusters.map(cluster => ({
      files: codeFiles,
      relationships: cluster.nodes
    }));
  }

  async findPerformanceRelationships(codeFiles: string[]): Promise<any[]> {
    this.logger.info(`Finding performance relationships in files: ${codeFiles.join(', ')}`);
    return [];
  }

  async getPerformanceDependencies(architecture: string): Promise<any[]> {
    this.logger.info(`Getting performance dependencies for architecture: ${architecture}`);
    return [];
  }

  async findSimilarPerformanceIssues(metrics: string[]): Promise<any[]> {
    this.logger.info(`Finding similar performance issues for metrics: ${metrics.join(', ')}`);
    return [];
  }

  async findQualityRelationships(codeFiles: string[]): Promise<any[]> {
    this.logger.info(`Finding quality relationships in files: ${codeFiles.join(', ')}`);
    return [];
  }

  async getQualityDependencies(modules: string[]): Promise<any[]> {
    this.logger.info(`Getting quality dependencies for modules: ${modules.join(', ')}`);
    return [];
  }

  async findSimilarQualityIssues(metrics: string[]): Promise<any[]> {
    this.logger.info(`Finding similar quality issues for metrics: ${metrics.join(', ')}`);
    return [];
  }
}

export const KnowledgeGraph = SemanticKnowledgeGraph;
export default SemanticKnowledgeGraph;