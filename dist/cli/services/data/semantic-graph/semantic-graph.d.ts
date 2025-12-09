/**
 * Semantic Graph Service (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on service abstractions
 * Coordinates all semantic graph operations using focused services
 */
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';
import { GraphNode, NodeType, RelationshipType, SearchResult, SearchContext, ImpactAnalysisResult, CrossReferenceResult, IntegratedSemanticResult, GraphBuilderConfig, IFileProcessingService, IGraphStorageService, IGraphQueryService, IQualityAnalyzer } from './interfaces/index';
export { GraphNode, GraphRelationship, NodeType, RelationshipType, SearchResult, SearchContext, ImpactAnalysisResult, CrossReferenceResult, IntegratedSemanticResult } from './interfaces/index';
export interface IGraphProcessor {
    processFiles(files: FileInfo[]): Promise<any>;
}
export interface IGraphStorage {
    addNode(type: NodeType, properties: Record<string, any>): Promise<string>;
    addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void>;
    batchCreateNodes(nodes: Array<{
        type: NodeType;
        properties: Record<string, any>;
    }>): Promise<string[]>;
    close(): Promise<void>;
}
declare class SemanticGraphService implements IGraphStorage {
    private uri;
    private username;
    private password;
    private fileProcessingService?;
    private storageService?;
    private queryService?;
    private qualityAnalyzer?;
    private config?;
    private logger;
    private initialized;
    constructor(uri?: string, username?: string, password?: string, fileProcessingService?: IFileProcessingService, storageService?: IGraphStorageService, queryService?: IGraphQueryService, qualityAnalyzer?: IQualityAnalyzer, config?: Partial<GraphBuilderConfig>);
    initialize(): Promise<void>;
    close(): Promise<void>;
    buildGraphFromFiles(files: FileInfo[]): Promise<IntegratedSemanticResult>;
    addNode(type: NodeType, properties: Record<string, any>): Promise<string>;
    addRelationship(fromId: string, toId: string, type: RelationshipType, properties?: Record<string, any>): Promise<void>;
    batchCreateNodes(nodes: Array<{
        type: NodeType;
        properties: Record<string, any>;
    }>): Promise<string[]>;
    searchNodes(query: string, context?: SearchContext): Promise<SearchResult>;
    findRelatedNodes(nodeId: string, maxDepth?: number): Promise<GraphNode[]>;
    findPathBetweenNodes(fromId: string, toId: string): Promise<GraphNode[]>;
    getNodesByType(type: NodeType): Promise<GraphNode[]>;
    analyzeImpact(nodeId: string): Promise<ImpactAnalysisResult>;
    performCrossReference(concept: string): Promise<CrossReferenceResult>;
    findBusinessConcepts(): Promise<GraphNode[]>;
    getGraphStatistics(): Promise<{
        nodeCount: number;
        relationshipCount: number;
        typeDistribution: Record<string, number>;
    }>;
    clearGraph(): Promise<void>;
    private ensureIndexes;
    private ensureInitialized;
    static createWithServices(fileProcessingService: IFileProcessingService, storageService: IGraphStorageService, queryService: IGraphQueryService, qualityAnalyzer?: IQualityAnalyzer): SemanticGraphService;
    static createDefault(uri?: string, username?: string, password?: string, config?: Partial<GraphBuilderConfig>): SemanticGraphService;
    filterFiles(files: FileInfo[]): Promise<FileInfo[]>;
    categorizeFiles(files: FileInfo[]): Promise<{
        treeSitter: FileInfo[];
        claude: FileInfo[];
        fallback: FileInfo[];
    }>;
    calculateRelevanceScore(node: GraphNode, keywords: string[]): number;
    semanticSearch(query: string, context?: SearchContext): Promise<SearchResult[]>;
    findCrossReferences(nodeId: string): Promise<CrossReferenceResult[]>;
}
export { SemanticGraphService };
export default SemanticGraphService;
export { FileProcessingService } from './services/file-processing-service';
export { GraphStorageService } from './services/graph-storage-service';
export { GraphQueryService } from './services/graph-query-service';
//# sourceMappingURL=semantic-graph.d.ts.map