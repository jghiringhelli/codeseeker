/**
 * Semantic Graph Service (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on service abstractions
 * Coordinates all semantic graph operations using focused services
 */

import { Logger } from '../../../../utils/logger';
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';
import {
  GraphNode,
  GraphRelationship,
  NodeType,
  RelationshipType,
  SearchResult,
  SearchContext,
  ImpactAnalysisResult,
  CrossReferenceResult,
  IntegratedSemanticResult,
  GraphBuilderConfig,
  IFileProcessingService,
  IGraphStorageService,
  IGraphQueryService,
  IQualityAnalyzer
} from './interfaces/index';
import { FileProcessingService } from './services/file-processing-service';
import { GraphStorageService } from './services/graph-storage-service';
import { GraphQueryService } from './services/graph-query-service';

// Re-export interfaces and types for backward compatibility
export {
  GraphNode,
  GraphRelationship,
  NodeType,
  RelationshipType,
  SearchResult,
  SearchContext,
  ImpactAnalysisResult,
  CrossReferenceResult,
  IntegratedSemanticResult
} from './interfaces/index';

// Legacy exports for backward compatibility
export interface IGraphProcessor {
  processFiles(files: FileInfo[]): Promise<any>;
}

export interface IGraphStorage {
  addNode(type: NodeType, properties: Record<string, any>): Promise<string>;
  addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void>;
  batchCreateNodes(nodes: Array<{ type: NodeType; properties: Record<string, any> }>): Promise<string[]>;
  close(): Promise<void>;
}

export class SemanticGraphService implements IGraphStorage {
  private logger = Logger.getInstance();
  private initialized = false;

  constructor(
    private uri: string = 'bolt://localhost:7687',
    private username: string = 'neo4j',
    private password: string = 'codemind123',
    private fileProcessingService?: IFileProcessingService,
    private storageService?: IGraphStorageService,
    private queryService?: IGraphQueryService,
    private qualityAnalyzer?: IQualityAnalyzer,
    private config?: Partial<GraphBuilderConfig>
  ) {
    // Initialize services with dependency injection
    this.storageService = this.storageService || new GraphStorageService(uri, username, password);
    this.queryService = this.queryService || new GraphQueryService(this.storageService, qualityAnalyzer);

    const fullConfig: GraphBuilderConfig = {
      useTreeSitter: true,
      useClaudeProxy: true,
      preferTreeSitter: true,
      maxClaudeConcurrency: 3,
      treeSitterLanguages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust'],
      skipLargeFiles: true,
      maxFileSize: 500000,
      ...config
    };

    this.fileProcessingService = this.fileProcessingService || new FileProcessingService(
      fullConfig,
      undefined, // TreeSitterProcessor
      undefined, // ClaudeProxyProcessor
      undefined, // FallbackProcessor
      qualityAnalyzer
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.storageService!.initialize();
      await this.ensureIndexes();
      this.initialized = true;
      this.logger.debug('🔗 Semantic graph service initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize semantic graph service:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.storageService!.close();
      this.initialized = false;
      this.logger.debug('🔗 Semantic graph service closed');
    } catch (error) {
      this.logger.error('Failed to close semantic graph service:', error);
    }
  }

  // File Processing Operations (delegated to FileProcessingService)
  async buildGraphFromFiles(files: FileInfo[]): Promise<IntegratedSemanticResult> {
    await this.ensureInitialized();
    return this.fileProcessingService!.buildGraphFromFiles(files);
  }

  // Storage Operations (delegated to GraphStorageService)
  async addNode(type: NodeType, properties: Record<string, any>): Promise<string> {
    await this.ensureInitialized();
    return this.storageService!.addNode(type, properties);
  }

  async addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    return this.storageService!.addRelationship(fromId, toId, type, properties);
  }

  async batchCreateNodes(nodes: Array<{ type: NodeType; properties: Record<string, any> }>): Promise<string[]> {
    await this.ensureInitialized();
    return this.storageService!.batchCreateNodes(nodes);
  }

  // Query Operations (delegated to GraphQueryService)
  async searchNodes(query: string, context?: SearchContext): Promise<SearchResult> {
    await this.ensureInitialized();
    return this.queryService!.searchNodes(query, context);
  }

  async findRelatedNodes(nodeId: string, maxDepth?: number): Promise<GraphNode[]> {
    await this.ensureInitialized();
    return this.queryService!.findRelatedNodes(nodeId, maxDepth);
  }

  async findPathBetweenNodes(fromId: string, toId: string): Promise<GraphNode[]> {
    await this.ensureInitialized();
    return this.queryService!.findPathBetweenNodes(fromId, toId);
  }

  async getNodesByType(type: NodeType): Promise<GraphNode[]> {
    await this.ensureInitialized();
    return this.queryService!.getNodesByType(type);
  }

  async analyzeImpact(nodeId: string): Promise<ImpactAnalysisResult> {
    await this.ensureInitialized();
    return this.queryService!.analyzeImpact(nodeId);
  }

  async performCrossReference(concept: string): Promise<CrossReferenceResult> {
    await this.ensureInitialized();
    return this.queryService!.performCrossReference(concept);
  }

  // Advanced Operations
  async findBusinessConcepts(): Promise<GraphNode[]> {
    await this.ensureInitialized();
    return (this.queryService as any).findBusinessConcepts();
  }

  async getGraphStatistics(): Promise<{
    nodeCount: number;
    relationshipCount: number;
    typeDistribution: Record<string, number>;
  }> {
    await this.ensureInitialized();
    return (this.queryService as any).getGraphStatistics();
  }

  // Utility Operations
  async clearGraph(): Promise<void> {
    await this.ensureInitialized();
    return (this.storageService as any).clearGraph();
  }

  // Index Management
  private async ensureIndexes(): Promise<void> {
    // This would ensure proper Neo4j indexes exist
    // Placeholder for index creation logic
    this.logger.debug('📊 Ensuring graph indexes...');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Factory Methods for Testing and Dependency Injection
  static createWithServices(
    fileProcessingService: IFileProcessingService,
    storageService: IGraphStorageService,
    queryService: IGraphQueryService,
    qualityAnalyzer?: IQualityAnalyzer
  ): SemanticGraphService {
    return new SemanticGraphService(
      'bolt://localhost:7687',
      'neo4j',
      'codemind123',
      fileProcessingService,
      storageService,
      queryService,
      qualityAnalyzer
    );
  }

  static createDefault(
    uri?: string,
    username?: string,
    password?: string,
    config?: Partial<GraphBuilderConfig>
  ): SemanticGraphService {
    return new SemanticGraphService(uri, username, password, undefined, undefined, undefined, undefined, config);
  }

  // Backward Compatibility Methods (Legacy API support)
  async filterFiles(files: FileInfo[]): FileInfo[] {
    return this.fileProcessingService!.filterFiles(files);
  }

  async categorizeFiles(files: FileInfo[]): Promise<{
    treeSitter: FileInfo[];
    claude: FileInfo[];
    fallback: FileInfo[];
  }> {
    return this.fileProcessingService!.categorizeFiles(files);
  }

  calculateRelevanceScore(node: GraphNode, keywords: string[]): number {
    return (this.queryService as any).calculateRelevanceScore(node, keywords);
  }
}

// Export the main class and convenience factory
export default SemanticGraphService;
export { SemanticGraphService };

// Re-export service classes for advanced usage
export { FileProcessingService } from './services/file-processing-service';
export { GraphStorageService } from './services/graph-storage-service';
export { GraphQueryService } from './services/graph-query-service';